/*
  Warnings:

  - Added the required column `grupo_tema` to the `tema` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TopicGroup" AS ENUM ('PERMANENCIA', 'ACADEMICO', 'TRAMITES', 'BIENESTAR', 'EMPLEABILIDAD', 'OTRO');

-- AlterTable
ALTER TABLE "tema" ADD COLUMN     "grupo_tema" "TopicGroup" NOT NULL;
