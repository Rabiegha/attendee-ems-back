-- AlterTable
ALTER TABLE "event_settings" ADD COLUMN     "show_description" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "show_title" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "submit_button_color" TEXT,
ADD COLUMN     "submit_button_text" TEXT;
