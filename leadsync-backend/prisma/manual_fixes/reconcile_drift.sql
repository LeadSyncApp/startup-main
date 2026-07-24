-- AlterTable
ALTER TABLE "ProductFieldDefinition" RENAME CONSTRAINT "CompanyFieldDefinition_pkey" TO "ProductFieldDefinition_pkey";

-- DropTable
DROP TABLE "AutomationLog";

-- DropTable
DROP TABLE "AutomationRule";

-- RenameForeignKey
ALTER TABLE "ProductFieldDefinition" RENAME CONSTRAINT "CompanyFieldDefinition_companyId_fkey" TO "ProductFieldDefinition_companyId_fkey";

-- AddForeignKey
ALTER TABLE "WebhookDeliveryLog" ADD CONSTRAINT "WebhookDeliveryLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "CompanyFieldDefinition_companyId_appliesTo_idx" RENAME TO "ProductFieldDefinition_companyId_appliesTo_idx";

-- RenameIndex
ALTER INDEX "CompanyFieldDefinition_companyId_idx" RENAME TO "ProductFieldDefinition_companyId_idx";
