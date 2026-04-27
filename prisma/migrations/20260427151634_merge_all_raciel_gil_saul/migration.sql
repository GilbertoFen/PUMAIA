/*
  Warnings:

  - You are about to drop the `Category` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Course" DROP CONSTRAINT "Course_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "Schoolarship" DROP CONSTRAINT "Schoolarship_categoryId_fkey";

-- DropTable
DROP TABLE "Category";

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categorias"("id_categoria") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schoolarship" ADD CONSTRAINT "Schoolarship_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categorias"("id_categoria") ON DELETE RESTRICT ON UPDATE CASCADE;
