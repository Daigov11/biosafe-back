-- CreateTable
CREATE TABLE `product_material_yields` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productId` INTEGER NOT NULL,
    `rawMaterialId` INTEGER NOT NULL,
    `productSize` VARCHAR(191) NOT NULL,
    `cutWidth` DECIMAL(10, 3) NULL,
    `cutLength` DECIMAL(10, 3) NULL,
    `unitsPerRoll` INTEGER NOT NULL,
    `sourceRollWidth` DECIMAL(10, 3) NULL,
    `sourceRollLength` DECIMAL(10, 3) NULL,
    `sourceGrammage` DECIMAL(10, 3) NULL,
    `effectiveFrom` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `notes` TEXT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `product_material_yields_productId_idx`(`productId`),
    INDEX `product_material_yields_rawMaterialId_idx`(`rawMaterialId`),
    UNIQUE INDEX `product_material_yields_productId_rawMaterialId_productSize__key`(`productId`, `rawMaterialId`, `productSize`, `effectiveFrom`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `product_material_yields` ADD CONSTRAINT `product_material_yields_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_material_yields` ADD CONSTRAINT `product_material_yields_rawMaterialId_fkey` FOREIGN KEY (`rawMaterialId`) REFERENCES `raw_materials`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
