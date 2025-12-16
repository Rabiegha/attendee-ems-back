/*
  Warnings:

  - You are about to drop the column `attendance_type` on the `registrations` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "event_attendee_types" ADD COLUMN     "color_hex" TEXT,
ADD COLUMN     "text_color_hex" TEXT;

-- AlterTable
ALTER TABLE "registrations" DROP COLUMN "attendance_type",
ADD COLUMN     "attendance_mode" "AttendanceMode" NOT NULL DEFAULT 'onsite';
