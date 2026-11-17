-- AlterTable: Agregar columna fecha_clase a sesion_clase y asistencia de manera no destructiva
ALTER TABLE "sesion_clase" ADD COLUMN IF NOT EXISTS "fecha_clase" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "asistencia" ADD COLUMN IF NOT EXISTS "fecha_clase" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill: asegurar que los registros históricos conserven su fecha original
UPDATE "sesion_clase" SET "fecha_clase" = CAST("inicia_en" AS DATE);
UPDATE "asistencia" SET "fecha_clase" = CAST("marcada_en" AS DATE);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sesion_clase_id_grupo_fecha_clase_idx" ON "sesion_clase"("id_grupo", "fecha_clase");
CREATE INDEX IF NOT EXISTS "asistencia_id_alumno_fecha_clase_idx" ON "asistencia"("id_alumno", "fecha_clase");

