/*
  Warnings:

  - A unique constraint covering the columns `[numeroCuenta]` on the table `alumno` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `id_alumno` to the `experiencia_profesional` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "KnowledgeAreaEnum" AS ENUM ('CIENCIAS_FISICO_MATEMATICAS_Y_DE_LAS_INGENIERIAS', 'CIENCIAS_BIOLOGICAS_Y_DE_LA_SALUD', 'CIENCIAS_SOCIALES', 'HUMANIDADES_Y_ARTES');

-- AlterTable
ALTER TABLE "alumno" ALTER COLUMN "interes" DROP NOT NULL;

-- AlterTable
ALTER TABLE "experiencia_profesional" ADD COLUMN     "id_alumno" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "area_conocimiento" (
    "id_areaC" TEXT NOT NULL,
    "KnowledgeArea" "KnowledgeAreaEnum" NOT NULL,

    CONSTRAINT "area_conocimiento_pkey" PRIMARY KEY ("id_areaC")
);

-- CreateIndex
CREATE UNIQUE INDEX "alumno_numeroCuenta_key" ON "alumno"("numeroCuenta");

-- AddForeignKey
ALTER TABLE "experiencia_profesional" ADD CONSTRAINT "experiencia_profesional_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumno"("id_alumno") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiencia_profesional" ADD CONSTRAINT "experiencia_profesional_id_AreaExpertise_fkey" FOREIGN KEY ("id_AreaExpertise") REFERENCES "area_expertise"("id_areaExpertise") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concurso_alumno" ADD CONSTRAINT "concurso_alumno_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumno"("id_alumno") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concurso_alumno" ADD CONSTRAINT "concurso_alumno_id_concurso_fkey" FOREIGN KEY ("id_concurso") REFERENCES "concurso"("id_Concurso") ON DELETE RESTRICT ON UPDATE CASCADE;
