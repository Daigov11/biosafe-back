-- AlterTable
ALTER TABLE `quotes` ADD COLUMN `commercialTerms` TEXT NULL,
    ADD COLUMN `currency` VARCHAR(191) NOT NULL DEFAULT 'PEN',
    ADD COLUMN `endEntity` VARCHAR(191) NULL,
    ADD COLUMN `validUntil` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `product_material_yields` ADD COLUMN `nestingNote` VARCHAR(191) NULL,
    ADD COLUMN `overrideReason` TEXT NULL,
    ADD COLUMN `suggestedUnitsPerRoll` INTEGER NULL,
    ADD COLUMN `usableRollLength` DECIMAL(10, 3) NULL,
    ADD COLUMN `usableRollWidth` DECIMAL(10, 3) NULL,
    ADD COLUMN `validatedAt` DATETIME(3) NULL,
    ADD COLUMN `validatedById` INTEGER NULL,
    ADD COLUMN `validationStatus` ENUM('PENDING', 'VALIDATED') NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('COMERCIAL', 'COSTOS', 'INGENIERIA', 'DIRECCION', 'ADMIN') NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `failedLogins` INTEGER NOT NULL DEFAULT 0,
    `lockedUntil` DATETIME(3) NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `sessions_tokenHash_key`(`tokenHash`),
    INDEX `sessions_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NULL,
    `userEmail` VARCHAR(191) NOT NULL,
    `userRole` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `entity` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `field` VARCHAR(191) NULL,
    `oldValue` JSON NULL,
    `newValue` JSON NULL,
    `reason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_entity_entityId_idx`(`entity`, `entityId`),
    INDEX `audit_logs_userId_idx`(`userId`),
    INDEX `audit_logs_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cost_parameters` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(191) NOT NULL,
    `value` DECIMAL(14, 6) NOT NULL,
    `effectiveFrom` DATETIME(3) NOT NULL,
    `notes` VARCHAR(191) NULL,
    `isFixture` BOOLEAN NOT NULL DEFAULT false,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `cost_parameters_key_effectiveFrom_key`(`key`, `effectiveFrom`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `material_costs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rawMaterialId` INTEGER NOT NULL,
    `price` DECIMAL(14, 4) NOT NULL,
    `priceUnit` ENUM('ROLL', 'METER', 'CENTIMETER', 'UNIT', 'BOX', 'PACK', 'KIT') NOT NULL,
    `includesTax` BOOLEAN NOT NULL,
    `usableLength` DECIMAL(12, 3) NULL,
    `supplier` VARCHAR(191) NULL,
    `effectiveFrom` DATETIME(3) NOT NULL,
    `notes` VARCHAR(191) NULL,
    `isFixture` BOOLEAN NOT NULL DEFAULT false,
    `pendingValidation` BOOLEAN NOT NULL DEFAULT false,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `material_costs_rawMaterialId_effectiveFrom_idx`(`rawMaterialId`, `effectiveFrom`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_costs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` ENUM('PEEL_OPEN', 'STICKER', 'PACK_PREPARATION', 'BOX', 'BOX_STICKER', 'STERILIZATION', 'OTHER') NOT NULL,
    `price` DECIMAL(14, 4) NOT NULL,
    `includesTax` BOOLEAN NOT NULL,
    `unitsPerPack` INTEGER NULL,
    `supplier` VARCHAR(191) NULL,
    `effectiveFrom` DATETIME(3) NOT NULL,
    `notes` VARCHAR(191) NULL,
    `isFixture` BOOLEAN NOT NULL DEFAULT false,
    `pendingValidation` BOOLEAN NOT NULL DEFAULT false,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `service_costs_code_effectiveFrom_key`(`code`, `effectiveFrom`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `labor_costs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productId` INTEGER NOT NULL,
    `mode` ENUM('FIXED_PER_UNIT', 'MINUTES_RATE', 'SUPPLIER') NOT NULL,
    `amount` DECIMAL(12, 4) NOT NULL,
    `ratePerMinute` DECIMAL(12, 4) NULL,
    `supplier` VARCHAR(191) NULL,
    `quotationEvidence` TEXT NULL,
    `effectiveFrom` DATETIME(3) NOT NULL,
    `notes` VARCHAR(191) NULL,
    `isFixture` BOOLEAN NOT NULL DEFAULT false,
    `pendingValidation` BOOLEAN NOT NULL DEFAULT false,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `labor_costs_productId_effectiveFrom_idx`(`productId`, `effectiveFrom`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_cost_policies` (
    `productId` INTEGER NOT NULL,
    `costSource` ENUM('OWN', 'SUPPLIER') NOT NULL DEFAULT 'OWN',
    `supplier` VARCHAR(191) NULL,
    `supplierUnitCost` DECIMAL(14, 4) NULL,
    `supplierIncludesTax` BOOLEAN NULL,
    `supplierValidFrom` DATETIME(3) NULL,
    `supplierValidUntil` DATETIME(3) NULL,
    `supplierEvidence` TEXT NULL,
    `suggestedMargin` DECIMAL(6, 4) NULL,
    `unitsPerBox` INTEGER NULL,
    `unitsPerBag` INTEGER NULL,
    `updatedById` INTEGER NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`productId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quote_item_snapshots` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `quoteItemId` INTEGER NOT NULL,
    `productCode` VARCHAR(191) NOT NULL,
    `productName` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `presentation` VARCHAR(191) NULL,
    `size` VARCHAR(191) NULL,
    `grammage` DECIMAL(10, 3) NULL,
    `width` DECIMAL(10, 3) NULL,
    `length` DECIMAL(10, 3) NULL,
    `piecesCount` INTEGER NOT NULL,
    `quantity` DECIMAL(12, 3) NOT NULL,
    `igvRate` DECIMAL(8, 6) NOT NULL,
    `margin` DECIMAL(8, 6) NOT NULL,
    `laborTotal` DECIMAL(14, 6) NOT NULL,
    `costWithTax` DECIMAL(14, 6) NOT NULL,
    `costWithoutTax` DECIMAL(14, 6) NOT NULL,
    `priceWithoutTax` DECIMAL(14, 6) NOT NULL,
    `priceWithTax` DECIMAL(14, 6) NOT NULL,
    `isFixture` BOOLEAN NOT NULL DEFAULT false,
    `historicalUnvalidated` BOOLEAN NOT NULL DEFAULT false,
    `blockers` JSON NULL,
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdById` INTEGER NULL,

    UNIQUE INDEX `quote_item_snapshots_quoteItemId_key`(`quoteItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quote_component_snapshots` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `snapshotId` INTEGER NOT NULL,
    `sequence` INTEGER NOT NULL,
    `componentProductId` INTEGER NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `quantity` DECIMAL(12, 4) NOT NULL,
    `countsTowardPieces` BOOLEAN NOT NULL DEFAULT true,
    `yieldUnits` INTEGER NULL,
    `costSource` ENUM('OWN', 'SUPPLIER') NOT NULL DEFAULT 'OWN',
    `laborCost` DECIMAL(14, 6) NOT NULL,
    `subtotal` DECIMAL(14, 6) NOT NULL,

    INDEX `quote_component_snapshots_snapshotId_idx`(`snapshotId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quote_cost_lines` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `snapshotId` INTEGER NOT NULL,
    `componentId` INTEGER NULL,
    `scope` ENUM('COMPONENT', 'KIT') NOT NULL,
    `kind` ENUM('MATERIAL', 'LABOR', 'SERVICE', 'PACKAGING') NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `formulaText` TEXT NULL,
    `technicalNote` TEXT NULL,
    `amount` DECIMAL(14, 6) NOT NULL,
    `includesTax` BOOLEAN NOT NULL,
    `sourceType` VARCHAR(191) NOT NULL,
    `sourceId` INTEGER NULL,
    `pendingValidation` BOOLEAN NOT NULL DEFAULT false,
    `historicalReference` BOOLEAN NOT NULL DEFAULT false,

    INDEX `quote_cost_lines_snapshotId_idx`(`snapshotId`),
    INDEX `quote_cost_lines_componentId_idx`(`componentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quote_price_overrides` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `quoteItemId` INTEGER NOT NULL,
    `originalPriceWithTax` DECIMAL(14, 6) NOT NULL,
    `overridePriceWithTax` DECIMAL(14, 6) NOT NULL,
    `reason` TEXT NOT NULL,
    `requestedById` INTEGER NOT NULL,
    `approvedById` INTEGER NULL,
    `approvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `quote_price_overrides_quoteItemId_idx`(`quoteItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `material_costs` ADD CONSTRAINT `material_costs_rawMaterialId_fkey` FOREIGN KEY (`rawMaterialId`) REFERENCES `raw_materials`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `labor_costs` ADD CONSTRAINT `labor_costs_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_cost_policies` ADD CONSTRAINT `product_cost_policies_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_item_snapshots` ADD CONSTRAINT `quote_item_snapshots_quoteItemId_fkey` FOREIGN KEY (`quoteItemId`) REFERENCES `quote_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_component_snapshots` ADD CONSTRAINT `quote_component_snapshots_snapshotId_fkey` FOREIGN KEY (`snapshotId`) REFERENCES `quote_item_snapshots`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_cost_lines` ADD CONSTRAINT `quote_cost_lines_snapshotId_fkey` FOREIGN KEY (`snapshotId`) REFERENCES `quote_item_snapshots`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_cost_lines` ADD CONSTRAINT `quote_cost_lines_componentId_fkey` FOREIGN KEY (`componentId`) REFERENCES `quote_component_snapshots`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_price_overrides` ADD CONSTRAINT `quote_price_overrides_quoteItemId_fkey` FOREIGN KEY (`quoteItemId`) REFERENCES `quote_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

