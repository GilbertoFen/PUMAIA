/*
  Warnings:

  - A unique constraint covering the columns `[id_plan_estudios,codigo]` on the table `materia` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "materia_id_plan_estudios_codigo_key" ON "materia"("id_plan_estudios", "codigo");
