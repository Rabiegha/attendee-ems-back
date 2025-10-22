-- Enable citext extension if not already enabled
CREATE EXTENSION IF NOT EXISTS citext;

-- CreateTable
CREATE TABLE "attendees" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "default_type_id" UUID,
    "email" CITEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "job_title" TEXT,
    "country" TEXT,
    "metadata" JSONB,
    "labels" TEXT[],
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendee_revisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "attendee_id" UUID NOT NULL,
    "change_type" TEXT NOT NULL,
    "source" TEXT,
    "snapshot" JSONB NOT NULL,
    "changed_by" UUID,
    "note" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendee_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendees_org_id_idx" ON "attendees"("org_id");

-- CreateIndex
CREATE INDEX "attendees_default_type_id_idx" ON "attendees"("default_type_id");

-- CreateIndex
CREATE INDEX "attendees_email_idx" ON "attendees"("email");

-- CreateIndex
CREATE UNIQUE INDEX "attendees_org_id_email_key" ON "attendees"("org_id", "email");

-- CreateIndex
CREATE INDEX "attendee_revisions_org_id_attendee_id_idx" ON "attendee_revisions"("org_id", "attendee_id");

-- CreateIndex
CREATE INDEX "attendee_revisions_attendee_id_idx" ON "attendee_revisions"("attendee_id");

-- AddForeignKey
ALTER TABLE "attendees" ADD CONSTRAINT "attendees_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendee_revisions" ADD CONSTRAINT "attendee_revisions_attendee_id_fkey" FOREIGN KEY ("attendee_id") REFERENCES "attendees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
