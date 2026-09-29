-- AlterTable
ALTER TABLE `orders` ADD COLUMN `purchaseOrderNumber` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `production_orders` ADD COLUMN `productionManagerDate` DATETIME(3) NULL,
    ADD COLUMN `productionManagerName` VARCHAR(191) NULL,
    ADD COLUMN `technicalDirectorDate` DATETIME(3) NULL,
    ADD COLUMN `technicalDirectorName` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `product_standard_times` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productId` INTEGER NOT NULL,
    `routeStepId` INTEGER NOT NULL,
    `standardTimeMinutes` DECIMAL(10, 2) NOT NULL,
    `people` INTEGER NULL,
    `effectiveFrom` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `product_standard_times_productId_idx`(`productId`),
    INDEX `product_standard_times_routeStepId_idx`(`routeStepId`),
    UNIQUE INDEX `product_standard_times_productId_routeStepId_key`(`productId`, `routeStepId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `product_standard_times` ADD CONSTRAINT `product_standard_times_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_standard_times` ADD CONSTRAINT `product_standard_times_routeStepId_fkey` FOREIGN KEY (`routeStepId`) REFERENCES `route_steps`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
