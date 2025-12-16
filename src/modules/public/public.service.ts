import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/db/prisma.service';
import { PublicRegisterDto } from './dto/public-register.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class PublicService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get event information by public token (safe fields only)
   */
  async getEventByPublicToken(publicToken: string) {
    // Try to find by public_token first
    let eventSettings = await this.prisma.eventSetting.findUnique({
      where: { public_token: publicToken },
      include: {
        event: {
          include: {
            activitySector: true,
            eventType: true,
          },
        },
      },
    });

    // If not found, try to find by event ID (for backward compatibility)
    if (!eventSettings) {
      const event = await this.prisma.event.findUnique({
        where: { id: publicToken },
        include: {
          activitySector: true,
          eventType: true,
          settings: true,
        },
      });

      if (event && event.settings) {
        eventSettings = {
          ...event.settings,
          event: event,
        } as any;
      }
    }

    if (!eventSettings || !eventSettings.event) {
      throw new NotFoundException('Event not found');
    }

    const { event } = eventSettings;
    const settings = eventSettings as any; // Type cast pour nouveaux champs

    // Return safe fields only (no internal IDs, no sensitive data)
    return {
      code: event.code,
      name: event.name,
      description: event.description,
      start_at: event.start_at,
      end_at: event.end_at,
      timezone: event.timezone,
      status: event.status,
      capacity: event.capacity,
      location_type: event.location_type,
      address_formatted: event.address_formatted,
      address_city: event.address_city,
      address_country: event.address_country,
      latitude: event.latitude,
      longitude: event.longitude,
      website_url: settings.website_url,
      attendance_mode: settings.attendance_mode,
      registration_fields: settings.registration_fields,
      submit_button_text: settings.submit_button_text,
      submit_button_color: settings.submit_button_color,
      show_title: settings.show_title,
      show_description: settings.show_description,
      is_dark_mode: settings.is_dark_mode,
      activity_sector: event.activitySector
        ? {
            code: event.activitySector.code,
            name: event.activitySector.name,
            color_hex: event.activitySector.color_hex,
          }
        : null,
      event_type: event.eventType
        ? {
            code: event.eventType.code,
            name: event.eventType.name,
            color_hex: event.eventType.color_hex,
          }
        : null,
    };
  }

  /**
   * Get event attendee types by public token
   */
  async getEventAttendeeTypesByPublicToken(publicToken: string) {
    // Try to find by public_token first
    let eventId: string | null = null;
    
    const eventSetting = await this.prisma.eventSetting.findUnique({
      where: { public_token: publicToken },
      select: { event_id: true },
    });

    if (eventSetting) {
      eventId = eventSetting.event_id;
    } else {
      // Fallback: try to find by event ID
      const event = await this.prisma.event.findUnique({
        where: { id: publicToken },
        select: { id: true },
      });
      if (event) {
        eventId = event.id;
      }
    }

    if (!eventId) {
      throw new NotFoundException('Event not found');
    }

    // Fetch attendee types linked to this event
    const eventAttendeeTypes = await this.prisma.eventAttendeeType.findMany({
      where: { event_id: eventId },
      include: {
        attendeeType: {
          select: {
            id: true,
            name: true,
            color_hex: true,
            code: true,
          },
        },
      },
    });

    return eventAttendeeTypes;
  }

  /**
   * Public registration endpoint
   * - Upserts attendee by (org_id, email)
   * - Checks capacity
   * - Checks for duplicate registrations
   * - Auto-approves if enabled
   */
  async registerToEvent(publicToken: string, dto: PublicRegisterDto) {
    return this.prisma.$transaction(async (tx) => {
      // Get event and settings - try public_token first, then event ID
      let eventSettings = await tx.eventSetting.findUnique({
        where: { public_token: publicToken },
        include: {
          event: true,
        },
      });

      // If not found, try by event ID
      if (!eventSettings) {
        const event = await tx.event.findUnique({
          where: { id: publicToken },
          include: {
            settings: true,
          },
        });

        if (event && event.settings) {
          eventSettings = {
            ...event.settings,
            event: event,
          } as any;
        }
      }

      if (!eventSettings || !eventSettings.event) {
        throw new NotFoundException('Event not found');
      }

      const { event } = eventSettings;
      const orgId = event.org_id;

      // Check if event is published
      if (event.status !== 'published') {
        throw new ForbiddenException('Event is not open for registration');
      }

      // Upsert attendee
      console.log(`[PublicService] Registering email: ${dto.attendee.email} for event: ${event.id}`);
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
      console.log(`[PublicService] Attendee ID: ${attendee.id}`);

      // Check for duplicate registration
      const existingRegistration = await tx.registration.findUnique({
        where: {
          event_id_attendee_id: {
            event_id: event.id,
            attendee_id: attendee.id,
          },
        },
      });

      if (existingRegistration) {
        console.log(`[PublicService] Found existing registration: ${existingRegistration.id} with status: ${existingRegistration.status}`);
        if (existingRegistration.status === 'refused') {
          throw new ForbiddenException('Your registration was previously declined');
        }
        if (['awaiting', 'approved'].includes(existingRegistration.status)) {
          throw new ConflictException('You are already registered for this event');
        }
      } else {
        console.log(`[PublicService] No existing registration found for attendee ${attendee.id}`);
      }

      // Determine status based on auto-approve setting
      const status = eventSettings.registration_auto_approve ? 'approved' : 'awaiting';
      const confirmedAt = status === 'approved' ? new Date() : null;

      // Check capacity only if we are trying to approve the registration
      if (event.capacity && status === 'approved') {
        const currentCount = await tx.registration.count({
          where: {
            event_id: event.id,
            org_id: orgId,
            status: 'approved',
            deleted_at: null,
          },
        });
        console.log(`[PublicService] Capacity check: ${currentCount}/${event.capacity}`);

        if (currentCount >= event.capacity) {
          throw new ConflictException('Event is full');
        }
      }

      // Create registration with snapshot
      const registration = await tx.registration.create({
        data: {
          org_id: orgId,
          event_id: event.id,
          attendee_id: attendee.id,
          status,
          attendance_mode: dto.attendance_type,
          event_attendee_type_id: dto.event_attendee_type_id,
          answers: dto.answers ? (dto.answers as Prisma.InputJsonValue) : null,
          invited_at: new Date(),
          confirmed_at: confirmedAt,
          
          // Source et snapshot
          source: dto.source || 'public_form',
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

      return {
        message: status === 'approved' 
          ? 'Registration confirmed successfully' 
          : 'Registration submitted and awaiting approval',
        registration: {
          id: registration.id,
          status: registration.status,
          attendance_type: registration.attendance_mode,
          confirmed_at: registration.confirmed_at,
          attendee: {
            email: registration.attendee.email,
            first_name: registration.attendee.first_name,
            last_name: registration.attendee.last_name,
          },
        },
      };
    });
  }
}
