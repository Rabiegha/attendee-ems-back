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
      where.attendance_type = dto.attendanceType;
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
    });

    if (!registration) {
      throw new NotFoundException('Registration not found');
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

      // Check capacity
      if (event.capacity) {
        const currentCount = await tx.registration.count({
          where: {
            event_id: eventId,
            org_id: orgId,
            status: { in: ['awaiting', 'approved'] },
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

      // Determine status based on auto-approve setting or source
      // Mobile registrations are always auto-approved
      const isMobileRegistration = dto.source === 'mobile_app';
      const status = (event.settings?.registration_auto_approve || isMobileRegistration) ? 'approved' : 'awaiting';
      const confirmedAt = status === 'approved' ? new Date() : null;

      // Create registration with snapshot of attendee data
      const registration = await tx.registration.create({
        data: {
          org_id: orgId,
          event_id: eventId,
          attendee_id: attendee.id,
          status,
          attendance_type: dto.attendance_type,
          event_attendee_type_id: dto.event_attendee_type_id,
          answers: dto.answers ? (dto.answers as Prisma.InputJsonValue) : null,
          invited_at: new Date(),
          confirmed_at: confirmedAt,
          
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
        attendance_type: dto.attendance_type,
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

    const results = {
      total_rows: rows.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as Array<{ row: number; email: string; error: string }>,
    };

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // Excel row number (1-based + header)

      try {
        // Extract required fields using all possible column name variations
        const emailAliases = ['email', 'Email', 'E-mail', 'e-mail', 'mail', 'Mail'];
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
        const findValue = (aliases: string[]) => 
          aliases.map(alias => row[alias]).find(val => val !== undefined && val !== null && val !== '');

        // Extract attendee data with comprehensive alias support
        const attendeeData = {
          email: String(email).toLowerCase().trim(),
          first_name: findValue(['first_name', 'First Name', 'Prénom', 'prénom', 'prenom', 'firstname', 'FirstName']),
          last_name: findValue(['last_name', 'Last Name', 'Nom', 'nom', 'lastname', 'LastName']),
          phone: findValue(['phone', 'Phone', 'Téléphone', 'téléphone', 'telephone', 'Tel', 'tel']),
          company: findValue(['company', 'Company', 'Organisation', 'organisation', 'Entreprise', 'entreprise', 'org']),
          job_title: findValue(['job_title', 'Job Title', 'Désignation', 'désignation', 'Poste', 'poste', 'title']),
          country: findValue(['country', 'Country', 'Pays', 'pays']),
        };

        // Extract registration data
        let attendanceType = findValue(['attendance_type', 'Attendance Type', 'Mode', 'mode']) || 'onsite';
        
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
        
        const eventAttendeeTypeId = row['event_attendee_type_id'] || null;

        // All standard column names (these won't be stored in answers JSON)
        const standardFields = [
          // Email aliases
          'email', 'Email', 'E-mail', 'e-mail', 'mail', 'Mail',
          // First name aliases  
          'first_name', 'First Name', 'Prénom', 'prénom', 'prenom', 'firstname', 'FirstName',
          // Last name aliases
          'last_name', 'Last Name', 'Nom', 'nom', 'lastname', 'LastName',
          // Phone aliases
          'phone', 'Phone', 'Téléphone', 'téléphone', 'telephone', 'Tel', 'tel',
          // Company aliases
          'company', 'Company', 'Organisation', 'organisation', 'Entreprise', 'entreprise', 'org',
          // Job title aliases
          'job_title', 'Job Title', 'Désignation', 'désignation', 'Poste', 'poste', 'title',
          // Country aliases
          'country', 'Country', 'Pays', 'pays',
          // Attendance type aliases
          'attendance_type', 'Attendance Type', 'Mode', 'mode',
          // Attendee type aliases
          'attendee_type', 'Attendee Type', 'Type', 'type', 'participant_type',
          'event_attendee_type_id',
        ];
        
        // Custom fields and comments will be stored in answers JSON
        const answers: Record<string, any> = {};
        for (const [key, value] of Object.entries(row)) {
          if (!standardFields.includes(key) && value !== null && value !== undefined && value !== '') {
            answers[key] = value;
          }
        }

        // Use same logic as create() method
        const registration = await this.prisma.$transaction(async (tx) => {
          // Check capacity
          if (event.capacity) {
            const currentCount = await tx.registration.count({
              where: {
                event_id: eventId,
                org_id: orgId,
                status: { in: ['awaiting', 'approved'] },
              },
            });

            if (currentCount >= event.capacity) {
              throw new ConflictException('Event is full');
            }
          }

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

          // Track if this is a registration creation or update
          let wasRegistrationCreated = true;

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
                    attendance_type: attendanceType,
                    event_attendee_type_id: eventAttendeeTypeId,
                    answers: Object.keys(answers).length > 0 ? answers : null,
                    status: shouldAutoApprove ? 'approved' : 'awaiting', // Reset status on restore
                    confirmed_at: shouldAutoApprove ? new Date() : null,
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
                return { registration: restoredRegistration, wasRegistrationCreated };
              } else {
                throw new ConflictException('This attendee was previously deleted from this event (soft delete)');
              }
            }

            if (existingRegistration.status === 'refused') {
              throw new ForbiddenException('This attendee was previously declined for this event');
            }
            if (['awaiting', 'approved'].includes(existingRegistration.status)) {
              // Si replaceExisting = true, on met à jour au lieu de throw
              if (replaceExisting) {
                const updatedRegistration = await tx.registration.update({
                  where: { id: existingRegistration.id },
                  data: {
                    attendance_type: attendanceType,
                    event_attendee_type_id: eventAttendeeTypeId,
                    answers: Object.keys(answers).length > 0 ? answers : null,
                    status: shouldAutoApprove ? 'approved' : existingRegistration.status,
                    confirmed_at: shouldAutoApprove && !existingRegistration.confirmed_at ? new Date() : existingRegistration.confirmed_at,
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
                return { registration: updatedRegistration, wasRegistrationCreated };
              } else {
                throw new ConflictException('This attendee is already registered for this event');
              }
            }
          }

          // Determine status
          const status = shouldAutoApprove ? 'approved' : 'awaiting';
          const confirmedAt = status === 'approved' ? new Date() : null;

          // Create registration with snapshots and source tracking
          const newRegistration = await tx.registration.create({
            data: {
              org_id: orgId,
              event_id: eventId,
              attendee_id: attendee.id,
              status,
              attendance_type: attendanceType,
              event_attendee_type_id: eventAttendeeTypeId,
              answers: Object.keys(answers).length > 0 ? answers : null,
              invited_at: new Date(),
              confirmed_at: confirmedAt,
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

          return { registration: newRegistration, wasRegistrationCreated };
        });

        // Count based on whether the REGISTRATION was created or updated
        if (registration.wasRegistrationCreated) {
          results.created++;
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
      'Événement': registration.event?.name || '',
      'Statut': registration.status,
      'Date d\'inscription': registration.created_at?.toISOString().split('T')[0] || '',
      'Date d\'invitation': registration.invited_at?.toISOString().split('T')[0] || '',
      'Date de confirmation': registration.confirmed_at?.toISOString().split('T')[0] || '',
    }));

    const timestamp = new Date().toISOString().split('T')[0];
    
    if (format === 'excel' || format === 'xlsx') {
      // Generate Excel file
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Inscriptions');
      
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
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
