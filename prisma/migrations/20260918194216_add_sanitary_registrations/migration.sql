-- CreateTable
CREATE TABLE `sanitary_registrations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `certificateType` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `registrationNumber` VARCHAR(191) NULL,
    `issuingAuthority` VARCHAR(191) NULL,
    `holder` VARCHAR(191) NULL,
    `issueDate` DATETIME(3) NULL,
    `expirationDate` DATETIME(3) NULL,
    `status` ENUM('DRAFT', 'IN_PROCESS', 'VALID', 'EXPIRING', 'EXPIRED', 'SUSPENDED') NOT NULL DEFAULT 'DRAFT',
    `scope` ENUM('GLOBAL', 'PRODUCT', 'PRODUCT_FAMILY') NOT NULL DEFAULT 'GLOBAL',
    `notes` TEXT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sanitary_registrations_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sanitary_registration_products` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sanitaryRegistrationId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sanitary_registration_products_productId_idx`(`productId`),
    UNIQUE INDEX `sanitary_registration_products_sanitaryRegistrationId_produc_key`(`sanitaryRegistrationId`, `productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sanitary_registration_documents` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sanitaryRegistrationId` INTEGER NOT NULL,
    `originalName` VARCHAR(191) NOT NULL,
    `storagePath` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sanitary_registration_documents_sanitaryRegistrationId_idx`(`sanitaryRegistrationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sanitary_registration_products` ADD CONSTRAINT `sanitary_registration_products_sanitaryRegistrationId_fkey` FOREIGN KEY (`sanitaryRegistrationId`) REFERENCES `sanitary_registrations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sanitary_registration_products` ADD CONSTRAINT `sanitary_registration_products_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sanitary_registration_documents` ADD CONSTRAINT `sanitary_registration_documents_sanitaryRegistrationId_fkey` FOREIGN KEY (`sanitaryRegistrationId`) REFERENCES `sanitary_registrations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
