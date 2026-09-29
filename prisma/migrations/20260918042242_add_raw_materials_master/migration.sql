-- CreateTable
CREATE TABLE `material_families` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `material_families_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `material_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `familyId` INTEGER NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `material_categories_code_key`(`code`),
    INDEX `material_categories_familyId_idx`(`familyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `units` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `symbol` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `units_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `raw_materials` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `familyId` INTEGER NULL,
    `categoryId` INTEGER NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `type` VARCHAR(191) NULL,
    `grammage` DECIMAL(10, 3) NULL,
    `grammageUnit` VARCHAR(191) NULL,
    `width` DECIMAL(10, 3) NULL,
    `widthUnit` VARCHAR(191) NULL,
    `length` DECIMAL(10, 3) NULL,
    `lengthUnit` VARCHAR(191) NULL,
    `color` VARCHAR(191) NULL,
    `size` VARCHAR(191) NULL,
    `presentation` VARCHAR(191) NULL,
    `purchaseUnitId` INTEGER NULL,
    `inventoryUnitId` INTEGER NULL,
    `consumptionUnitId` INTEGER NULL,
    `controlByLot` BOOLEAN NOT NULL DEFAULT false,
    `controlByUnit` BOOLEAN NOT NULL DEFAULT false,
    `controlByDimensions` BOOLEAN NOT NULL DEFAULT false,
    `allowsReusableBalance` BOOLEAN NOT NULL DEFAULT false,
    `referenceStock` DECIMAL(12, 3) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `raw_materials_code_key`(`code`),
    INDEX `raw_materials_familyId_idx`(`familyId`),
    INDEX `raw_materials_categoryId_idx`(`categoryId`),
    INDEX `raw_materials_purchaseUnitId_idx`(`purchaseUnitId`),
    INDEX `raw_materials_inventoryUnitId_idx`(`inventoryUnitId`),
    INDEX `raw_materials_consumptionUnitId_idx`(`consumptionUnitId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `material_categories` ADD CONSTRAINT `material_categories_familyId_fkey` FOREIGN KEY (`familyId`) REFERENCES `material_families`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `raw_materials` ADD CONSTRAINT `raw_materials_familyId_fkey` FOREIGN KEY (`familyId`) REFERENCES `material_families`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `raw_materials` ADD CONSTRAINT `raw_materials_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `material_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `raw_materials` ADD CONSTRAINT `raw_materials_purchaseUnitId_fkey` FOREIGN KEY (`purchaseUnitId`) REFERENCES `units`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `raw_materials` ADD CONSTRAINT `raw_materials_inventoryUnitId_fkey` FOREIGN KEY (`inventoryUnitId`) REFERENCES `units`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `raw_materials` ADD CONSTRAINT `raw_materials_consumptionUnitId_fkey` FOREIGN KEY (`consumptionUnitId`) REFERENCES `units`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
