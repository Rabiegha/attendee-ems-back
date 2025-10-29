import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/db/prisma.service';
import { ListRegistrationsDto } from './dto/list-registrations.dto';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { UpdateRegistrationStatusDto } from './dto/update-registration-status.dto';
import * as XLSX from 'xlsx';
import { Prisma } from '@prisma/client';
import { RegistrationScope } from '../../common/utils/resolve-registration-scope.util';

interface RegistrationQueryContext {
  scope: RegistrationScope;
  orgId?: string;
}

@Injectable()
export class RegistrationsService {
  constructor(private readonly prisma: PrismaService) {}

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

      // Determine status based on auto-approve setting
      const status = event.settings?.registration_auto_approve ? 'approved' : 'awaiting';
      const confirmedAt = status === 'approved' ? new Date() : null;

      // Create registration
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
      },
      include: {
        attendee: true,
      },
    });

    return updated;
  }

  /**
   * Delete a registration
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

    // Delete registration
    await this.prisma.registration.delete({
      where: { id },
    });

    return { message: 'Registration deleted successfully' };
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

          // Create registration
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
   * Bulk delete registrations
   */
  async bulkDelete(ids: string[], orgId?: string): Promise<{ deletedCount: number }> {
    const whereClause: any = {
      id: { in: ids },
    };

    // Apply org filtering if provided (not for super admins)
    if (orgId) {
      whereClause.org_id = orgId;
    }

    const result = await this.prisma.registration.deleteMany({
      where: whereClause,
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
      'ID': registration.id,
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
}
