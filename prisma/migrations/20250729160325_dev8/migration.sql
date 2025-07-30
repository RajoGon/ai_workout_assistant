CREATE EXTENSION IF NOT EXISTS vector;
/*
  Warnings:

  - Changed the type of `embedding` on the `WorkoutEmbedding` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "public"."WorkoutEmbedding" DROP COLUMN "embedding",
ADD COLUMN     "embedding" vector(768) NOT NULL;
