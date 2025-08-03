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
CREATE UNIQUE INDEX "ChatIntent_intentId_key" ON "public"."ChatIntent"("intentId");

-- CreateIndex
CREATE INDEX "ChatIntent_chatId_idx" ON "public"."ChatIntent"("chatId");

-- CreateIndex
CREATE INDEX "ChatIntent_userId_intentType_idx" ON "public"."ChatIntent"("userId", "intentType");

-- CreateIndex
CREATE INDEX "ChatIntent_fulfilled_idx" ON "public"."ChatIntent"("fulfilled");

-- AddForeignKey
ALTER TABLE "public"."ChatIntent" ADD CONSTRAINT "ChatIntent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatIntent" ADD CONSTRAINT "ChatIntent_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "public"."Workout"("workoutId") ON DELETE SET NULL ON UPDATE CASCADE;
