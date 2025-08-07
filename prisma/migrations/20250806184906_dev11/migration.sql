/*
  Warnings:

  - You are about to drop the column `duration` on the `Workout` table. All the data in the column will be lost.
  - You are about to drop the column `time` on the `Workout` table. All the data in the column will be lost.
  - Added the required column `startDate` to the `Workout` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."ChatHistory" ADD COLUMN     "accepted" TEXT,
ADD COLUMN     "type" TEXT;

-- AlterTable
ALTER TABLE "public"."Workout" DROP COLUMN "duration",
DROP COLUMN "time",
ADD COLUMN     "actualDuration" INTEGER,
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "idealDuration" INTEGER,
ADD COLUMN     "startDate" TIMESTAMP(3) NOT NULL;
