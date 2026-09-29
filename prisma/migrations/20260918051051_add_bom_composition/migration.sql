-- CreateTable
CREATE TABLE `bom_headers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productId` INTEGER NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bom_headers_productId_key`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bom_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bomHeaderId` INTEGER NOT NULL,
    `componentType` ENUM('RAW_MATERIAL', 'PRODUCT') NOT NULL,
    `componentClass` ENUM('PRODUCTIVE_MATERIAL', 'PACKAGING_MATERIAL') NOT NULL DEFAULT 'PRODUCTIVE_MATERIAL',
    `rawMaterialId` INTEGER NULL,
    `componentProductId` INTEGER NULL,
    `quantity` DECIMAL(12, 4) NOT NULL,
    `unit` VARCHAR(191) NOT NULL,
    `wastePercentage` DECIMAL(5, 2) NULL,
    `requiredWidth` DECIMAL(10, 3) NULL,
    `requiredLength` DECIMAL(10, 3) NULL,
    `notes` VARCHAR(191) NULL,
    `sequence` INTEGER NOT NULL DEFAULT 0,
    `required` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `bom_items_bomHeaderId_idx`(`bomHeaderId`),
    INDEX `bom_items_rawMaterialId_idx`(`rawMaterialId`),
    INDEX `bom_items_componentProductId_idx`(`componentProductId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `bom_headers` ADD CONSTRAINT `bom_headers_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bom_items` ADD CONSTRAINT `bom_items_bomHeaderId_fkey` FOREIGN KEY (`bomHeaderId`) REFERENCES `bom_headers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bom_items` ADD CONSTRAINT `bom_items_rawMaterialId_fkey` FOREIGN KEY (`rawMaterialId`) REFERENCES `raw_materials`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bom_items` ADD CONSTRAINT `bom_items_componentProductId_fkey` FOREIGN KEY (`componentProductId`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
