import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../../infra/db/prisma.service';
import { BadgeGenerationService } from '../badge-generation/badge-generation.service';
import { ListRegistrationsDto } from './dto/list-registrations.dto';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { UpdateRegistrationStatusDto } from './dto/update-registration-status.dto';
import { CheckinRegistrationDto } from './dto/checkin-registration.dto';
import * as XLSX from 'xlsx';
import * as ExcelJS from 'exceljs';
import * as QRCode from 'qrcode';
import { Prisma } from '@prisma/client';
import { RegistrationScope } from '../../common/utils/resolve-registration-scope.util';

interface RegistrationQueryContext {
  scope: RegistrationScope;
  orgId?: string;
}

@Injectable()
export class RegistrationsService {
  private readonly logger = new Logger(RegistrationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly badgeGenerationService: BadgeGenerationService,
  ) {}

  /**
   * List registrations for an event with filters and pagination
   * Applique le scope au niveau Prisma:
   * - 'any': cross-tenant (pas de filtre org)
   * - 'org': filtré par org_id
   */
  async findAll(
    eventId: string,
    dto: ListRegistrationsDto,
    ctx: RegistrationQueryContext,
  ) {
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const skip = (page - 1) * limit;

    // Build where clause avec scope
    const where: Prisma.RegistrationWhereInput = {
      event_id: eventId,
    };

    // Appliquer le scope
    if (ctx.scope !== 'any') {
      where.org_id = ctx.orgId!;
    }

    if (dto.status) {
      where.status = dto.status;
    }

    if (dto.attendanceType) {
      where.attendance_mode = dto.attendanceType;
    }

    if (dto.attendeeTypeId) {
      where.event_attendee_type_id = dto.attendeeTypeId;
    }

    if (dto.company) {
      where.attendee = {
        company: { contains: dto.company, mode: 'insensitive' },
      };
    }

    if (dto.search) {
      where.attendee = {
        OR: [
          { email: { contains: dto.search, mode: 'insensitive' } },
          { first_name: { contains: dto.search, mode: 'insensitive' } },
          { last_name: { contains: dto.search, mode: 'insensitive' } },
          { company: { contains: dto.search, mode: 'insensitive' } },
        ],
      };
    }

    // Filter by active/deleted status
    if (dto.isActive !== undefined) {
      where.deleted_at = dto.isActive ? null : { not: null };
    }

    // Build orderBy
    const sortBy = dto.sortBy || 'created_at';
    let orderBy: Prisma.RegistrationOrderByWithRelationInput;

    if (['company', 'last_name', 'first_name', 'email'].includes(sortBy)) {
      orderBy = {
        attendee: {
          [sortBy]: dto.sortOrder || 'desc',
        },
      };
    } else {
      orderBy = {
        [sortBy]: dto.sortOrder || 'desc',
      };
    }

    // Execute queries in parallel
    const [data, total, awaitingCount, approvedCount, refusedCount] = await Promise.all([
      this.prisma.registration.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          attendee: true,
          eventAttendeeType: {
            include: {
              attendeeType: true,
            },
          },
        },
      }),
      this.prisma.registration.count({ where }),
      this.prisma.registration.count({ where: { ...where, status: 'awaiting' } }),
      this.prisma.registration.count({ where: { ...where, status: 'approved' } }),
      this.prisma.registration.count({ where: { ...where, status: 'refused' } }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
        statusCounts: {
          awaiting: awaitingCount,
          approved: approvedCount,
          refused: refusedCount,
        },
      },
    };
  }

  /**
   * Find a single registration by ID
   */
  async findOne(eventId: string, id: string, orgId: string | null) {
    const where: Prisma.RegistrationWhereInput = {
      id,
      event_id: eventId,
    };

    // If orgId is provided (not :any scope), limit to this org
    if (orgId !== null) {
      where.org_id = orgId;
    }

    const registration = await this.prisma.registration.findFirst({
      where,
      include: {
        attendee: true,
        eventAttendeeType: {
          include: {
            attendeeType: true,
          },
        },
      },
    });

    if (!registration) {
      throw new NotFoundException(`Registration ${id} not found for event ${eventId}`);
    }

    return registration;
  }

  /**
   * Update registration status
   * Sets confirmed_at when status changes to 'approved'
   */
  async updateStatus(
    id: string,
    orgId: string | null,
    dto: UpdateRegistrationStatusDto,
  ) {
    // Build where clause avec scope
    const where: Prisma.RegistrationWhereInput = { id };
    
    // Si orgId est fourni (pas de scope :any), limiter à cette org
    if (orgId !== null) {
      where.org_id = orgId;
    }

    const registration = await this.prisma.registration.findFirst({
      where,
      include: {
        event: true,
      },
    });

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    // Check capacity if approving
    if (dto.status === 'approved' && registration.status !== 'approved') {
      const event = registration.event;
      if (event && event.capacity) {
        const currentCount = await this.prisma.registration.count({
          where: {
            event_id: event.id,
            org_id: event.org_id,
            status: 'approved',
            deleted_at: null,
          },
        });

        if (currentCount >= event.capacity) {
          throw new ConflictException('Event is full');
        }
      }
    }

    const updateData: Prisma.RegistrationUpdateInput = {
      status: dto.status,
    };

    // Set confirmed_at when approving
    if (dto.status === 'approved' && !registration.confirmed_at) {
      updateData.confirmed_at = new Date();
    }

    return this.prisma.registration.update({
      where: { id },
      data: updateData,
      include: {
        attendee: true,
      },
    });
  }

  /**
   * Create a registration with attendee upsert
   * Checks capacity and duplicate registrations
   */
  async create(
    eventId: string,
    orgId: string,
    dto: CreateRegistrationDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Get event and settings
      const event = await tx.event.findFirst({
        where: {
          id: eventId,
          org_id: orgId,
        },
        include: {
          settings: true,
        },
      });

      if (!event) {
        throw new NotFoundException('Event not found');
      }

      // Determine status based on auto-approve setting or source
      // Mobile registrations are always auto-approved
      // Admin can override status with admin_status field
      const isMobileRegistration = dto.source === 'mobile_app';
      const defaultStatus = (event.settings?.registration_auto_approve || isMobileRegistration) ? 'approved' : 'awaiting';
      const status = dto.admin_status || defaultStatus;
      const confirmedAt = status === 'approved' ? new Date() : null;

      // Check capacity only if we are trying to approve the registration
      if (event.capacity && status === 'approved') {
        const currentCount = await tx.registration.count({
          where: {
            event_id: eventId,
            org_id: orgId,
            status: 'approved',
            deleted_at: null,
          },
        });

        if (currentCount >= event.capacity) {
          throw new ConflictException('Event is full');
        }
      }

      // Upsert attendee
      const attendee = await tx.attendee.upsert({
        where: {
          org_id_email: {
            org_id: orgId,
            email: dto.attendee.email,
          },
        },
        update: {
          first_name: dto.attendee.first_name || undefined,
          last_name: dto.attendee.last_name || undefined,
          phone: dto.attendee.phone || undefined,
          company: dto.attendee.company || undefined,
          job_title: dto.attendee.job_title || undefined,
          country: dto.attendee.country || undefined,
        },
        create: {
          org_id: orgId,
          email: dto.attendee.email,
          first_name: dto.attendee.first_name,
          last_name: dto.attendee.last_name,
          phone: dto.attendee.phone,
          company: dto.attendee.company,
          job_title: dto.attendee.job_title,
          country: dto.attendee.country,
        },
      });

      // Check for duplicate registration
      const existingRegistration = await tx.registration.findUnique({
        where: {
          event_id_attendee_id: {
            event_id: eventId,
            attendee_id: attendee.id,
          },
        },
      });

      if (existingRegistration) {
        if (existingRegistration.status === 'refused') {
          throw new ForbiddenException('This attendee was previously declined for this event');
        }
        if (['awaiting', 'approved'].includes(existingRegistration.status)) {
          throw new ConflictException('This attendee is already registered for this event');
        }
      }

      // Create registration with snapshot of attendee data
      const registration = await tx.registration.create({
        data: {
          org_id: orgId,
          event_id: eventId,
          attendee_id: attendee.id,
          status,
          attendance_mode: dto.attendance_type,
          event_attendee_type_id: dto.event_attendee_type_id,
          answers: dto.answers ? (dto.answers as Prisma.InputJsonValue) : null,
          invited_at: dto.admin_registered_at ? new Date(dto.admin_registered_at) : new Date(),
          confirmed_at: confirmedAt,
          
          // Check-in admin (si fourni)
          checked_in_at: dto.admin_is_checked_in && dto.admin_checked_in_at 
            ? new Date(dto.admin_checked_in_at)
            : dto.admin_is_checked_in
            ? new Date()
            : null,
          
          // Source de l'inscription
          source: dto.source || 'public_form',
          
          // Comment from mobile app
          comment: dto.comment,
          
          // Snapshot des données de l'attendee au moment de l'inscription (uniquement les données fournies)
          snapshot_first_name: dto.attendee.first_name,
          snapshot_last_name: dto.attendee.last_name,
          snapshot_email: dto.attendee.email,
          snapshot_phone: dto.attendee.phone,
          snapshot_company: dto.attendee.company,
          snapshot_job_title: dto.attendee.job_title,
          snapshot_country: dto.attendee.country,
        },
        include: {
          attendee: true,
        },
      });

      return registration;
    });
  }

  /**
   * Update a registration
   */
  async update(
    id: string,
    orgId: string | null,
    dto: Partial<CreateRegistrationDto>,
  ) {
    // Build where clause avec scope
    const where: Prisma.RegistrationWhereInput = { id };
    
    // Si orgId est fourni (pas de scope :any), limiter à cette org
    if (orgId !== null) {
      where.org_id = orgId;
    }

    // Find registration
    const registration = await this.prisma.registration.findFirst({
      where,
      include: { attendee: true },
    });

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    // Update attendee if provided
    if (dto.attendee) {
      await this.prisma.attendee.update({
        where: { id: registration.attendee_id },
        data: {
          email: dto.attendee.email,
          first_name: dto.attendee.first_name,
          last_name: dto.attendee.last_name,
          phone: dto.attendee.phone,
          company: dto.attendee.company,
          job_title: dto.attendee.job_title,
          country: dto.attendee.country,
        },
      });
    }

    // Update registration
    const updated = await this.prisma.registration.update({
      where: { id },
      data: {
        attendance_mode: dto.attendance_type,
        event_attendee_type_id: dto.event_attendee_type_id,
        answers: dto.answers ? (dto.answers as Prisma.InputJsonValue) : undefined,
        // Update snapshots if attendee data is provided
        ...(dto.attendee ? {
          snapshot_first_name: dto.attendee.first_name,
          snapshot_last_name: dto.attendee.last_name,
          snapshot_email: dto.attendee.email,
          snapshot_phone: dto.attendee.phone,
          snapshot_company: dto.attendee.company,
          snapshot_job_title: dto.attendee.job_title,
          snapshot_country: dto.attendee.country,
        } : {}),
      },
      include: {
        attendee: true,
      },
    });

    return updated;
  }

  /**
   * Soft delete a registration
   */
  async remove(id: string, orgId: string | null) {
    // Build where clause avec scope
    const where: Prisma.RegistrationWhereInput = { id };
    
    // Si orgId est fourni (pas de scope :any), limiter à cette org
    if (orgId !== null) {
      where.org_id = orgId;
    }

    // Find registration
    const registration = await this.prisma.registration.findFirst({
      where,
    });

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    // Soft delete registration
    await this.prisma.registration.update({
      where: { id },
      data: { deleted_at: new Date() },
    });

    return { message: 'Registration deleted successfully' };
  }

  /**
   * Restore a soft-deleted registration
   */
  async restore(id: string, orgId: string | null) {
    // Build where clause avec scope
    const where: Prisma.RegistrationWhereInput = { 
      id,
      deleted_at: { not: null },
    };
    
    // Si orgId est fourni (pas de scope :any), limiter à cette org
    if (orgId !== null) {
      where.org_id = orgId;
    }

    // Find registration
    const registration = await this.prisma.registration.findFirst({
      where,
      include: {
        attendee: true,
        event: true,
      },
    });

    if (!registration) {
      throw new NotFoundException('Deleted registration not found');
    }

    // Check capacity if restoring an approved registration
    if (registration.status === 'approved') {
      const event = registration.event;
      if (event && event.capacity) {
        const currentCount = await this.prisma.registration.count({
          where: {
            event_id: event.id,
            org_id: event.org_id,
            status: 'approved',
            deleted_at: null,
          },
        });

        if (currentCount >= event.capacity) {
          throw new ConflictException('Event is full, cannot restore approved registration');
        }
      }
    }

    // Restore registration
    const restored = await this.prisma.registration.update({
      where: { id },
      data: { deleted_at: null },
      include: {
        attendee: true,
        event: true,
        eventAttendeeType: true,
        badgeTemplate: true,
      },
    });

    return restored;
  }

  /**
   * Permanently delete a registration
   */
  async permanentDelete(id: string, orgId: string | null) {
    // Build where clause avec scope
    const where: Prisma.RegistrationWhereInput = { 
      id,
      deleted_at: { not: null },
    };
    
    // Si orgId est fourni (pas de scope :any), limiter à cette org
    if (orgId !== null) {
      where.org_id = orgId;
    }

    // Find registration
    const registration = await this.prisma.registration.findFirst({
      where,
    });

    if (!registration) {
      throw new NotFoundException('Deleted registration not found');
    }

    // Permanently delete registration
    await this.prisma.registration.delete({
      where: { id },
    });

    return { message: 'Registration permanently deleted' };
  }

  /**
   * Bulk import registrations from Excel file
   * Parses Excel and creates registrations using same logic as create()
   */
  async bulkImport(
    eventId: string,
    orgId: string,
    fileBuffer: Buffer,
    autoApprove?: boolean,
    replaceExisting?: boolean,
    dryRun?: boolean, // ← Nouveau paramètre pour simulation
  ) {
    // Parse Excel file
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new BadRequestException('Excel file is empty');
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

    if (!rows || rows.length === 0) {
      throw new BadRequestException('No data found in Excel file');
    }

    // Get event and settings once
    const event = await this.prisma.event.findFirst({
      where: {
        id: eventId,
        org_id: orgId,
      },
      include: {
        settings: true,
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Override auto-approve if provided
    const shouldAutoApprove = autoApprove !== undefined 
      ? autoApprove 
      : event.settings?.registration_auto_approve || false;

    // Get initial count of approved registrations
    let currentApprovedCount = await this.prisma.registration.count({
      where: {
        event_id: eventId,
        org_id: orgId,
        status: 'approved',
        deleted_at: null,
      },
    });

    const results = {
      total_rows: rows.length,
      created: 0,
      updated: 0,
      restored: 0, // ← Track restorations separately
      skipped: 0,
      errors: [] as Array<{ row: number; email: string; error: string }>,
    };

    console.log(`Starting bulk import for event ${eventId} with ${rows.length} rows. Initial approved count: ${currentApprovedCount}`);

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const rawRow = rows[i];
      const rowNumber = i + 2; // Excel row number (1-based + header)

      // Create normalized row for lookup (lowercase keys, no accents)
      const normalizeKey = (key: string) => key.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      const row: Record<string, any> = {};
      Object.keys(rawRow).forEach(key => {
        if (key) {
          row[normalizeKey(key)] = rawRow[key];
        }
      });

      try {
        // Extract required fields using all possible column name variations
        // Note: aliases must be normalized (lowercase, no accents)
        const emailAliases = ['email', 'e-mail', 'mail', 'courriel'];
        const email = emailAliases.map(alias => row[alias]).find(val => val);
        
        if (!email) {
          results.errors.push({
            row: rowNumber,
            email: 'N/A',
            error: 'Email is required',
          });
          results.skipped++;
          continue;
        }

        // Helper function to find value from multiple column aliases
        // Checks for non-empty string after trimming
        const findValue = (aliases: string[]) => 
          aliases.map(alias => row[alias]).find(val => val !== undefined && val !== null && String(val).trim() !== '');

        // Extract attendee data with comprehensive alias support (lowercase, no accents)
        const attendeeData = {
          email: String(email).toLowerCase().trim(),
          first_name: findValue(['first_name', 'first name', 'prenom', 'firstname', 'first']),
          last_name: findValue(['last_name', 'last name', 'nom', 'lastname', 'nom de famille', 'last']),
          phone: findValue(['phone', 'telephone', 'tel', 'mobile', 'portable', 'cell', 'gsm']),
          company: findValue(['company', 'organisation', 'organization', 'entreprise', 'org', 'societe', 'company name', 'nom de l\'entreprise', 'raison sociale', 'business', 'etablissement']),
          job_title: findValue(['job_title', 'job title', 'designation', 'poste', 'title', 'fonction', 'role', 'position']),
          country: findValue(['country', 'pays', 'nation', 'state']),
        };

        // Extract registration data
        let attendanceType = findValue(['attendance_type', 'attendance type', 'mode', 'participation', 'attendance']) || 'onsite';
        
        // Map old/alternative values to valid AttendanceMode enum
        const attendanceTypeMapping: Record<string, string> = {
          'physical': 'onsite',
          'physique': 'onsite',
          'in-person': 'onsite',
          'presentiel': 'onsite',
          'online': 'online',
          'virtual': 'online',
          'distanciel': 'online',
          'hybrid': 'hybrid',
          'hybride': 'hybrid',
          'mixed': 'hybrid',
        };
        
        const lowerAttendanceType = String(attendanceType).toLowerCase();
        attendanceType = attendanceTypeMapping[lowerAttendanceType] || 'onsite';
        
        let eventAttendeeTypeId = row['event_attendee_type_id'] || null;
        // Validate UUID format for event_attendee_type_id
        if (eventAttendeeTypeId) {
           const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
           if (!uuidRegex.test(String(eventAttendeeTypeId))) {
             eventAttendeeTypeId = null; // Fallback to null if invalid
           }
        }

        // Extract Status if present
        const statusRaw = findValue(['status', 'statut', 'state', 'etat', 'état']);
        let importedStatus: string | null = null;
        
        if (statusRaw) {
          // Normalize value: lowercase, trim, remove accents
          const normalizedStatus = String(statusRaw).toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          
          const statusMap: Record<string, string> = {
            // Approved
            'approved': 'approved', 'approuve': 'approved', 'valide': 'approved', 'ok': 'approved', 'yes': 'approved', 'oui': 'approved', 'accepted': 'approved', 'accepte': 'approved',
            // Confirmed
            'confirmed': 'confirmed', 'confirme': 'confirmed',
            // Checked In
            'checked_in': 'checked_in', 'checkedin': 'checked_in', 'present': 'checked_in',
            // Refused
            'refused': 'refused', 'refuse': 'refused', 'rejected': 'refused', 'rejete': 'refused', 'rejet': 'refused', 'declined': 'refused', 'decline': 'refused', 'ko': 'refused', 'no': 'refused', 'non': 'refused',
            // Pending
            'pending': 'pending', 'en attente': 'pending', 'attente': 'pending', 'waiting': 'pending', 'awaiting': 'awaiting',
            // Cancelled
            'cancelled': 'cancelled', 'canceled': 'cancelled', 'annule': 'cancelled',
          };
          
          importedStatus = statusMap[normalizedStatus] || null;
          
          // Fallback: partial match if exact match fails
          if (!importedStatus) {
             if (normalizedStatus.includes('refus') || normalizedStatus.includes('reject') || normalizedStatus.includes('declin')) importedStatus = 'refused';
             else if (normalizedStatus.includes('approuv') || normalizedStatus.includes('accept') || normalizedStatus.includes('valid')) importedStatus = 'approved';
             else if (normalizedStatus.includes('attente') || normalizedStatus.includes('wait') || normalizedStatus.includes('pend')) importedStatus = 'pending';
             else if (normalizedStatus.includes('cancel') || normalizedStatus.includes('annul')) importedStatus = 'cancelled';
          }
        }

        // Extract Registration Date
        const registrationDateRaw = findValue(['date d\'inscription', 'registration_date', 'created_at', 'date inscription', 'inscrit le']);
        let registrationDate = new Date(); // Default to NOW
        
        if (registrationDateRaw) {
          // Try to parse date
          // Handle Excel serial date if it's a number
          if (typeof registrationDateRaw === 'number') {
             // Excel base date is 1900-01-01. JS is ms since 1970.
             // Rough conversion: (value - 25569) * 86400 * 1000
             const date = new Date((registrationDateRaw - 25569) * 86400 * 1000);
             if (!isNaN(date.getTime())) {
               registrationDate = date;
             }
          } else {
            const date = new Date(String(registrationDateRaw));
            if (!isNaN(date.getTime())) {
              registrationDate = date;
            }
          }
        }

        // Extract Check-in Date
        const checkInRaw = findValue(['check-in', 'checkin', 'date de check-in', 'checked_in_at', 'présence', 'presence', 'checked']);
        let checkInDate: Date | null = null;
        let isCheckedIn = false;

        if (checkInRaw) {
          const rawStr = String(checkInRaw).toLowerCase().trim();
          
          // Check if it's a boolean-like value
          const booleanTrue = ['yes', 'oui', 'checked', 'present', 'présent', 'ok', 'true', 'vrai', '1', 'checkedin', 'checked_in'];
          
          if (booleanTrue.some(v => rawStr === v || rawStr.includes(v))) {
            isCheckedIn = true;
            checkInDate = new Date(); // Default to NOW
          } else {
            // Try to parse as date
            let date: Date | null = null;
            if (typeof checkInRaw === 'number') {
               date = new Date((checkInRaw - 25569) * 86400 * 1000);
            } else {
               date = new Date(String(checkInRaw));
            }
            
            if (date && !isNaN(date.getTime())) {
              isCheckedIn = true;
              checkInDate = date;
            }
          }
        }

        // If check-in is detected, override status to checked_in
        if (isCheckedIn) {
          importedStatus = 'checked_in';
        }

        // All standard column names (normalized: lowercase, no accents)
        const standardFields = [
          // Email aliases
          'email', 'e-mail', 'mail', 'courriel',
          // First name aliases  
          'first_name', 'first name', 'prenom', 'firstname', 'first',
          // Last name aliases
          'last_name', 'last name', 'nom', 'lastname', 'nom de famille', 'last',
          // Phone aliases
          'phone', 'telephone', 'tel', 'mobile', 'portable', 'cell', 'gsm',
          // Company aliases
          'company', 'organisation', 'organization', 'entreprise', 'org', 'societe', 'company name', 'nom de l\'entreprise', 'raison sociale', 'business', 'etablissement',
          // Job title aliases
          'job_title', 'job title', 'designation', 'poste', 'title', 'fonction', 'role', 'position',
          // Country aliases
          'country', 'pays', 'nation', 'state',
          // Attendance type aliases
          'attendance_type', 'attendance type', 'mode', 'participation', 'attendance',
          // Status aliases
          'status', 'statut', 'state', 'etat', 'état',
          // Date aliases
          'date d\'inscription', 'registration_date', 'created_at', 'date inscription', 'inscrit le',
          'check-in', 'checkin', 'date de check-in', 'checked_in_at', 'présence', 'presence', 'checked',
          // Attendee type aliases
          'attendee_type', 'attendee type', 'type', 'participant_type',
          'event_attendee_type_id',
        ];
        
        // Custom fields and comments will be stored in answers JSON
        const answers: Record<string, any> = {};
        for (const [key, value] of Object.entries(rawRow)) {
          const normalizedKey = normalizeKey(key);
          if (!standardFields.includes(normalizedKey) && value !== null && value !== undefined && String(value).trim() !== '') {
            answers[key] = value;
          }
        }

        // Use same logic as create() method
        const { registration, wasRegistrationCreated, wasRestored, incrementCount } = await this.prisma.$transaction(async (tx) => {
          // Upsert attendee
          const existingAttendee = await tx.attendee.findUnique({
            where: {
              org_id_email: {
                org_id: orgId,
                email: attendeeData.email,
              },
            },
          });

          const attendee = await tx.attendee.upsert({
            where: {
              org_id_email: {
                org_id: orgId,
                email: attendeeData.email,
              },
            },
            update: {
              first_name: attendeeData.first_name || undefined,
              last_name: attendeeData.last_name || undefined,
              phone: attendeeData.phone || undefined,
              company: attendeeData.company || undefined,
              job_title: attendeeData.job_title || undefined,
              country: attendeeData.country || undefined,
            },
            create: {
              org_id: orgId,
              email: attendeeData.email,
              first_name: attendeeData.first_name,
              last_name: attendeeData.last_name,
              phone: attendeeData.phone,
              company: attendeeData.company,
              job_title: attendeeData.job_title,
              country: attendeeData.country,
            },
          });

          // Check for duplicate registration
          const existingRegistration = await tx.registration.findUnique({
            where: {
              event_id_attendee_id: {
                event_id: eventId,
                attendee_id: attendee.id,
              },
            },
          });

          // Determine target status
          // Priority: 1. Imported Status, 2. Default to 'pending' (awaiting) if no status provided
          // Note: We ignore auto-approve setting for imports unless explicitly requested, 
          // to avoid accidentally approving everyone when no status column exists.
          const targetStatus = importedStatus || 'awaiting';
          const isTargetApproved = ['approved', 'confirmed', 'checked_in'].includes(targetStatus);
          
          // Map 'checked_in' status to 'approved' for DB, as 'checked_in' is not a valid DB status
          const dbStatus = targetStatus === 'checked_in' ? 'approved' : targetStatus;
          const dbCheckInDate = targetStatus === 'checked_in' ? (checkInDate || new Date()) : null;

          // Determine if we need to check capacity
          let checkCapacity = false;
          let willIncrement = false;

          if (!existingRegistration) {
            // New registration: check capacity if target status consumes a spot
            if (event.capacity && isTargetApproved) {
              checkCapacity = true;
              willIncrement = true;
            }
          } else {
            // Existing registration
            const isExistingApproved = ['approved', 'confirmed', 'checked_in'].includes(existingRegistration.status);
            
            if (existingRegistration.deleted_at) {
              // Restoring
              if (replaceExisting && isTargetApproved) {
                willIncrement = true; 
              }
            } else {
              // Updating
              // If changing from non-approved to approved
              if (replaceExisting && !isExistingApproved && isTargetApproved) {
                checkCapacity = true;
                willIncrement = true;
              }
            }
          }

          if (checkCapacity) {
            // Use local counter instead of DB query for consistency within the loop
            if (currentApprovedCount >= event.capacity) {
              throw new ConflictException('Event is full');
            }
          }

          // Track if this is a registration creation, update, or restoration
          let wasRegistrationCreated = true;
          let wasRestored = false;

          if (existingRegistration) {
            // Check if soft deleted
            if (existingRegistration.deleted_at) {
              if (replaceExisting) {
                console.log(`Restoring registration ${existingRegistration.id} for email ${attendeeData.email}`);
                // Restore and update
                const restoredRegistration = await tx.registration.update({
                  where: { id: existingRegistration.id },
                  data: {
                    deleted_at: null,
                    attendance_mode: attendanceType,
                    event_attendee_type_id: eventAttendeeTypeId,
                    answers: Object.keys(answers).length > 0 ? answers : null,
                    status: dbStatus as any, // Use mapped DB status
                    confirmed_at: isTargetApproved ? new Date() : null,
                    checked_in_at: dbCheckInDate,
                    // Update snapshots with new data
                    snapshot_first_name: attendeeData.first_name,
                    snapshot_last_name: attendeeData.last_name,
                    snapshot_email: attendeeData.email,
                    snapshot_phone: attendeeData.phone,
                    snapshot_company: attendeeData.company,
                    snapshot_job_title: attendeeData.job_title,
                    snapshot_country: attendeeData.country,
                  },
                  include: {
                    attendee: true,
                  },
                });
                wasRegistrationCreated = false;
                wasRestored = true;
                return { registration: restoredRegistration, wasRegistrationCreated, wasRestored, incrementCount: willIncrement };
              } else {
                throw new ConflictException('This attendee was previously deleted from this event (soft delete)');
              }
            }

            if (existingRegistration.status === 'refused' && targetStatus !== 'refused' && !replaceExisting) {
              throw new ForbiddenException('This attendee was previously declined for this event');
            }
            
            if (['awaiting', 'approved', 'confirmed', 'checked_in'].includes(existingRegistration.status)) {
              // Si replaceExisting = true, on met à jour au lieu de throw
              if (replaceExisting) {
                const updatedRegistration = await tx.registration.update({
                  where: { id: existingRegistration.id },
                  data: {
                    attendance_mode: attendanceType,
                    event_attendee_type_id: eventAttendeeTypeId,
                    answers: Object.keys(answers).length > 0 ? answers : null,
                    status: dbStatus as any, // Use mapped DB status
                    confirmed_at: isTargetApproved && !existingRegistration.confirmed_at ? new Date() : existingRegistration.confirmed_at,
                    checked_in_at: dbCheckInDate || existingRegistration.checked_in_at, // Update check-in if provided, else keep existing
                    // Update snapshots with new data
                    snapshot_first_name: attendeeData.first_name,
                    snapshot_last_name: attendeeData.last_name,
                    snapshot_email: attendeeData.email,
                    snapshot_phone: attendeeData.phone,
                    snapshot_company: attendeeData.company,
                    snapshot_job_title: attendeeData.job_title,
                    snapshot_country: attendeeData.country,
                  },
                  include: {
                    attendee: true,
                  },
                });
                wasRegistrationCreated = false;
                return { registration: updatedRegistration, wasRegistrationCreated, wasRestored: false, incrementCount: willIncrement };
              } else {
                throw new ConflictException('This attendee is already registered for this event');
              }
            }
          }

          // Create registration with snapshots and source tracking
          const newRegistration = await tx.registration.create({
            data: {
              org_id: orgId,
              event_id: eventId,
              attendee_id: attendee.id,
              status: dbStatus as any,
              attendance_mode: attendanceType,
              event_attendee_type_id: eventAttendeeTypeId,
              answers: Object.keys(answers).length > 0 ? answers : null,
              invited_at: new Date(),
              confirmed_at: isTargetApproved ? new Date() : null,
              checked_in_at: dbCheckInDate,
              // Source tracking: mark as import
              source: 'import',
              // Snapshot attendee data at time of registration (only provided data)
              snapshot_first_name: attendeeData.first_name,
              snapshot_last_name: attendeeData.last_name,
              snapshot_email: attendeeData.email,
              snapshot_phone: attendeeData.phone,
              snapshot_company: attendeeData.company,
              snapshot_job_title: attendeeData.job_title,
              snapshot_country: attendeeData.country,
            },
            include: {
              attendee: true,
            },
          });

          return { registration: newRegistration, wasRegistrationCreated, wasRestored: false, incrementCount: willIncrement };
        });

        // Update local count if needed
        if (incrementCount) {
          currentApprovedCount++;
        }

        // Count based on whether the REGISTRATION was created, updated, or restored
        if (wasRegistrationCreated) {
          results.created++;
        } else if (wasRestored) {
          results.restored++;
        } else {
          results.updated++;
        }

      } catch (error) {
        const email = row['email'] || row['Email'] || row['E-mail'] || 'Unknown';
        let errorMessage = 'Unknown error';

        if (error instanceof ConflictException) {
          errorMessage = error.message;
        } else if (error instanceof ForbiddenException) {
          errorMessage = error.message;
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }

        console.log(`Import error at row ${rowNumber} for ${email}: ${errorMessage}`);

        results.errors.push({
          row: rowNumber,
          email: String(email),
          error: errorMessage,
        });
        results.skipped++;
      }
    }

    return results;
  }

  /**
   * Bulk delete registrations (Soft Delete)
   */
  async bulkDelete(ids: string[], orgId?: string): Promise<{ deletedCount: number }> {
    const whereClause: any = {
      id: { in: ids },
    };

    // Apply org filtering if provided (not for super admins)
    if (orgId) {
      whereClause.org_id = orgId;
    }

    // Soft delete using updateMany
    const result = await this.prisma.registration.updateMany({
      where: whereClause,
      data: {
        deleted_at: new Date(),
      },
    });

    return { deletedCount: result.count };
  }

  /**
   * Bulk export registrations to CSV or Excel
   */
  async bulkExport(
    ids: string[], 
    orgId?: string, 
    format: string = 'csv'
  ): Promise<{ buffer: Buffer; filename: string }> {
    const whereClause: any = {
      id: { in: ids },
    };

    // Apply org filtering if provided (not for super admins)
    if (orgId) {
      whereClause.org_id = orgId;
    }

    const registrations = await this.prisma.registration.findMany({
      where: whereClause,
      include: {
        attendee: true,
        event: true,
      },
      orderBy: { created_at: 'desc' },
    });

    // Prepare data
    const data = registrations.map((registration) => ({
      'Prénom': registration.attendee?.first_name || '',
      'Nom': registration.attendee?.last_name || '',
      'Email': registration.attendee?.email || '',
      'Téléphone': registration.attendee?.phone || '',
      'Entreprise': registration.attendee?.company || '',
      'Poste': registration.attendee?.job_title || '',
      'Statut': registration.status,
      'Date d\'inscription': registration.created_at ? new Date(registration.created_at) : new Date(),
      'Check-in': registration.checked_in_at ? new Date(registration.checked_in_at) : '',
    }));

    const timestamp = new Date().toISOString().split('T')[0];
    
    if (format === 'excel' || format === 'xlsx') {
      // Generate Excel file using ExcelJS for better features (data validation)
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Inscriptions');

      // Define columns
      worksheet.columns = [
        { header: 'Prénom', key: 'first_name', width: 20 },
        { header: 'Nom', key: 'last_name', width: 20 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Téléphone', key: 'phone', width: 15 },
        { header: 'Entreprise', key: 'company', width: 25 },
        { header: 'Poste', key: 'job_title', width: 20 },
        { header: 'Statut', key: 'status', width: 15 },
        { header: 'Date d\'inscription', key: 'created_at', width: 20 },
        { header: 'Check-in', key: 'check_in', width: 20 },
      ];

      // Add rows
      data.forEach(item => {
        worksheet.addRow({
          first_name: item['Prénom'],
          last_name: item['Nom'],
          email: item['Email'],
          phone: item['Téléphone'],
          company: item['Entreprise'],
          job_title: item['Poste'],
          status: item['Statut'],
          created_at: item['Date d\'inscription'],
          check_in: item['Check-in'],
        });
      });

      // Add Data Validation for Status (Column G) and Dates (Columns H, I)
      // Apply to all data rows + buffer for new entries
      const rowCount = data.length;
      const maxRows = Math.max(rowCount + 100, 1000); // Ensure at least 1000 rows have validation
      
      // Format Date Columns (H and I)
      worksheet.getColumn('H').numFmt = 'dd/mm/yyyy hh:mm';
      worksheet.getColumn('I').numFmt = 'dd/mm/yyyy hh:mm';

      for (let i = 2; i <= maxRows; i++) {
        // Status (G)
        const cellG = worksheet.getCell(`G${i}`);
        cellG.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"Approuvé,En attente,Refusé,Annulé,Présent"'],
          showErrorMessage: true,
          errorStyle: 'error',
          errorTitle: 'Valeur invalide',
          error: 'Veuillez sélectionner une valeur dans la liste.'
        };

        // Registration Date (H)
        const cellH = worksheet.getCell(`H${i}`);
        cellH.dataValidation = {
          type: 'date',
          operator: 'greaterThanOrEqual',
          showErrorMessage: true,
          errorTitle: 'Date invalide',
          error: 'Veuillez entrer une date valide (format JJ/MM/AAAA HH:MM)',
          showInputMessage: true,
          promptTitle: 'Format de date',
          prompt: 'Utilisez le format JJ/MM/AAAA HH:MM',
          allowBlank: true,
          formulae: [new Date(2000, 0, 1)]
        };

        // Check-in (I)
        const cellI = worksheet.getCell(`I${i}`);
        cellI.dataValidation = {
          type: 'date',
          operator: 'greaterThanOrEqual',
          showErrorMessage: true,
          errorTitle: 'Date invalide',
          error: 'Veuillez entrer une date valide (format JJ/MM/AAAA HH:MM)',
          showInputMessage: true,
          promptTitle: 'Format de date',
          prompt: 'Utilisez le format JJ/MM/AAAA HH:MM',
          allowBlank: true,
          formulae: [new Date(2000, 0, 1)]
        };
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const filename = `inscriptions_export_${timestamp}.xlsx`;
      
      return { buffer: Buffer.from(buffer), filename };
    } else {
      // Generate CSV (default)
      const csvHeaders = Object.keys(data[0] || {});
      const csvRows = data.map(row => 
        csvHeaders.map(header => `"${(row[header] || '').toString().replace(/"/g, '""')}"`).join(',')
      );
      const csvContent = [
        csvHeaders.join(','),
        ...csvRows
      ].join('\n');

      const buffer = Buffer.from(csvContent, 'utf-8');
      const filename = `inscriptions_export_${timestamp}.csv`;

      return { buffer, filename };
    }
  }

  /**
   * Generate an Excel template for import
   */
  async generateTemplate() {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Inscriptions');

    // Define columns
    worksheet.columns = [
      { header: 'Prénom', key: 'first_name', width: 20 },
      { header: 'Nom', key: 'last_name', width: 20 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Téléphone', key: 'phone', width: 15 },
      { header: 'Entreprise', key: 'company', width: 25 },
      { header: 'Poste', key: 'job_title', width: 20 },
      { header: 'Pays', key: 'country', width: 15 },
      { header: 'Mode', key: 'attendance_mode', width: 15 },
      { header: 'Statut', key: 'status', width: 15 },
      { header: 'Date d\'inscription', key: 'created_at', width: 20 },
      { header: 'Check-in', key: 'check_in', width: 20 },
    ];

    // Add example row
    worksheet.addRow({
      first_name: 'Jean',
      last_name: 'Dupont',
      email: 'jean.dupont@example.com',
      phone: '+33612345678',
      company: 'Acme Corp',
      job_title: 'Directeur',
      country: 'France',
      attendance_mode: 'Présentiel',
      status: 'En attente',
      created_at: new Date(),
      check_in: '',
    });

    // Apply validation to 1000 rows
    const maxRows = 1000;

    // Format Date Columns (J and K)
    // Force Text format for other columns to avoid auto-formatting issues
    worksheet.getColumn('J').numFmt = 'dd/mm/yyyy hh:mm';
    worksheet.getColumn('K').numFmt = 'dd/mm/yyyy hh:mm';

    for (let i = 2; i <= maxRows; i++) {
      // Mode (H)
      const cellH = worksheet.getCell(`H${i}`);
      cellH.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Présentiel,Distanciel,Hybride"'],
        showErrorMessage: true,
        errorStyle: 'error',
        errorTitle: 'Valeur invalide',
        error: 'Veuillez sélectionner une valeur dans la liste.'
      };

      // Status (I)
      const cellI = worksheet.getCell(`I${i}`);
      cellI.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Approuvé,En attente,Refusé,Annulé,Présent"'],
        showErrorMessage: true,
        errorStyle: 'error',
        errorTitle: 'Valeur invalide',
        error: 'Veuillez sélectionner une valeur dans la liste.'
      };

      // Registration Date (J)
      const cellJ = worksheet.getCell(`J${i}`);
      cellJ.dataValidation = {
        type: 'date',
        operator: 'greaterThanOrEqual',
        showErrorMessage: true,
        errorTitle: 'Date invalide',
        error: 'Veuillez entrer une date valide (format JJ/MM/AAAA HH:MM)',
        showInputMessage: true,
        promptTitle: 'Format de date',
        prompt: 'Utilisez le format JJ/MM/AAAA HH:MM',
        allowBlank: true,
        formulae: [new Date(2000, 0, 1)]
      };

      // Check-in (K)
      const cellK = worksheet.getCell(`K${i}`);
      cellK.dataValidation = {
        type: 'date',
        operator: 'greaterThanOrEqual',
        showErrorMessage: true,
        errorTitle: 'Date invalide',
        error: 'Veuillez entrer une date valide (format JJ/MM/AAAA HH:MM)',
        showInputMessage: true,
        promptTitle: 'Format de date',
        prompt: 'Utilisez le format JJ/MM/AAAA HH:MM',
        allowBlank: true,
        formulae: [new Date(2000, 0, 1)]
      };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `template_inscriptions.xlsx`;
    
    return { buffer: Buffer.from(buffer), filename };
  }

  /**
   * Generate badges for all registrations in an event
   */
  async generateBadgesForEvent(eventId: string, orgId: string | null) {
    // 1. Récupérer l'événement avec son template de badge
    const whereClause: any = { id: eventId };
    if (orgId) {
      whereClause.org_id = orgId;
    }

    const event = await this.prisma.event.findFirst({
      where: whereClause,
      include: {
        settings: {
          include: {
            badgeTemplate: true,
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Événement non trouvé');
    }

    if (!event.settings?.badgeTemplate) {
      throw new BadRequestException(
        'Aucun template de badge configuré pour cet événement',
      );
    }

    // 2. Récupérer toutes les registrations approuvées
    const registrations = await this.prisma.registration.findMany({
      where: {
        event_id: eventId,
        org_id: event.org_id, // Use the event's org_id
        status: 'approved',
      },
      include: {
        attendee: true,
        eventAttendeeType: {
          include: {
            attendeeType: true,
          },
        },
      },
    });

    if (registrations.length === 0) {
      return {
        success: true,
        message: 'Aucune inscription approuvée à traiter',
        generated: 0,
      };
    }

    // 3. Générer les badges pour chaque registration avec PDF et image
    let generatedCount = 0;

    for (const registration of registrations) {
      try {
        // Utiliser le service de génération complet qui génère PDF + image + met à jour les URLs
        await this.badgeGenerationService.generateBadge(registration.id, event.org_id);
        generatedCount++;
      } catch (error) {
        // Log l'erreur mais continue avec les autres
        console.error(`Erreur génération badge pour registration ${registration.id}:`, error);
      }
    }

    return {
      success: true,
      message: `${generatedCount} badge(s) généré(s) avec succès`,
      generated: generatedCount,
    };
  }

  /**
   * Generate badges for selected registrations
   */
  async generateBadgesBulk(
    eventId: string,
    registrationIds: string[],
    orgId: string | null,
  ) {
    // 1. Récupérer l'événement avec son template
    const whereClause: any = { id: eventId };
    if (orgId) {
      whereClause.org_id = orgId;
    }

    const event = await this.prisma.event.findFirst({
      where: whereClause,
      include: {
        settings: {
          include: {
            badgeTemplate: true,
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Événement non trouvé');
    }

    if (!event.settings?.badgeTemplate) {
      throw new BadRequestException(
        'Aucun template de badge configuré pour cet événement',
      );
    }

    // 2. Récupérer les registrations sélectionnées
    const registrationWhere: any = {
      id: { in: registrationIds },
      event_id: eventId,
    };
    
    // Pour SUPER_ADMIN (orgId = null), on ne filtre pas par org_id
    // Pour les autres rôles, on filtre par l'org_id de l'événement
    if (orgId !== null) {
      registrationWhere.org_id = event.org_id;
    }
    
    const registrations = await this.prisma.registration.findMany({
      where: registrationWhere,
      include: {
        attendee: true,
        eventAttendeeType: {
          include: {
            attendeeType: true,
          },
        },
      },
    });

    if (registrations.length === 0) {
      throw new NotFoundException('Aucune inscription trouvée');
    }

    // 3. Générer les badges
    const template = event.settings.badgeTemplate;
    let generatedCount = 0;

    for (const registration of registrations) {
      let html = template.html || '';
      const variables = {
        full_name: `${registration.attendee?.first_name || ''} ${registration.attendee?.last_name || ''}`.trim(),
        first_name: registration.attendee?.first_name || '',
        last_name: registration.attendee?.last_name || '',
        email: registration.attendee?.email || '',
        company: registration.attendee?.company || '',
        job_title: registration.attendee?.job_title || '',
        event_name: event.name,
        attendee_type: registration.eventAttendeeType?.attendeeType?.name || '',
      };

      Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key}}}`, 'gi');
        html = html.replace(regex, value);
      });

      await this.prisma.badge.upsert({
        where: {
          registration_id: registration.id,
        },
        create: {
          org_id: event.org_id, // Use event's org_id
          event_id: eventId,
          registration_id: registration.id,
          badge_template_id: template.id,
          html_snapshot: html,
          css_snapshot: template.css,
          data_snapshot: variables,
          status: 'completed',
          generated_at: new Date(),
        },
        update: {
          badge_template_id: template.id,
          html_snapshot: html,
          css_snapshot: template.css,
          data_snapshot: variables,
          status: 'completed',
          generated_at: new Date(),
          updated_at: new Date(),
        },
      });

      generatedCount++;
    }

    return {
      success: true,
      message: `${generatedCount} badge(s) généré(s) avec succès`,
      generated: generatedCount,
    };
  }

  /**
   * Generate badge for a single registration
   */
  async generateBadge(eventId: string, registrationId: string, orgId: string | null) {
    // Utiliser le BadgeGenerationService pour la génération réelle des badges avec PDF/images
    return this.badgeGenerationService.generateBadge(registrationId, orgId);
  }

  /**
   * Download badge in specified format (PDF, Image, or HTML)
   */
  async downloadBadge(
    eventId: string,
    registrationId: string,
    format: 'pdf' | 'image' | 'html',
    context: RegistrationQueryContext,
    res: Response,
  ) {
    const { scope, orgId } = context;
    
    // Vérifier que l'inscription existe et est accessible
    const whereClause: any = { 
      id: registrationId,
      event_id: eventId,
    };
    
    if (orgId) {
      whereClause.org_id = orgId;
    }

    const registration = await this.prisma.registration.findFirst({
      where: whereClause,
      include: {
        event: {
          include: {
            settings: {
              include: {
                badgeTemplate: true,
              },
            },
          },
        },
      },
    });

    if (!registration) {
      throw new NotFoundException('Inscription non trouvée');
    }

    const event = registration.event;
    if (!event) {
      throw new NotFoundException('Événement non trouvé');
    }

    // Vérifier d'abord si un badge existe déjà
    let badge = await this.prisma.badge.findFirst({
      where: { registration_id: registrationId },
      include: { badgeTemplate: true }
    });

    // Si pas de badge ou si la génération a échoué, générer un nouveau badge
    if (!badge || badge.status !== 'completed' || !badge.pdf_url || !badge.image_url) {
      badge = await this.badgeGenerationService.generateBadge(
        registration.id,
        orgId,
      );
    }

    // Générer et télécharger le badge selon le format demandé
    if (format === 'html') {
      // Récupérer les dimensions du template
      const width = badge.badgeTemplate?.width || 400;
      const height = badge.badgeTemplate?.height || 600;
      
      // Récupérer le HTML généré depuis le badge avec les variables remplies
      // Important : on garde le HTML exact tel que généré par GrapesJS pour préserver le positionnement
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="badge-width" content="${width}">
          <meta name="badge-height" content="${height}">
          <title>Badge - ${registration.snapshot_first_name} ${registration.snapshot_last_name}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            html, body { 
              width: ${width}px; 
              height: ${height}px; 
            }
            ${badge.css_snapshot || badge.badgeTemplate?.css || ''}
          </style>
        </head>
        <body>
          ${badge.html_snapshot || badge.badgeTemplate?.html || ''}
        </body>
        </html>
      `;
      
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `attachment; filename="badge-${registration.id}.html"`);
      return res.send(htmlContent);
    } else {

      // Récupérer l'URL selon le format demandé
      const badgeUrl = format === 'pdf' ? badge.pdf_url : badge.image_url;
      
      if (badgeUrl) {
        try {
          // Télécharger le fichier depuis R2 et le servir directement
          const response = await fetch(badgeUrl);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch badge: ${response.statusText}`);
          }
          
          const buffer = await response.arrayBuffer();
          const contentType = format === 'pdf' ? 'application/pdf' : 'image/png';
          const fileExtension = format === 'pdf' ? 'pdf' : 'png';
          
          res.setHeader('Content-Type', contentType);
          res.setHeader('Content-Disposition', `attachment; filename="badge-${registration.id}.${fileExtension}"`);
          res.setHeader('Content-Length', buffer.byteLength.toString());
          
          return res.send(Buffer.from(buffer));
        } catch (error) {
          this.logger.error(`Erreur lors du téléchargement du badge depuis R2:`, error);
          throw new BadRequestException('Erreur lors du téléchargement du badge');
        }
      } else {
        throw new NotFoundException(`URL du badge ${format} non disponible`);
      }
    }
  }

  /**
   * Generate QR Code for a registration (on-the-fly generation)
   * QR Code contains only the registrationId (UUID)
   */
  async generateQrCode(
    registrationId: string,
    orgId: string | null,
    format: 'png' | 'svg' | 'base64' = 'png',
  ): Promise<Buffer | string> {
    // Validate registration exists
    const where: any = { id: registrationId };
    if (orgId) {
      where.org_id = orgId;
    }

    const registration = await this.prisma.registration.findFirst({
      where,
      select: { id: true, org_id: true },
    });

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    // Generate QR Code with just the UUID
    const qrData = registrationId;

    try {
      if (format === 'base64') {
        return await QRCode.toDataURL(qrData, {
          errorCorrectionLevel: 'M',
          width: 300,
          margin: 2,
        });
      }

      if (format === 'svg') {
        return await QRCode.toString(qrData, { 
          type: 'svg',
          errorCorrectionLevel: 'M',
          width: 300,
          margin: 2,
        });
      }

      // PNG by default
      return await QRCode.toBuffer(qrData, {
        errorCorrectionLevel: 'M',
        width: 300,
        margin: 2,
      });
    } catch (error) {
      throw new BadRequestException(`Failed to generate QR Code: ${error.message}`);
    }
  }

  /**
   * Check-in a registration (scan QR code)
   * Validates eventId to ensure scan is at correct event
   */
  async checkIn(
    registrationId: string,
    orgId: string | null,
    userId: string,
    dto: CheckinRegistrationDto,
  ): Promise<any> {
    // Fetch registration with event and attendee
    const where: any = { id: registrationId };
    if (orgId) {
      where.org_id = orgId;
    }

    const registration = await this.prisma.registration.findFirst({
      where,
      include: {
        event: {
          include: { settings: true },
        },
        attendee: true,
      },
    });

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    // CRITICAL: Validate eventId matches (cross-validation)
    if (dto.eventId !== registration.event_id) {
      throw new BadRequestException(
        `QR Code mismatch: This attendee is registered for a different event. ` +
        `Expected event ${dto.eventId}, but QR code is for event ${registration.event_id}.`
      );
    }

    // Validate registration status
    if (registration.status === 'refused') {
      throw new BadRequestException(
        `Cannot check-in: Registration was refused`
      );
    }

    if (registration.status === 'cancelled') {
      throw new BadRequestException(
        `Cannot check-in: Registration was cancelled`
      );
    }

    // Validate event settings allow check-in
    if (!registration.event.settings?.allow_checkin_out) {
      throw new BadRequestException(
        `Check-in is disabled for this event`
      );
    }

    // Validate not already checked-in
    if (registration.checked_in_at) {
      throw new BadRequestException(
        `Already checked-in at ${new Date(registration.checked_in_at).toLocaleString()}`
      );
    }

    // Perform check-in
    const updated = await this.prisma.registration.update({
      where: { id: registrationId },
      data: {
        checked_in_at: new Date(),
        checked_in_by: userId,
        checkin_location: dto.checkinLocation as any,
      },
      include: {
        attendee: true,
        event: true,
      },
    });

    return {
      success: true,
      message: `${updated.attendee.first_name} ${updated.attendee.last_name} checked-in successfully`,
      registration: updated,
    };
  }

  /**
   * Undo check-in of a registration
   * Validates eventId to ensure operation is at correct event
   */
  async undoCheckIn(
    registrationId: string,
    orgId: string | null,
    userId: string,
    dto: CheckinRegistrationDto,
  ): Promise<any> {
    // Fetch registration with event and attendee
    const where: any = { id: registrationId };
    if (orgId) {
      where.org_id = orgId;
    }

    const registration = await this.prisma.registration.findFirst({
      where,
      include: {
        event: {
          include: { settings: true },
        },
        attendee: true,
      },
    });

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    // CRITICAL: Validate eventId matches (cross-validation)
    if (dto.eventId !== registration.event_id) {
      throw new BadRequestException(
        `Event mismatch: Cannot undo check-in for different event. ` +
        `Expected event ${dto.eventId}, but registration is for event ${registration.event_id}.`
      );
    }

    // Validate registration status
    if (registration.status === 'refused') {
      throw new BadRequestException(
        `Cannot undo check-in: Registration was refused`
      );
    }

    if (registration.status === 'cancelled') {
      throw new BadRequestException(
        `Cannot undo check-in: Registration was cancelled`
      );
    }

    // Validate event settings allow check-in/out
    if (!registration.event.settings?.allow_checkin_out) {
      throw new BadRequestException(
        `Check-in/out is disabled for this event`
      );
    }

    // Validate currently checked-in
    if (!registration.checked_in_at) {
      throw new BadRequestException(
        `Cannot undo: Not currently checked-in`
      );
    }

    // Perform undo check-in
    const updated = await this.prisma.registration.update({
      where: { id: registrationId },
      data: {
        checked_in_at: null,
        checked_in_by: null,
        checkin_location: null,
      },
      include: {
        attendee: true,
        event: true,
      },
    });

    return {
      success: true,
      message: `${updated.attendee.first_name} ${updated.attendee.last_name} check-in undone successfully`,
      registration: updated,
    };
  }

  /**
   * Check-out a registration (when participant leaves the event)
   * Validates eventId and ensures participant is checked-in first
   */
  async checkOut(
    registrationId: string,
    orgId: string | null,
    userId: string,
    dto: { eventId: string; checkoutLocation?: any },
  ): Promise<any> {
    // Fetch registration with event and attendee
    const where: any = { id: registrationId };
    if (orgId) {
      where.org_id = orgId;
    }

    const registration = await this.prisma.registration.findFirst({
      where,
      include: {
        event: {
          include: { settings: true },
        },
        attendee: true,
      },
    });

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    // CRITICAL: Validate eventId matches
    if (dto.eventId !== registration.event_id) {
      throw new BadRequestException(
        `Event mismatch: This attendee is registered for a different event. ` +
        `Expected event ${dto.eventId}, but registration is for event ${registration.event_id}.`
      );
    }

    // Validate registration status
    if (registration.status === 'refused') {
      throw new BadRequestException(
        `Cannot check-out: Registration was refused`
      );
    }

    if (registration.status === 'cancelled') {
      throw new BadRequestException(
        `Cannot check-out: Registration was cancelled`
      );
    }

    // Validate event settings allow check-in/out
    if (!registration.event.settings?.allow_checkin_out) {
      throw new BadRequestException(
        `Check-out is disabled for this event`
      );
    }

    // Validate participant is checked-in first
    if (!registration.checked_in_at) {
      throw new BadRequestException(
        `Cannot check-out: Participant is not checked-in`
      );
    }

    // Validate not already checked-out
    if (registration.checked_out_at) {
      throw new BadRequestException(
        `Already checked-out at ${new Date(registration.checked_out_at).toLocaleString()}`
      );
    }

    // Perform check-out
    const updated = await this.prisma.registration.update({
      where: { id: registrationId },
      data: {
        checked_out_at: new Date(),
        checked_out_by: userId,
        checkout_location: dto.checkoutLocation as any,
      },
      include: {
        attendee: true,
        event: true,
      },
    });

    return {
      success: true,
      message: `${updated.attendee.first_name} ${updated.attendee.last_name} checked-out successfully`,
      registration: updated,
    };
  }

  /**
   * Undo check-out of a registration
   * Validates eventId and ensures participant is checked-out
   */
  async undoCheckOut(
    registrationId: string,
    orgId: string | null,
    userId: string,
    dto: { eventId: string },
  ): Promise<any> {
    // Fetch registration with event and attendee
    const where: any = { id: registrationId };
    if (orgId) {
      where.org_id = orgId;
    }

    const registration = await this.prisma.registration.findFirst({
      where,
      include: {
        event: {
          include: { settings: true },
        },
        attendee: true,
      },
    });

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    // CRITICAL: Validate eventId matches
    if (dto.eventId !== registration.event_id) {
      throw new BadRequestException(
        `Event mismatch: Cannot undo check-out for different event. ` +
        `Expected event ${dto.eventId}, but registration is for event ${registration.event_id}.`
      );
    }

    // Validate registration status
    if (registration.status === 'refused') {
      throw new BadRequestException(
        `Cannot undo check-out: Registration was refused`
      );
    }

    if (registration.status === 'cancelled') {
      throw new BadRequestException(
        `Cannot undo check-out: Registration was cancelled`
      );
    }

    // Validate event settings allow check-in/out
    if (!registration.event.settings?.allow_checkin_out) {
      throw new BadRequestException(
        `Check-out is disabled for this event`
      );
    }

    // Validate currently checked-out
    if (!registration.checked_out_at) {
      throw new BadRequestException(
        `Cannot undo: Not currently checked-out`
      );
    }

    // Perform undo check-out
    const updated = await this.prisma.registration.update({
      where: { id: registrationId },
      data: {
        checked_out_at: null,
        checked_out_by: null,
        checkout_location: null,
      },
      include: {
        attendee: true,
        event: true,
      },
    });

    return {
      success: true,
      message: `${updated.attendee.first_name} ${updated.attendee.last_name} check-out undone successfully`,
      registration: updated,
    };
  }

  /**
   * Get event statistics (total, checked-in, percentage)
   */
  async getEventStats(eventId: string, orgId: string | null): Promise<{
    total: number;
    checkedIn: number;
    percentage: number;
  }> {
    const where: any = {
      event_id: eventId,
      status: 'approved', // Seulement les participants approuvés
    };

    if (orgId) {
      where.org_id = orgId;
    }

    // Compter le total et les checked-in en parallèle
    const [total, checkedIn] = await Promise.all([
      this.prisma.registration.count({ where }),
      this.prisma.registration.count({
        where: {
          ...where,
          checked_in_at: { not: null },
        },
      }),
    ]);

    const percentage = total > 0 ? Math.round((checkedIn / total) * 100) : 0;

    return {
      total,
      checkedIn,
      percentage,
    };
  }

  /**
   * Mark badge as printed for a registration
   */
  async markBadgePrinted(eventId: string, registrationId: string, orgId: string | null) {
    // Vérifier que la registration existe et appartient à l'org
    const whereClause: any = {
      id: registrationId,
      event_id: eventId,
    };

    if (orgId !== null) {
      whereClause.org_id = orgId;
    }

    const registration = await this.prisma.registration.findFirst({
      where: whereClause,
    });

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    // Mettre à jour le compteur d'impression du badge
    const updatedRegistration = await this.prisma.registration.update({
      where: { id: registrationId },
      data: {
        // Optionnel: ajouter un champ pour tracker les impressions
        // print_count: registration.print_count ? registration.print_count + 1 : 1,
        // last_printed_at: new Date(),
      },
      include: {
        attendee: true,
        event: true,
        eventAttendeeType: {
          include: {
            attendeeType: true,
          },
        },
      },
    });

    // Optionnel: Mettre à jour le badge dans la table badges si il existe
    try {
      await this.prisma.badge.updateMany({
        where: {
          registration_id: registrationId,
        },
        data: {
          print_count: {
            increment: 1,
          },
          last_printed_at: new Date(),
        },
      });
    } catch (error) {
      // Ignore si pas de badge trouvé
      this.logger.warn('Could not update badge print count:', error);
    }

    this.logger.log(`Badge marked as printed for registration ${registrationId}`);
    return updatedRegistration;
  }

  /**
   * Bulk update registration status
   */
  async bulkUpdateStatus(
    ids: string[],
    orgId: string | null,
    status: string,
  ): Promise<{ updatedCount: number }> {
    const whereClause: any = {
      id: { in: ids },
    };

    // Apply org filtering if provided (not for super admins)
    if (orgId !== null) {
      whereClause.org_id = orgId;
    }

    // Check capacity if approving
    if (status === 'approved') {
      // Fetch registrations to group by event
      const registrations = await this.prisma.registration.findMany({
        where: whereClause,
        select: { id: true, event_id: true, status: true },
      });

      // Group by event to count how many NEW approvals per event
      const eventCounts: Record<string, number> = {};
      for (const reg of registrations) {
        if (reg.status !== 'approved') {
          eventCounts[reg.event_id] = (eventCounts[reg.event_id] || 0) + 1;
        }
      }

      // Check capacity for each event
      for (const [eventId, countToAdd] of Object.entries(eventCounts)) {
        if (countToAdd === 0) continue;

        const event = await this.prisma.event.findUnique({
          where: { id: eventId },
        });

        if (event && event.capacity) {
          const currentCount = await this.prisma.registration.count({
            where: {
              event_id: eventId,
              org_id: event.org_id,
              status: 'approved',
              deleted_at: null,
            },
          });

          if (currentCount + countToAdd > event.capacity) {
            throw new ConflictException(`Event "${event.name}" is full. Capacity: ${event.capacity}, Current: ${currentCount}, Trying to approve: ${countToAdd}`);
          }
        }
      }
    }

    const updateData: any = {
      status: status as any, // Cast to any to avoid type issues with Prisma enum
    };

    // Set confirmed_at when approving
    if (status === 'approved') {
      updateData.confirmed_at = new Date();
    }

    const result = await this.prisma.registration.updateMany({
      where: whereClause,
      data: updateData,
    });

    return { updatedCount: result.count };
  }

  /**
   * Bulk check-in registrations
   */
  async bulkCheckIn(
    ids: string[],
    orgId: string | null,
    userId: string,
  ): Promise<{ checkedInCount: number; errors: Array<{ id: string; error: string }> }> {
    const whereClause: any = {
      id: { in: ids },
    };

    // Apply org filtering if provided (not for super admins)
    if (orgId !== null) {
      whereClause.org_id = orgId;
    }

    // Fetch registrations to validate
    const registrations = await this.prisma.registration.findMany({
      where: whereClause,
      include: {
        event: {
          include: { settings: true },
        },
      },
    });

    const errors: Array<{ id: string; error: string }> = [];
    const validIds: string[] = [];

    // Validate each registration
    for (const registration of registrations) {
      // Validate status
      if (registration.status === 'refused') {
        errors.push({ id: registration.id, error: 'Registration was refused' });
        continue;
      }

      if (registration.status === 'cancelled') {
        errors.push({ id: registration.id, error: 'Registration was cancelled' });
        continue;
      }

      // Validate event settings
      if (!registration.event.settings?.allow_checkin_out) {
        errors.push({ id: registration.id, error: 'Check-in is disabled for this event' });
        continue;
      }

      // Validate not already checked-in
      if (registration.checked_in_at) {
        errors.push({ id: registration.id, error: 'Already checked-in' });
        continue;
      }

      validIds.push(registration.id);
    }

    // Perform bulk check-in for valid registrations
    const result = await this.prisma.registration.updateMany({
      where: {
        id: { in: validIds },
      },
      data: {
        checked_in_at: new Date(),
        checked_in_by: userId,
      },
    });

    return {
      checkedInCount: result.count,
      errors,
    };
  }
}
