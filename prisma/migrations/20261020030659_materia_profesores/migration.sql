-- CreateEnum
CREATE TYPE "categoria_pregunta" AS ENUM ('INTERESES', 'HABILIDADES', 'EXPECTATIVAS', 'EXPERIENCIA');

-- CreateEnum
CREATE TYPE "rol_mensaje" AS ENUM ('USER', 'ASSISTANT');

-- AlterTable
ALTER TABLE "alumno" ADD COLUMN     "avatar_url" TEXT,
ADD COLUMN     "cuestionario_completado" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "promedio" DROP NOT NULL;

-- AlterTable
ALTER TABLE "materia" ADD COLUMN     "codigo" INTEGER,
ADD COLUMN     "creditos" INTEGER,
ADD COLUMN     "semestre" TEXT;

-- CreateTable
CREATE TABLE "respuestas_cuestionario" (
    "id_respuesta" TEXT NOT NULL,
    "id_alumno" TEXT NOT NULL,
    "id_pregunta" TEXT NOT NULL,
    "categoria" "categoria_pregunta" NOT NULL,
    "respuesta" JSONB NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "respuestas_cuestionario_pkey" PRIMARY KEY ("id_respuesta")
);

-- CreateTable
CREATE TABLE "conversaciones" (
    "id_conversacion" TEXT NOT NULL,
    "id_alumno" TEXT NOT NULL,
    "titulo" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversaciones_pkey" PRIMARY KEY ("id_conversacion")
);

-- CreateTable
CREATE TABLE "mensajes" (
    "id_mensaje" TEXT NOT NULL,
    "id_conversacion" TEXT NOT NULL,
    "rol" "rol_mensaje" NOT NULL,
    "contenido" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensajes_pkey" PRIMARY KEY ("id_mensaje")
);

-- CreateTable
CREATE TABLE "profesores" (
    "id_profesor" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido_m" TEXT NOT NULL,
    "apellido_p" TEXT NOT NULL,
    "anio_ingreso" DATE,
    "carrera" TEXT,
    "acerca_de_mi" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "profesores_pkey" PRIMARY KEY ("id_profesor")
);

-- CreateTable
CREATE TABLE "profesor_curso" (
    "id_profesor_curso" TEXT NOT NULL,
    "id_profesor" TEXT NOT NULL,
    "id_materia" TEXT NOT NULL,
    "notas" TEXT,

    CONSTRAINT "profesor_curso_pkey" PRIMARY KEY ("id_profesor_curso")
);

-- CreateTable
CREATE TABLE "n8n_chat_histories" (
    "id" SERIAL NOT NULL,
    "session_id" VARCHAR(255) NOT NULL,
    "message" JSONB NOT NULL,

    CONSTRAINT "n8n_chat_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "respuestas_cuestionario_id_alumno_id_pregunta_key" ON "respuestas_cuestionario"("id_alumno", "id_pregunta");

-- CreateIndex
CREATE UNIQUE INDEX "profesor_curso_id_profesor_id_materia_key" ON "profesor_curso"("id_profesor", "id_materia");

-- AddForeignKey
ALTER TABLE "respuestas_cuestionario" ADD CONSTRAINT "respuestas_cuestionario_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumno"("id_alumno") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversaciones" ADD CONSTRAINT "conversaciones_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumno"("id_alumno") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensajes" ADD CONSTRAINT "mensajes_id_conversacion_fkey" FOREIGN KEY ("id_conversacion") REFERENCES "conversaciones"("id_conversacion") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profesor_curso" ADD CONSTRAINT "profesor_curso_id_profesor_fkey" FOREIGN KEY ("id_profesor") REFERENCES "profesores"("id_profesor") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profesor_curso" ADD CONSTRAINT "profesor_curso_id_materia_fkey" FOREIGN KEY ("id_materia") REFERENCES "materia"("id_materia") ON DELETE CASCADE ON UPDATE CASCADE;
