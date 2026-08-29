-- CreateTable
CREATE TABLE "UserRequisitionAccess" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "requisitionId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID NOT NULL,

    CONSTRAINT "UserRequisitionAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserRequisitionAccess_requisitionId_idx" ON "UserRequisitionAccess"("requisitionId");

-- CreateIndex
CREATE INDEX "UserRequisitionAccess_userId_idx" ON "UserRequisitionAccess"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRequisitionAccess_userId_requisitionId_key" ON "UserRequisitionAccess"("userId", "requisitionId");

-- AddForeignKey
ALTER TABLE "UserRequisitionAccess" ADD CONSTRAINT "UserRequisitionAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRequisitionAccess" ADD CONSTRAINT "UserRequisitionAccess_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "Requisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRequisitionAccess" ADD CONSTRAINT "UserRequisitionAccess_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
