-- AlterTable
ALTER TABLE `bom_items` ADD COLUMN `countsTowardKitPieces` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `quote_items` ADD COLUMN `marginPercentage` DECIMAL(5, 2) NULL,
    ADD COLUMN `unitCostWithTax` DECIMAL(12, 4) NULL,
    ADD COLUMN `unitCostWithoutTax` DECIMAL(12, 4) NULL,
    ADD COLUMN `unitPriceWithTax` DECIMAL(12, 4) NULL;
