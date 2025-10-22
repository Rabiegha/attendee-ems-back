-- Add org_id and is_system_role to roles table for organization-specific customizable roles

-- Add nullable org_id column
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "org_id" UUID;

-- Add is_system_role column with default false
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "is_system_role" BOOLEAN NOT NULL DEFAULT false;

-- Add foreign key constraint to organizations
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'roles_org_id_fkey'
    ) THEN
        ALTER TABLE "roles" ADD CONSTRAINT "roles_org_id_fkey" 
        FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Drop old unique index/constraint on code if it exists
DROP INDEX IF EXISTS "roles_code_key";

-- Add new composite unique constraint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'roles_org_id_code_key'
    ) THEN
        ALTER TABLE "roles" ADD CONSTRAINT "roles_org_id_code_key" UNIQUE("org_id", "code");
    END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "roles_org_id_idx" ON "roles"("org_id");
CREATE INDEX IF NOT EXISTS "roles_is_system_role_idx" ON "roles"("is_system_role");

-- Mark existing roles as system templates (they have no org_id)
UPDATE "roles" SET "is_system_role" = true WHERE "org_id" IS NULL;