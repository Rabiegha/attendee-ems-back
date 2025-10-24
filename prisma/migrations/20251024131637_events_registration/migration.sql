/*
  Warnings:

  - A unique constraint covering the columns `[id,org_id]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('physical', 'online', 'hybrid');

-- CreateEnum
CREATE TYPE "AttendanceMode" AS ENUM ('onsite', 'online', 'hybrid');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('awaiting', 'approved', 'refused', 'cancelled');

-- CreateTable
CREATE TABLE "org_activity_sectors" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color_hex" TEXT,
    "text_color_hex" TEXT,
    "icon" TEXT,
    "parent_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_activity_sectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_event_types" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color_hex" TEXT,
    "text_color_hex" TEXT,
    "icon" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_event_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendee_types" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color_hex" TEXT,
    "text_color_hex" TEXT,
    "icon" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendee_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badge_templates" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "template_data" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "badge_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_senders" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "from_name" TEXT NOT NULL,
    "from_email" CITEXT NOT NULL,
    "reply_to_email" CITEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_senders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "org_activity_sector_id" UUID,
    "org_event_type_id" UUID,
    "description" TEXT,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "status" "EventStatus" NOT NULL DEFAULT 'draft',
    "capacity" INTEGER,
    "location_type" "LocationType" NOT NULL DEFAULT 'physical',
    "address_formatted" TEXT,
    "address_street" TEXT,
    "address_city" TEXT,
    "address_region" TEXT,
    "address_postal_code" TEXT,
    "address_country" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "place_id" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_settings" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "website_url" TEXT,
    "logo_asset_id" TEXT,
    "attendance_mode" "AttendanceMode" NOT NULL DEFAULT 'onsite',
    "registration_auto_approve" BOOLEAN NOT NULL DEFAULT false,
    "allow_checkin_out" BOOLEAN NOT NULL DEFAULT true,
    "has_event_reminder" BOOLEAN NOT NULL DEFAULT false,
    "badge_template_id" UUID,
    "public_token" TEXT NOT NULL,
    "registration_fields" JSONB,
    "auto_transition_to_active" BOOLEAN NOT NULL DEFAULT true,
    "auto_transition_to_completed" BOOLEAN NOT NULL DEFAULT true,
    "extra" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_settings" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "email_sender_id" UUID,
    "confirmation_enabled" BOOLEAN NOT NULL DEFAULT false,
    "confirmation_subject" TEXT,
    "confirmation_body" TEXT,
    "reminder_enabled" BOOLEAN NOT NULL DEFAULT false,
    "reminder_subject" TEXT,
    "reminder_body" TEXT,
    "reminder_hours_before" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_attendee_types" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "attendee_type_id" UUID NOT NULL,
    "capacity" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_attendee_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_attendee_type_badges" (
    "event_attendee_type_id" UUID NOT NULL,
    "badge_template_id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_attendee_type_badges_pkey" PRIMARY KEY ("event_attendee_type_id","badge_template_id")
);

-- CreateTable
CREATE TABLE "registrations" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "attendee_id" UUID NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'awaiting',
    "attendance_type" "AttendanceMode" NOT NULL DEFAULT 'onsite',
    "answers" JSONB,
    "event_attendee_type_id" UUID,
    "badge_template_id" UUID,
    "invited_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badges" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "registration_id" UUID NOT NULL,
    "badge_template_id" UUID NOT NULL,
    "badge_data" JSONB,
    "qr_code_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badge_prints" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "badge_id" UUID NOT NULL,
    "printed_by" UUID,
    "printed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "badge_prints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subevents" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subevents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_scans" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "scanned_by" UUID NOT NULL,
    "attendee_data" JSONB NOT NULL,
    "scanned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presence_visits" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "registration_id" UUID NOT NULL,
    "checked_in_at" TIMESTAMP(3) NOT NULL,
    "checked_out_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presence_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_access" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "reason" TEXT,
    "granted_by" UUID,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "org_activity_sectors_org_id_parent_id_sort_order_idx" ON "org_activity_sectors"("org_id", "parent_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "org_activity_sectors_org_id_code_key" ON "org_activity_sectors"("org_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "org_activity_sectors_id_org_id_key" ON "org_activity_sectors"("id", "org_id");

-- CreateIndex
CREATE INDEX "org_event_types_org_id_sort_order_idx" ON "org_event_types"("org_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "org_event_types_org_id_code_key" ON "org_event_types"("org_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "org_event_types_id_org_id_key" ON "org_event_types"("id", "org_id");

-- CreateIndex
CREATE INDEX "attendee_types_org_id_sort_order_idx" ON "attendee_types"("org_id", "sort_order");

-- CreateIndex
CREATE INDEX "attendee_types_org_id_name_idx" ON "attendee_types"("org_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "attendee_types_org_id_code_key" ON "attendee_types"("org_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "attendee_types_id_org_id_key" ON "attendee_types"("id", "org_id");

-- CreateIndex
CREATE INDEX "badge_templates_org_id_idx" ON "badge_templates"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "badge_templates_org_id_code_key" ON "badge_templates"("org_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "badge_templates_id_org_id_key" ON "badge_templates"("id", "org_id");

-- CreateIndex
CREATE INDEX "email_senders_org_id_idx" ON "email_senders"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_senders_org_id_from_email_key" ON "email_senders"("org_id", "from_email");

-- CreateIndex
CREATE UNIQUE INDEX "email_senders_id_org_id_key" ON "email_senders"("id", "org_id");

-- CreateIndex
CREATE INDEX "events_org_id_idx" ON "events"("org_id");

-- CreateIndex
CREATE INDEX "events_org_id_start_at_idx" ON "events"("org_id", "start_at");

-- CreateIndex
CREATE INDEX "events_org_id_status_idx" ON "events"("org_id", "status");

-- CreateIndex
CREATE INDEX "events_org_id_org_activity_sector_id_idx" ON "events"("org_id", "org_activity_sector_id");

-- CreateIndex
CREATE INDEX "events_org_id_org_event_type_id_idx" ON "events"("org_id", "org_event_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "events_id_org_id_key" ON "events"("id", "org_id");

-- CreateIndex
CREATE UNIQUE INDEX "events_org_id_code_key" ON "events"("org_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "event_settings_event_id_key" ON "event_settings"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_settings_public_token_key" ON "event_settings"("public_token");

-- CreateIndex
CREATE INDEX "event_settings_org_id_event_id_idx" ON "event_settings"("org_id", "event_id");

-- CreateIndex
CREATE INDEX "event_settings_public_token_idx" ON "event_settings"("public_token");

-- CreateIndex
CREATE UNIQUE INDEX "event_settings_event_id_org_id_key" ON "event_settings"("event_id", "org_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_settings_event_id_key" ON "email_settings"("event_id");

-- CreateIndex
CREATE INDEX "email_settings_org_id_event_id_idx" ON "email_settings"("org_id", "event_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_settings_event_id_org_id_key" ON "email_settings"("event_id", "org_id");

-- CreateIndex
CREATE INDEX "event_attendee_types_org_id_event_id_sort_order_idx" ON "event_attendee_types"("org_id", "event_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "event_attendee_types_id_event_id_org_id_key" ON "event_attendee_types"("id", "event_id", "org_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_attendee_types_event_id_attendee_type_id_key" ON "event_attendee_types"("event_id", "attendee_type_id");

-- CreateIndex
CREATE INDEX "event_attendee_type_badges_org_id_idx" ON "event_attendee_type_badges"("org_id");

-- CreateIndex
CREATE INDEX "registrations_org_id_event_id_status_idx" ON "registrations"("org_id", "event_id", "status");

-- CreateIndex
CREATE INDEX "registrations_org_id_attendee_id_idx" ON "registrations"("org_id", "attendee_id");

-- CreateIndex
CREATE INDEX "registrations_org_id_event_id_event_attendee_type_id_idx" ON "registrations"("org_id", "event_id", "event_attendee_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "registrations_event_id_attendee_id_key" ON "registrations"("event_id", "attendee_id");

-- CreateIndex
CREATE UNIQUE INDEX "registrations_id_event_id_org_id_key" ON "registrations"("id", "event_id", "org_id");

-- CreateIndex
CREATE INDEX "badges_org_id_registration_id_idx" ON "badges"("org_id", "registration_id");

-- CreateIndex
CREATE UNIQUE INDEX "badges_id_org_id_key" ON "badges"("id", "org_id");

-- CreateIndex
CREATE INDEX "badge_prints_org_id_badge_id_idx" ON "badge_prints"("org_id", "badge_id");

-- CreateIndex
CREATE INDEX "badge_prints_printed_at_idx" ON "badge_prints"("printed_at");

-- CreateIndex
CREATE INDEX "subevents_org_id_event_id_idx" ON "subevents"("org_id", "event_id");

-- CreateIndex
CREATE UNIQUE INDEX "subevents_id_org_id_key" ON "subevents"("id", "org_id");

-- CreateIndex
CREATE INDEX "partner_scans_org_id_event_id_idx" ON "partner_scans"("org_id", "event_id");

-- CreateIndex
CREATE INDEX "partner_scans_scanned_at_idx" ON "partner_scans"("scanned_at");

-- CreateIndex
CREATE INDEX "presence_visits_org_id_registration_id_idx" ON "presence_visits"("org_id", "registration_id");

-- CreateIndex
CREATE INDEX "presence_visits_checked_in_at_idx" ON "presence_visits"("checked_in_at");

-- CreateIndex
CREATE INDEX "event_access_org_id_user_id_idx" ON "event_access"("org_id", "user_id");

-- CreateIndex
CREATE INDEX "event_access_org_id_event_id_idx" ON "event_access"("org_id", "event_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_access_org_id_event_id_user_id_key" ON "event_access"("org_id", "event_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_id_org_id_key" ON "users"("id", "org_id");

-- AddForeignKey
ALTER TABLE "org_activity_sectors" ADD CONSTRAINT "org_activity_sectors_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_activity_sectors" ADD CONSTRAINT "org_activity_sectors_parent_id_org_id_fkey" FOREIGN KEY ("parent_id", "org_id") REFERENCES "org_activity_sectors"("id", "org_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "org_event_types" ADD CONSTRAINT "org_event_types_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendee_types" ADD CONSTRAINT "attendee_types_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "badge_templates" ADD CONSTRAINT "badge_templates_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_senders" ADD CONSTRAINT "email_senders_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_org_activity_sector_id_org_id_fkey" FOREIGN KEY ("org_activity_sector_id", "org_id") REFERENCES "org_activity_sectors"("id", "org_id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_org_event_type_id_org_id_fkey" FOREIGN KEY ("org_event_type_id", "org_id") REFERENCES "org_event_types"("id", "org_id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "event_settings" ADD CONSTRAINT "event_settings_event_id_org_id_fkey" FOREIGN KEY ("event_id", "org_id") REFERENCES "events"("id", "org_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "event_settings" ADD CONSTRAINT "event_settings_badge_template_id_org_id_fkey" FOREIGN KEY ("badge_template_id", "org_id") REFERENCES "badge_templates"("id", "org_id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "email_settings" ADD CONSTRAINT "email_settings_event_id_org_id_fkey" FOREIGN KEY ("event_id", "org_id") REFERENCES "events"("id", "org_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "email_settings" ADD CONSTRAINT "email_settings_email_sender_id_org_id_fkey" FOREIGN KEY ("email_sender_id", "org_id") REFERENCES "email_senders"("id", "org_id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "event_attendee_types" ADD CONSTRAINT "event_attendee_types_event_id_org_id_fkey" FOREIGN KEY ("event_id", "org_id") REFERENCES "events"("id", "org_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "event_attendee_types" ADD CONSTRAINT "event_attendee_types_attendee_type_id_org_id_fkey" FOREIGN KEY ("attendee_type_id", "org_id") REFERENCES "attendee_types"("id", "org_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "event_attendee_type_badges" ADD CONSTRAINT "event_attendee_type_badges_event_attendee_type_id_fkey" FOREIGN KEY ("event_attendee_type_id") REFERENCES "event_attendee_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_attendee_type_badges" ADD CONSTRAINT "event_attendee_type_badges_badge_template_id_org_id_fkey" FOREIGN KEY ("badge_template_id", "org_id") REFERENCES "badge_templates"("id", "org_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_event_id_org_id_fkey" FOREIGN KEY ("event_id", "org_id") REFERENCES "events"("id", "org_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_attendee_id_org_id_fkey" FOREIGN KEY ("attendee_id", "org_id") REFERENCES "attendees"("id", "org_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_event_attendee_type_id_fkey" FOREIGN KEY ("event_attendee_type_id") REFERENCES "event_attendee_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_badge_template_id_org_id_fkey" FOREIGN KEY ("badge_template_id", "org_id") REFERENCES "badge_templates"("id", "org_id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "badges" ADD CONSTRAINT "badges_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "badges" ADD CONSTRAINT "badges_badge_template_id_org_id_fkey" FOREIGN KEY ("badge_template_id", "org_id") REFERENCES "badge_templates"("id", "org_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "badge_prints" ADD CONSTRAINT "badge_prints_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subevents" ADD CONSTRAINT "subevents_event_id_org_id_fkey" FOREIGN KEY ("event_id", "org_id") REFERENCES "events"("id", "org_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "partner_scans" ADD CONSTRAINT "partner_scans_event_id_org_id_fkey" FOREIGN KEY ("event_id", "org_id") REFERENCES "events"("id", "org_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "presence_visits" ADD CONSTRAINT "presence_visits_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_access" ADD CONSTRAINT "event_access_event_id_org_id_fkey" FOREIGN KEY ("event_id", "org_id") REFERENCES "events"("id", "org_id") ON DELETE CASCADE ON UPDATE NO ACTION;
