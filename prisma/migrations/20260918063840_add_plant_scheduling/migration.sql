-- CreateTable
CREATE TABLE `plant_capacities` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `dailyCapacity` DECIMAL(12, 3) NOT NULL,
    `unit` VARCHAR(191) NOT NULL,
    `productId` INTEGER NULL,
    `productFamilyId` INTEGER NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `plant_capacities_code_key`(`code`),
    INDEX `plant_capacities_productId_idx`(`productId`),
    INDEX `plant_capacities_productFamilyId_idx`(`productFamilyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `plant_schedules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lotId` INTEGER NOT NULL,
    `priority` INTEGER NOT NULL,
    `plannedDate` DATETIME(3) NULL,
    `startDate` DATETIME(3) NULL,
    `offeredEndDate` DATETIME(3) NULL,
    `comments` TEXT NULL,
    `schedulingNotes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `plant_schedules_lotId_key`(`lotId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `plant_capacities` ADD CONSTRAINT `plant_capacities_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `plant_capacities` ADD CONSTRAINT `plant_capacities_productFamilyId_fkey` FOREIGN KEY (`productFamilyId`) REFERENCES `product_families`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `plant_schedules` ADD CONSTRAINT `plant_schedules_lotId_fkey` FOREIGN KEY (`lotId`) REFERENCES `lots`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
