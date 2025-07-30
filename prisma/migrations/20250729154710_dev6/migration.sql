-- CreateTable
CREATE TABLE "public"."WorkoutEmbedding" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" DOUBLE PRECISION[],
    "metadata" JSONB,
    "workoutId" TEXT NOT NULL,

    CONSTRAINT "WorkoutEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutEmbedding_workoutId_key" ON "public"."WorkoutEmbedding"("workoutId");

-- AddForeignKey
ALTER TABLE "public"."WorkoutEmbedding" ADD CONSTRAINT "WorkoutEmbedding_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "public"."Workout"("workoutId") ON DELETE RESTRICT ON UPDATE CASCADE;
