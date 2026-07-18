-- CreateTable
CREATE TABLE "CompanyPollingLease" (
    "companyId" TEXT NOT NULL,
    "holderInstanceId" TEXT NOT NULL,
    "lastHeartbeat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyPollingLease_pkey" PRIMARY KEY ("companyId")
);

-- CreateIndex
CREATE INDEX "CompanyPollingLease_expiresAt_idx" ON "CompanyPollingLease"("expiresAt");

-- AddForeignKey
ALTER TABLE "CompanyPollingLease" ADD CONSTRAINT "CompanyPollingLease_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
