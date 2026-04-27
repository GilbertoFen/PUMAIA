/*
  Warnings:

  - The primary key for the `area_conocimiento` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `KnowledgeArea` on the `area_conocimiento` table. All the data in the column will be lost.
  - You are about to drop the column `id_areaC` on the `area_conocimiento` table. All the data in the column will be lost.
  - The required column `id_areaConocimiento` was added to the `area_conocimiento` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `knowledgeArea` to the `area_conocimiento` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CategoryEnum" AS ENUM ('MATEMATICAS', 'PROBABILIDAD_ESTADISTICA_Y_OPTIMIZACION', 'MATEMATICAS_COMPUTACIONALES', 'COMPUTACION', 'HUMANISTICA_SOCIAL', 'MODELADO_ANALITICO', 'MODELADO_ESTOCASTICO', 'ADMINISTRACION_Y_FINANZAS', 'SISTEMAS_COMPUTACIONALES', 'CIENCIAS_DE_LA_COMPUTACION');

-- AlterTable
ALTER TABLE "area_conocimiento" DROP CONSTRAINT "area_conocimiento_pkey",
DROP COLUMN "KnowledgeArea",
DROP COLUMN "id_areaC",
ADD COLUMN     "id_areaConocimiento" TEXT NOT NULL,
ADD COLUMN     "knowledgeArea" "KnowledgeAreaEnum" NOT NULL,
ADD CONSTRAINT "area_conocimiento_pkey" PRIMARY KEY ("id_areaConocimiento");

-- CreateTable
CREATE TABLE "plan_estudios" (
    "id_planEstudios" TEXT NOT NULL,
    "planEstudios" TEXT NOT NULL,
    "cantidadSemestres" INTEGER NOT NULL,

    CONSTRAINT "plan_estudios_pkey" PRIMARY KEY ("id_planEstudios")
);

-- CreateTable
CREATE TABLE "categorias" (
    "id_categoria" TEXT NOT NULL,
    "category" "CategoryEnum" NOT NULL,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id_categoria")
);

-- CreateTable
CREATE TABLE "materia" (
    "id_materia" TEXT NOT NULL,
    "materia" TEXT NOT NULL,
    "id_categoria" TEXT NOT NULL,

    CONSTRAINT "materia_pkey" PRIMARY KEY ("id_materia")
);

-- CreateTable
CREATE TABLE "calificaciones" (
    "id_calificaciones" TEXT NOT NULL,
    "calificacion" INTEGER NOT NULL,
    "id_materia" TEXT NOT NULL,
    "id_alumno" TEXT NOT NULL,

    CONSTRAINT "calificaciones_pkey" PRIMARY KEY ("id_calificaciones")
);

-- AddForeignKey
ALTER TABLE "materia" ADD CONSTRAINT "materia_id_categoria_fkey" FOREIGN KEY ("id_categoria") REFERENCES "categorias"("id_categoria") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calificaciones" ADD CONSTRAINT "calificaciones_id_materia_fkey" FOREIGN KEY ("id_materia") REFERENCES "materia"("id_materia") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calificaciones" ADD CONSTRAINT "calificaciones_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumno"("id_alumno") ON DELETE RESTRICT ON UPDATE CASCADE;
