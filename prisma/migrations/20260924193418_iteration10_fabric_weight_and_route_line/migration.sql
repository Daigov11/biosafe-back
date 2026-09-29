-- AlterTable
ALTER TABLE `raw_materials` ADD COLUMN `netWeightPerRollKg` DECIMAL(10, 3) NULL;

-- AlterTable
ALTER TABLE `route_steps` ADD COLUMN `productionLine` VARCHAR(191) NULL;
