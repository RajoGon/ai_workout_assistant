-- CreateTable
CREATE TABLE "public"."User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "userId" TEXT NOT NULL,
    "authId" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Workout" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "type" VARCHAR(255) NOT NULL,
    "distance" INTEGER,
    "idealDuration" INTEGER,
    "actualDuration" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "embeddingGenerated" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "workoutId" TEXT NOT NULL,

    CONSTRAINT "Workout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WorkoutEmbedding" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(768) NOT NULL,
    "metadata" JSONB,
    "workoutId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "WorkoutEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChatHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "type" TEXT,
    "accepted" TEXT,
    "message" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChatIntent" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "workoutId" TEXT,
    "userId" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "intentType" TEXT NOT NULL,
    "fulfilled" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "missingFields" TEXT[],
    "optionalFields" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_userId_key" ON "public"."User"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Workout_workoutId_key" ON "public"."Workout"("workoutId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutEmbedding_workoutId_key" ON "public"."WorkoutEmbedding"("workoutId");

-- CreateIndex
CREATE INDEX "ChatHistory_userId_chatId_idx" ON "public"."ChatHistory"("userId", "chatId");

-- CreateIndex
CREATE INDEX "ChatHistory_chatId_createdAt_idx" ON "public"."ChatHistory"("chatId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatIntent_intentId_key" ON "public"."ChatIntent"("intentId");

-- CreateIndex
CREATE INDEX "ChatIntent_chatId_idx" ON "public"."ChatIntent"("chatId");

-- CreateIndex
CREATE INDEX "ChatIntent_userId_intentType_idx" ON "public"."ChatIntent"("userId", "intentType");

-- CreateIndex
CREATE INDEX "ChatIntent_fulfilled_idx" ON "public"."ChatIntent"("fulfilled");

-- AddForeignKey
ALTER TABLE "public"."Workout" ADD CONSTRAINT "Workout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkoutEmbedding" ADD CONSTRAINT "WorkoutEmbedding_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "public"."Workout"("workoutId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkoutEmbedding" ADD CONSTRAINT "WorkoutEmbedding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatHistory" ADD CONSTRAINT "ChatHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatIntent" ADD CONSTRAINT "ChatIntent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatIntent" ADD CONSTRAINT "ChatIntent_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "public"."Workout"("workoutId") ON DELETE SET NULL ON UPDATE CASCADE;
