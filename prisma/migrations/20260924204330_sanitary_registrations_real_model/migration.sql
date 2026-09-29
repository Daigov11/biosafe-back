-- DropForeignKey
ALTER TABLE `sanitary_registration_products` DROP FOREIGN KEY `sanitary_registration_products_productId_fkey`;

-- DropForeignKey
ALTER TABLE `sanitary_registration_products` DROP FOREIGN KEY `sanitary_registration_products_sanitaryRegistrationId_fkey`;

-- AlterTable
ALTER TABLE `sanitary_registration_documents` DROP COLUMN `originalName`,
    DROP COLUMN `sizeBytes`,
    ADD COLUMN `documentDate` DATETIME(3) NULL,
    ADD COLUMN `documentType` VARCHAR(191) NOT NULL,
    ADD COLUMN `fileName` VARCHAR(191) NOT NULL,
    ADD COLUMN `fileSize` INTEGER NOT NULL,
    ADD COLUMN `sanitaryRegistrationChangeId` INTEGER NULL;

-- AlterTable
ALTER TABLE `sanitary_registrations` DROP COLUMN `certificateType`,
    DROP COLUMN `holder`,
    DROP COLUMN `scope`,
    ADD COLUMN `brand` VARCHAR(191) NULL,
    ADD COLUMN `country` VARCHAR(191) NULL,
    ADD COLUMN `manufacturer` VARCHAR(191) NULL,
    ADD COLUMN `medicalDeviceClass` VARCHAR(191) NULL,
    MODIFY `registrationNumber` VARCHAR(191) NOT NULL,
    MODIFY `status` ENUM('DRAFT', 'IN_PROCESS', 'VALID', 'EXPIRING', 'EXPIRED', 'SUSPENDED') NOT NULL DEFAULT 'VALID';

-- DropTable
DROP TABLE `sanitary_registration_products`;

-- CreateTable
CREATE TABLE `sanitary_registration_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sanitaryRegistrationId` INTEGER NOT NULL,
    `officialItemNumber` INTEGER NULL,
    `officialCode` VARCHAR(191) NOT NULL,
    `officialDescription` VARCHAR(191) NOT NULL,
    `productId` INTEGER NULL,
    `materialSummary` TEXT NULL,
    `grammageSummary` VARCHAR(191) NULL,
    `dimensionsSummary` TEXT NULL,
    `colorsSummary` TEXT NULL,
    `presentationSummary` TEXT NULL,
    `notes` TEXT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `sanitary_registration_items_sanitaryRegistrationId_idx`(`sanitaryRegistrationId`),
    INDEX `sanitary_registration_items_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sanitary_registration_changes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sanitaryRegistrationId` INTEGER NOT NULL,
    `resolutionNumber` VARCHAR(191) NOT NULL,
    `changeType` ENUM('INSCRIPCION', 'MODIFICACION', 'RENOVACION', 'ACTUALIZACION', 'OTRO') NOT NULL,
    `resolutionDate` DATETIME(3) NULL,
    `effectiveDate` DATETIME(3) NULL,
    `description` TEXT NOT NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `sanitary_registration_changes_sanitaryRegistrationId_idx`(`sanitaryRegistrationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `sanitary_registration_documents_sanitaryRegistrationChangeId_idx` ON `sanitary_registration_documents`(`sanitaryRegistrationChangeId`);

-- CreateIndex
CREATE UNIQUE INDEX `sanitary_registrations_registrationNumber_key` ON `sanitary_registrations`(`registrationNumber`);

-- AddForeignKey
ALTER TABLE `sanitary_registration_items` ADD CONSTRAINT `sanitary_registration_items_sanitaryRegistrationId_fkey` FOREIGN KEY (`sanitaryRegistrationId`) REFERENCES `sanitary_registrations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sanitary_registration_items` ADD CONSTRAINT `sanitary_registration_items_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sanitary_registration_changes` ADD CONSTRAINT `sanitary_registration_changes_sanitaryRegistrationId_fkey` FOREIGN KEY (`sanitaryRegistrationId`) REFERENCES `sanitary_registrations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sanitary_registration_documents` ADD CONSTRAINT `sanitary_registration_documents_sanitaryRegistrationChangeI_fkey` FOREIGN KEY (`sanitaryRegistrationChangeId`) REFERENCES `sanitary_registration_changes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

