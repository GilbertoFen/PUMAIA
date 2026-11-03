/*
  Warnings:

  - A unique constraint covering the columns `[id_institucion,clave]` on the table `carrera` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[clave]` on the table `institucion` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `clave` to the `carrera` table without a default value. This is not possible if the table is not empty.
  - Added the required column `clave` to the `institucion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nivel` to the `plan_estudios` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sistema` to the `plan_estudios` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "StudyLevel" AS ENUM ('LICENCIATURA', 'MAESTRIA', 'DOCTORADO');

-- CreateEnum
CREATE TYPE "StudySystem" AS ENUM ('ESCOLARIZADO', 'ABIERTO', 'A_DISTANCIA');

-- AlterTable
ALTER TABLE "carrera" ADD COLUMN     "clave" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "institucion" ADD COLUMN     "clave" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "plan_estudios" ADD COLUMN     "creditos_optativos" INTEGER,
ADD COLUMN     "nivel" "StudyLevel" NOT NULL,
ADD COLUMN     "primera_generacion" INTEGER,
ADD COLUMN     "sistema" "StudySystem" NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "carrera_id_institucion_clave_key" ON "carrera"("id_institucion", "clave");

-- CreateIndex
CREATE UNIQUE INDEX "institucion_clave_key" ON "institucion"("clave");
