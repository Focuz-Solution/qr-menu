-- One category name (Khmer or English). Keep the Khmer names as the new single name.
ALTER TABLE "categories" RENAME COLUMN "name_km" TO "name";
ALTER TABLE "categories" DROP COLUMN "name_en";
