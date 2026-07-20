/*
  Warnings:

  - Added the required column `isEnabled` to the `RuleGroup` table without a default value. This is safe because the table is not empty, but existing rows will need a value.
*/

-- AlterTable
ALTER TABLE "RuleGroup" ADD COLUMN "isEnabled" BOOLEAN NOT NULL DEFAULT true;
