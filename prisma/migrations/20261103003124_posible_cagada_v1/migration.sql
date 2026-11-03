/*
  Warnings:

  - You are about to drop the column `apellido_materno` on the `alumno` table. All the data in the column will be lost.
  - You are about to drop the column `apellido_paterno` on the `alumno` table. All the data in the column will be lost.
  - You are about to drop the column `avatar_url` on the `alumno` table. All the data in the column will be lost.
  - You are about to drop the column `contrasena` on the `alumno` table. All the data in the column will be lost.
  - You are about to drop the column `correo` on the `alumno` table. All the data in the column will be lost.
  - You are about to drop the column `nombre` on the `alumno` table. All the data in the column will be lost.
  - You are about to alter the column `promedio` on the `alumno` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(4,2)`.
  - The `semestre` column on the `materia` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `acerca_de_mi` on the `profesores` table. All the data in the column will be lost.
  - You are about to drop the column `carrera` on the `profesores` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `profesores` table. All the data in the column will be lost.
  - You are about to drop the column `telefono` on the `profesores` table. All the data in the column will be lost.
  - The `anio_ingreso` column on the `profesores` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `descripcion_a` on the `resultado_ia` table. All the data in the column will be lost.
  - You are about to drop the column `descripcion_b` on the `resultado_ia` table. All the data in the column will be lost.
  - You are about to drop the column `descripcion_c` on the `resultado_ia` table. All the data in the column will be lost.
  - You are about to drop the column `descripcion_d` on the `resultado_ia` table. All the data in the column will be lost.
  - You are about to drop the column `descripcion_e` on the `resultado_ia` table. All the data in the column will be lost.
  - You are about to drop the column `opcion_a` on the `resultado_ia` table. All the data in the column will be lost.
  - You are about to drop the column `opcion_b` on the `resultado_ia` table. All the data in the column will be lost.
  - You are about to drop the column `opcion_c` on the `resultado_ia` table. All the data in the column will be lost.
  - You are about to drop the column `opcion_d` on the `resultado_ia` table. All the data in the column will be lost.
  - You are about to drop the column `opcion_e` on the `resultado_ia` table. All the data in the column will be lost.
  - You are about to drop the `calificacion` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `carrera_alumno` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `respuestas_cuestionario` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[id_usuario]` on the table `alumno` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id_usuario]` on the table `profesores` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `id_carrera` to the `alumno` table without a default value. This is not possible if the table is not empty.
  - Added the required column `id_usuario` to the `alumno` table without a default value. This is not possible if the table is not empty.
  - Added the required column `id_institucion` to the `carrera` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('INVITED', 'ACTIVE', 'DELETED');

-- CreateEnum
CREATE TYPE "RoleType" AS ENUM ('STUDENT', 'PROFESSOR', 'INSTITUTION_ADMIN', 'ANALYST');

-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('EMAIL', 'PHONE', 'LINKEDIN', 'GITHUB', 'WEBSITE', 'OTHER');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PRIVATE', 'INSTITUTION', 'PUBLIC');

-- CreateEnum
CREATE TYPE "ConsentKind" AS ENUM ('TERMS_AND_NOTICE', 'ANALYTICS', 'IMPROVEMENT');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('IN_PROGRESS', 'PASSED', 'FAILED', 'NOT_PRESENTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "EnrollmentSource" AS ENUM ('TRANSCRIPT', 'JOIN_CODE');

-- CreateEnum
CREATE TYPE "EnrollmentVerification" AS ENUM ('UNVERIFIED', 'PROFESSOR_CONFIRMED');

-- CreateEnum
CREATE TYPE "RosterOrigin" AS ENUM ('PROFESSOR_LIST', 'JOIN_CODE');

-- CreateEnum
CREATE TYPE "RosterStatus" AS ENUM ('LISTED', 'LINKED', 'CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'ABSENT', 'EXCUSED');

-- CreateEnum
CREATE TYPE "AttendanceMethod" AS ENUM ('QR', 'MANUAL');

-- CreateEnum
CREATE TYPE "FeedbackValue" AS ENUM ('UP', 'DOWN');

-- CreateEnum
CREATE TYPE "LabelSource" AS ENUM ('MODEL', 'MANUAL');

-- CreateEnum
CREATE TYPE "SummaryStatus" AS ENUM ('DRAFT', 'APPROVED', 'SHARED', 'REVOKED');

-- CreateEnum
CREATE TYPE "QuestionnaireKind" AS ENUM ('ONBOARDING', 'CHECK_IN', 'TERM_SURVEY');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('SINGLE_CHOICE', 'MULTI_CHOICE', 'SCALE', 'TEXT');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'INDEXED', 'FAILED', 'REPLACED');

-- DropForeignKey
ALTER TABLE "beca_alumno" DROP CONSTRAINT "beca_alumno_id_alumno_fkey";

-- DropForeignKey
ALTER TABLE "calificacion" DROP CONSTRAINT "calificacion_id_alumno_fkey";

-- DropForeignKey
ALTER TABLE "calificacion" DROP CONSTRAINT "calificacion_id_materia_fkey";

-- DropForeignKey
ALTER TABLE "carrera_alumno" DROP CONSTRAINT "carrera_alumno_id_alumno_fkey";

-- DropForeignKey
ALTER TABLE "carrera_alumno" DROP CONSTRAINT "carrera_alumno_id_carrera_fkey";

-- DropForeignKey
ALTER TABLE "concurso_alumno" DROP CONSTRAINT "concurso_alumno_id_alumno_fkey";

-- DropForeignKey
ALTER TABLE "curso_alumno" DROP CONSTRAINT "curso_alumno_id_alumno_fkey";

-- DropForeignKey
ALTER TABLE "experiencia_profesional" DROP CONSTRAINT "experiencia_profesional_id_alumno_fkey";

-- DropForeignKey
ALTER TABLE "idioma_alumno" DROP CONSTRAINT "idioma_alumno_id_alumno_fkey";

-- DropForeignKey
ALTER TABLE "respuestas_cuestionario" DROP CONSTRAINT "respuestas_cuestionario_id_alumno_fkey";

-- DropForeignKey
ALTER TABLE "resultado_ia" DROP CONSTRAINT "resultado_ia_id_alumno_fkey";

-- DropIndex
DROP INDEX "alumno_correo_key";

-- AlterTable
ALTER TABLE "alumno" DROP COLUMN "apellido_materno",
DROP COLUMN "apellido_paterno",
DROP COLUMN "avatar_url",
DROP COLUMN "contrasena",
DROP COLUMN "correo",
DROP COLUMN "nombre",
ADD COLUMN     "es_egresado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "id_carrera" TEXT NOT NULL,
ADD COLUMN     "id_usuario" TEXT NOT NULL,
ALTER COLUMN "promedio" SET DATA TYPE DECIMAL(4,2);

-- AlterTable
ALTER TABLE "beca_alumno" ADD COLUMN     "inicia_en" DATE,
ADD COLUMN     "termina_en" DATE;

-- AlterTable
ALTER TABLE "carrera" ADD COLUMN     "id_institucion" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "conversaciones" ADD COLUMN     "id_carrera" TEXT,
ADD COLUMN     "semestre_al_iniciar" INTEGER,
ADD COLUMN     "sensible" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "materia" ADD COLUMN     "id_plan_estudios" TEXT,
DROP COLUMN "semestre",
ADD COLUMN     "semestre" INTEGER;

-- AlterTable
ALTER TABLE "plan_estudios" ADD COLUMN     "creditos_totales" INTEGER;

-- AlterTable
ALTER TABLE "profesores" DROP COLUMN "acerca_de_mi",
DROP COLUMN "carrera",
DROP COLUMN "email",
DROP COLUMN "telefono",
ADD COLUMN     "id_categoria_academica" TEXT,
ADD COLUMN     "id_usuario" TEXT,
ALTER COLUMN "apellido_m" DROP NOT NULL,
DROP COLUMN "anio_ingreso",
ADD COLUMN     "anio_ingreso" INTEGER;

-- AlterTable
ALTER TABLE "resultado_ia" DROP COLUMN "descripcion_a",
DROP COLUMN "descripcion_b",
DROP COLUMN "descripcion_c",
DROP COLUMN "descripcion_d",
DROP COLUMN "descripcion_e",
DROP COLUMN "opcion_a",
DROP COLUMN "opcion_b",
DROP COLUMN "opcion_c",
DROP COLUMN "opcion_d",
DROP COLUMN "opcion_e",
ADD COLUMN     "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "version_modelo" TEXT;

-- DropTable
DROP TABLE "calificacion";

-- DropTable
DROP TABLE "carrera_alumno";

-- DropTable
DROP TABLE "respuestas_cuestionario";

-- CreateTable
CREATE TABLE "institucion" (
    "id_institucion" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "institucion_pkey" PRIMARY KEY ("id_institucion")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id_usuario" TEXT NOT NULL,
    "id_institucion" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "google_sub" TEXT,
    "correo_verificado_en" TIMESTAMP(3),
    "nombre" TEXT NOT NULL,
    "apellido_paterno" TEXT NOT NULL,
    "apellido_materno" TEXT,
    "avatar_url" TEXT,
    "estado" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "ultimo_acceso_en" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eliminado_en" TIMESTAMP(3),

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateTable
CREATE TABLE "rol_usuario" (
    "id_rol_usuario" TEXT NOT NULL,
    "id_usuario" TEXT NOT NULL,
    "rol" "RoleType" NOT NULL,
    "otorgado_por" TEXT,
    "otorgado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rol_usuario_pkey" PRIMARY KEY ("id_rol_usuario")
);

-- CreateTable
CREATE TABLE "perfil_personal" (
    "id_usuario" TEXT NOT NULL,
    "nombre_preferido" TEXT,
    "dia_nacimiento" INTEGER,
    "mes_nacimiento" INTEGER,
    "acerca_de_mi" TEXT,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "perfil_personal_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateTable
CREATE TABLE "metodo_contacto" (
    "id_metodo_contacto" TEXT NOT NULL,
    "id_usuario" TEXT NOT NULL,
    "tipo" "ContactType" NOT NULL,
    "etiqueta" TEXT,
    "valor" TEXT NOT NULL,
    "es_principal" BOOLEAN NOT NULL DEFAULT false,
    "visibilidad" "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metodo_contacto_pkey" PRIMARY KEY ("id_metodo_contacto")
);

-- CreateTable
CREATE TABLE "aviso_privacidad" (
    "id_aviso" TEXT NOT NULL,
    "tipo" "ConsentKind" NOT NULL,
    "version" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "publicado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aviso_privacidad_pkey" PRIMARY KEY ("id_aviso")
);

-- CreateTable
CREATE TABLE "consentimiento" (
    "id_consentimiento" TEXT NOT NULL,
    "id_usuario" TEXT NOT NULL,
    "id_aviso" TEXT NOT NULL,
    "tipo" "ConsentKind" NOT NULL,
    "otorgado" BOOLEAN NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consentimiento_pkey" PRIMARY KEY ("id_consentimiento")
);

-- CreateTable
CREATE TABLE "bitacora_auditoria" (
    "id_bitacora" TEXT NOT NULL,
    "tipo_actor" TEXT NOT NULL,
    "id_actor" TEXT,
    "accion" TEXT NOT NULL,
    "detalle" JSONB,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bitacora_auditoria_pkey" PRIMARY KEY ("id_bitacora")
);

-- CreateTable
CREATE TABLE "periodo_academico" (
    "id_periodo" TEXT NOT NULL,
    "id_institucion" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "inicia_en" DATE,
    "termina_en" DATE,

    CONSTRAINT "periodo_academico_pkey" PRIMARY KEY ("id_periodo")
);

-- CreateTable
CREATE TABLE "inscripcion" (
    "id_inscripcion" TEXT NOT NULL,
    "id_alumno" TEXT NOT NULL,
    "id_materia" TEXT NOT NULL,
    "id_periodo" TEXT,
    "id_grupo" TEXT,
    "calificacion" INTEGER,
    "estado" "EnrollmentStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "intento" INTEGER NOT NULL DEFAULT 1,
    "origen" "EnrollmentSource" NOT NULL DEFAULT 'TRANSCRIPT',
    "verificacion" "EnrollmentVerification" NOT NULL DEFAULT 'UNVERIFIED',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inscripcion_pkey" PRIMARY KEY ("id_inscripcion")
);

-- CreateTable
CREATE TABLE "historial_academico" (
    "id_historial" TEXT NOT NULL,
    "id_alumno" TEXT NOT NULL,
    "id_periodo" TEXT NOT NULL,
    "semestre" INTEGER NOT NULL,
    "promedio_acumulado" DECIMAL(4,2) NOT NULL,
    "promedio_periodo" DECIMAL(4,2),
    "creditos_acumulados" INTEGER NOT NULL,
    "subido_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_academico_pkey" PRIMARY KEY ("id_historial")
);

-- CreateTable
CREATE TABLE "materia_seriacion" (
    "id_materia" TEXT NOT NULL,
    "id_materia_requisito" TEXT NOT NULL,

    CONSTRAINT "materia_seriacion_pkey" PRIMARY KEY ("id_materia","id_materia_requisito")
);

-- CreateTable
CREATE TABLE "grupo" (
    "id_grupo" TEXT NOT NULL,
    "id_materia" TEXT NOT NULL,
    "id_periodo" TEXT NOT NULL,
    "id_profesor" TEXT,
    "clave_grupo" TEXT NOT NULL,
    "cupo" INTEGER,
    "codigo_ingreso" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grupo_pkey" PRIMARY KEY ("id_grupo")
);

-- CreateTable
CREATE TABLE "horario_grupo" (
    "id_horario" TEXT NOT NULL,
    "id_grupo" TEXT NOT NULL,
    "dia_semana" INTEGER NOT NULL,
    "hora_inicio" TIME(0) NOT NULL,
    "hora_fin" TIME(0) NOT NULL,
    "salon" TEXT,

    CONSTRAINT "horario_grupo_pkey" PRIMARY KEY ("id_horario")
);

-- CreateTable
CREATE TABLE "importacion_horario" (
    "id_importacion_horario" TEXT NOT NULL,
    "id_periodo" TEXT NOT NULL,
    "subido_por" TEXT NOT NULL,
    "archivo" TEXT,
    "filas" INTEGER NOT NULL,
    "subido_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "importacion_horario_pkey" PRIMARY KEY ("id_importacion_horario")
);

-- CreateTable
CREATE TABLE "lista_grupo" (
    "id_lista_grupo" TEXT NOT NULL,
    "id_grupo" TEXT NOT NULL,
    "numero_cuenta" INTEGER NOT NULL,
    "nombre_completo" TEXT NOT NULL,
    "id_alumno_vinculado" TEXT,
    "origen" "RosterOrigin" NOT NULL,
    "estado" "RosterStatus" NOT NULL DEFAULT 'LISTED',
    "confirmado_por" TEXT,
    "confirmado_en" TIMESTAMP(3),

    CONSTRAINT "lista_grupo_pkey" PRIMARY KEY ("id_lista_grupo")
);

-- CreateTable
CREATE TABLE "carga_lista" (
    "id_carga_lista" TEXT NOT NULL,
    "id_grupo" TEXT NOT NULL,
    "subido_por" TEXT NOT NULL,
    "filas" INTEGER NOT NULL,
    "subido_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carga_lista_pkey" PRIMARY KEY ("id_carga_lista")
);

-- CreateTable
CREATE TABLE "sesion_clase" (
    "id_sesion_clase" TEXT NOT NULL,
    "id_grupo" TEXT NOT NULL,
    "abierta_por" TEXT NOT NULL,
    "inicia_en" TIMESTAMP(3) NOT NULL,
    "cierra_en" TIMESTAMP(3),
    "estado" "SessionStatus" NOT NULL DEFAULT 'OPEN',
    "secreto" TEXT NOT NULL,

    CONSTRAINT "sesion_clase_pkey" PRIMARY KEY ("id_sesion_clase")
);

-- CreateTable
CREATE TABLE "asistencia" (
    "id_asistencia" TEXT NOT NULL,
    "id_sesion_clase" TEXT NOT NULL,
    "id_alumno" TEXT NOT NULL,
    "estado" "AttendanceStatus" NOT NULL,
    "metodo" "AttendanceMethod" NOT NULL,
    "marcada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "marcada_por" TEXT,

    CONSTRAINT "asistencia_pkey" PRIMARY KEY ("id_asistencia")
);

-- CreateTable
CREATE TABLE "categoria_academica" (
    "id_categoria_academica" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "categoria_academica_pkey" PRIMARY KEY ("id_categoria_academica")
);

-- CreateTable
CREATE TABLE "estudio_profesor" (
    "id_estudio_profesor" TEXT NOT NULL,
    "id_profesor" TEXT NOT NULL,
    "grado" TEXT NOT NULL,
    "disciplina" TEXT NOT NULL,
    "institucion" TEXT,
    "anio" INTEGER,

    CONSTRAINT "estudio_profesor_pkey" PRIMARY KEY ("id_estudio_profesor")
);

-- CreateTable
CREATE TABLE "publicacion_profesor" (
    "id_publicacion" TEXT NOT NULL,
    "id_profesor" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "anio" INTEGER,
    "enlace" TEXT,

    CONSTRAINT "publicacion_profesor_pkey" PRIMARY KEY ("id_publicacion")
);

-- CreateTable
CREATE TABLE "categoria_profesor" (
    "id_profesor" TEXT NOT NULL,
    "id_categoria" TEXT NOT NULL,

    CONSTRAINT "categoria_profesor_pkey" PRIMARY KEY ("id_profesor","id_categoria")
);

-- CreateTable
CREATE TABLE "alias_profesor" (
    "id_alias_profesor" TEXT NOT NULL,
    "id_profesor" TEXT NOT NULL,
    "alias" TEXT NOT NULL,

    CONSTRAINT "alias_profesor_pkey" PRIMARY KEY ("id_alias_profesor")
);

-- CreateTable
CREATE TABLE "retroalimentacion_mensaje" (
    "id_mensaje" TEXT NOT NULL,
    "valor" "FeedbackValue" NOT NULL,
    "comentario" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retroalimentacion_mensaje_pkey" PRIMARY KEY ("id_mensaje")
);

-- CreateTable
CREATE TABLE "tema" (
    "id_tema" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "etiqueta" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tema_pkey" PRIMARY KEY ("id_tema")
);

-- CreateTable
CREATE TABLE "etiqueta_conversacion" (
    "id_etiqueta" TEXT NOT NULL,
    "id_conversacion" TEXT NOT NULL,
    "id_tema" TEXT NOT NULL,
    "fuente" "LabelSource" NOT NULL,
    "confianza" DECIMAL(3,2),
    "version_modelo" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "etiqueta_conversacion_pkey" PRIMARY KEY ("id_etiqueta")
);

-- CreateTable
CREATE TABLE "opcion_resultado_ia" (
    "id_opcion_ia" TEXT NOT NULL,
    "id_resultado_ia" TEXT NOT NULL,
    "posicion" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,

    CONSTRAINT "opcion_resultado_ia_pkey" PRIMARY KEY ("id_opcion_ia")
);

-- CreateTable
CREATE TABLE "resumen_psicologico" (
    "id_resumen_psicologico" TEXT NOT NULL,
    "id_alumno" TEXT NOT NULL,
    "id_destinatario" TEXT,
    "contenido" TEXT NOT NULL,
    "estado" "SummaryStatus" NOT NULL DEFAULT 'DRAFT',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aprobado_en" TIMESTAMP(3),
    "compartido_en" TIMESTAMP(3),
    "revocado_en" TIMESTAMP(3),

    CONSTRAINT "resumen_psicologico_pkey" PRIMARY KEY ("id_resumen_psicologico")
);

-- CreateTable
CREATE TABLE "preferencia_aviso" (
    "id_usuario" TEXT NOT NULL,
    "correo_activo" BOOLEAN NOT NULL DEFAULT true,
    "recordatorio_clase" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "preferencia_aviso_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateTable
CREATE TABLE "cuestionario" (
    "id_cuestionario" TEXT NOT NULL,
    "tipo" "QuestionnaireKind" NOT NULL,
    "version" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cuestionario_pkey" PRIMARY KEY ("id_cuestionario")
);

-- CreateTable
CREATE TABLE "pregunta" (
    "id_pregunta" TEXT NOT NULL,
    "id_cuestionario" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "posicion" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "tipo" "QuestionType" NOT NULL,
    "obligatoria" BOOLEAN NOT NULL DEFAULT true,
    "categoria" "categoria_pregunta",

    CONSTRAINT "pregunta_pkey" PRIMARY KEY ("id_pregunta")
);

-- CreateTable
CREATE TABLE "opcion_pregunta" (
    "id_opcion_pregunta" TEXT NOT NULL,
    "id_pregunta" TEXT NOT NULL,
    "posicion" INTEGER NOT NULL,
    "valor" TEXT NOT NULL,
    "etiqueta" TEXT NOT NULL,

    CONSTRAINT "opcion_pregunta_pkey" PRIMARY KEY ("id_opcion_pregunta")
);

-- CreateTable
CREATE TABLE "envio_cuestionario" (
    "id_envio" TEXT NOT NULL,
    "id_alumno" TEXT NOT NULL,
    "id_cuestionario" TEXT NOT NULL,
    "id_periodo" TEXT,
    "id_materia" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "envio_cuestionario_pkey" PRIMARY KEY ("id_envio")
);

-- CreateTable
CREATE TABLE "respuesta" (
    "id_respuesta" TEXT NOT NULL,
    "id_envio" TEXT NOT NULL,
    "id_pregunta" TEXT NOT NULL,
    "id_opcion_pregunta" TEXT,
    "valor_numerico" INTEGER,
    "valor_texto" TEXT,

    CONSTRAINT "respuesta_pkey" PRIMARY KEY ("id_respuesta")
);

-- CreateTable
CREATE TABLE "documento_conocimiento" (
    "id_documento_conocimiento" TEXT NOT NULL,
    "id_institucion" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "url_fuente" TEXT,
    "estado" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "fragmentos" INTEGER NOT NULL DEFAULT 0,
    "subido_por" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documento_conocimiento_pkey" PRIMARY KEY ("id_documento_conocimiento")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_correo_key" ON "usuario"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_google_sub_key" ON "usuario"("google_sub");

-- CreateIndex
CREATE INDEX "usuario_id_institucion_idx" ON "usuario"("id_institucion");

-- CreateIndex
CREATE UNIQUE INDEX "rol_usuario_id_usuario_rol_key" ON "rol_usuario"("id_usuario", "rol");

-- CreateIndex
CREATE INDEX "metodo_contacto_id_usuario_idx" ON "metodo_contacto"("id_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "aviso_privacidad_tipo_version_key" ON "aviso_privacidad"("tipo", "version");

-- CreateIndex
CREATE INDEX "consentimiento_id_usuario_tipo_creado_en_idx" ON "consentimiento"("id_usuario", "tipo", "creado_en");

-- CreateIndex
CREATE INDEX "bitacora_auditoria_id_actor_creado_en_idx" ON "bitacora_auditoria"("id_actor", "creado_en");

-- CreateIndex
CREATE UNIQUE INDEX "periodo_academico_id_institucion_clave_key" ON "periodo_academico"("id_institucion", "clave");

-- CreateIndex
CREATE INDEX "inscripcion_id_alumno_idx" ON "inscripcion"("id_alumno");

-- CreateIndex
CREATE INDEX "inscripcion_id_grupo_idx" ON "inscripcion"("id_grupo");

-- CreateIndex
CREATE UNIQUE INDEX "inscripcion_id_alumno_id_materia_id_periodo_key" ON "inscripcion"("id_alumno", "id_materia", "id_periodo");

-- CreateIndex
CREATE UNIQUE INDEX "historial_academico_id_alumno_id_periodo_key" ON "historial_academico"("id_alumno", "id_periodo");

-- CreateIndex
CREATE UNIQUE INDEX "grupo_codigo_ingreso_key" ON "grupo"("codigo_ingreso");

-- CreateIndex
CREATE INDEX "grupo_id_profesor_idx" ON "grupo"("id_profesor");

-- CreateIndex
CREATE UNIQUE INDEX "grupo_id_materia_id_periodo_clave_grupo_key" ON "grupo"("id_materia", "id_periodo", "clave_grupo");

-- CreateIndex
CREATE INDEX "horario_grupo_id_grupo_idx" ON "horario_grupo"("id_grupo");

-- CreateIndex
CREATE INDEX "lista_grupo_id_alumno_vinculado_idx" ON "lista_grupo"("id_alumno_vinculado");

-- CreateIndex
CREATE UNIQUE INDEX "lista_grupo_id_grupo_numero_cuenta_key" ON "lista_grupo"("id_grupo", "numero_cuenta");

-- CreateIndex
CREATE INDEX "sesion_clase_id_grupo_inicia_en_idx" ON "sesion_clase"("id_grupo", "inicia_en");

-- CreateIndex
CREATE UNIQUE INDEX "asistencia_id_sesion_clase_id_alumno_key" ON "asistencia"("id_sesion_clase", "id_alumno");

-- CreateIndex
CREATE UNIQUE INDEX "categoria_academica_nombre_key" ON "categoria_academica"("nombre");

-- CreateIndex
CREATE INDEX "estudio_profesor_id_profesor_idx" ON "estudio_profesor"("id_profesor");

-- CreateIndex
CREATE INDEX "publicacion_profesor_id_profesor_idx" ON "publicacion_profesor"("id_profesor");

-- CreateIndex
CREATE UNIQUE INDEX "alias_profesor_alias_key" ON "alias_profesor"("alias");

-- CreateIndex
CREATE UNIQUE INDEX "tema_clave_key" ON "tema"("clave");

-- CreateIndex
CREATE INDEX "etiqueta_conversacion_id_tema_idx" ON "etiqueta_conversacion"("id_tema");

-- CreateIndex
CREATE UNIQUE INDEX "etiqueta_conversacion_id_conversacion_fuente_id_tema_key" ON "etiqueta_conversacion"("id_conversacion", "fuente", "id_tema");

-- CreateIndex
CREATE UNIQUE INDEX "opcion_resultado_ia_id_resultado_ia_posicion_key" ON "opcion_resultado_ia"("id_resultado_ia", "posicion");

-- CreateIndex
CREATE INDEX "resumen_psicologico_id_alumno_idx" ON "resumen_psicologico"("id_alumno");

-- CreateIndex
CREATE INDEX "resumen_psicologico_id_destinatario_estado_idx" ON "resumen_psicologico"("id_destinatario", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "cuestionario_tipo_version_key" ON "cuestionario"("tipo", "version");

-- CreateIndex
CREATE UNIQUE INDEX "pregunta_id_cuestionario_clave_key" ON "pregunta"("id_cuestionario", "clave");

-- CreateIndex
CREATE UNIQUE INDEX "opcion_pregunta_id_pregunta_valor_key" ON "opcion_pregunta"("id_pregunta", "valor");

-- CreateIndex
CREATE INDEX "envio_cuestionario_id_alumno_id_cuestionario_idx" ON "envio_cuestionario"("id_alumno", "id_cuestionario");

-- CreateIndex
CREATE INDEX "respuesta_id_envio_idx" ON "respuesta"("id_envio");

-- CreateIndex
CREATE INDEX "respuesta_id_pregunta_idx" ON "respuesta"("id_pregunta");

-- CreateIndex
CREATE INDEX "documento_conocimiento_id_institucion_estado_idx" ON "documento_conocimiento"("id_institucion", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "alumno_id_usuario_key" ON "alumno"("id_usuario");

-- CreateIndex
CREATE INDEX "conversaciones_id_alumno_idx" ON "conversaciones"("id_alumno");

-- CreateIndex
CREATE INDEX "conversaciones_id_carrera_creado_en_idx" ON "conversaciones"("id_carrera", "creado_en");

-- CreateIndex
CREATE INDEX "materia_id_plan_estudios_idx" ON "materia"("id_plan_estudios");

-- CreateIndex
CREATE INDEX "mensajes_id_conversacion_creado_en_idx" ON "mensajes"("id_conversacion", "creado_en");

-- CreateIndex
CREATE UNIQUE INDEX "profesores_id_usuario_key" ON "profesores"("id_usuario");

-- CreateIndex
CREATE INDEX "resultado_ia_id_alumno_idx" ON "resultado_ia"("id_alumno");

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_id_institucion_fkey" FOREIGN KEY ("id_institucion") REFERENCES "institucion"("id_institucion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rol_usuario" ADD CONSTRAINT "rol_usuario_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perfil_personal" ADD CONSTRAINT "perfil_personal_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metodo_contacto" ADD CONSTRAINT "metodo_contacto_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consentimiento" ADD CONSTRAINT "consentimiento_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consentimiento" ADD CONSTRAINT "consentimiento_id_aviso_fkey" FOREIGN KEY ("id_aviso") REFERENCES "aviso_privacidad"("id_aviso") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alumno" ADD CONSTRAINT "alumno_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alumno" ADD CONSTRAINT "alumno_id_carrera_fkey" FOREIGN KEY ("id_carrera") REFERENCES "carrera"("id_carrera") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodo_academico" ADD CONSTRAINT "periodo_academico_id_institucion_fkey" FOREIGN KEY ("id_institucion") REFERENCES "institucion"("id_institucion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscripcion" ADD CONSTRAINT "inscripcion_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumno"("id_alumno") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscripcion" ADD CONSTRAINT "inscripcion_id_materia_fkey" FOREIGN KEY ("id_materia") REFERENCES "materia"("id_materia") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscripcion" ADD CONSTRAINT "inscripcion_id_periodo_fkey" FOREIGN KEY ("id_periodo") REFERENCES "periodo_academico"("id_periodo") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscripcion" ADD CONSTRAINT "inscripcion_id_grupo_fkey" FOREIGN KEY ("id_grupo") REFERENCES "grupo"("id_grupo") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_academico" ADD CONSTRAINT "historial_academico_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumno"("id_alumno") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_academico" ADD CONSTRAINT "historial_academico_id_periodo_fkey" FOREIGN KEY ("id_periodo") REFERENCES "periodo_academico"("id_periodo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrera" ADD CONSTRAINT "carrera_id_institucion_fkey" FOREIGN KEY ("id_institucion") REFERENCES "institucion"("id_institucion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materia" ADD CONSTRAINT "materia_id_plan_estudios_fkey" FOREIGN KEY ("id_plan_estudios") REFERENCES "plan_estudios"("id_plan_estudios") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materia_seriacion" ADD CONSTRAINT "materia_seriacion_id_materia_fkey" FOREIGN KEY ("id_materia") REFERENCES "materia"("id_materia") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materia_seriacion" ADD CONSTRAINT "materia_seriacion_id_materia_requisito_fkey" FOREIGN KEY ("id_materia_requisito") REFERENCES "materia"("id_materia") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupo" ADD CONSTRAINT "grupo_id_materia_fkey" FOREIGN KEY ("id_materia") REFERENCES "materia"("id_materia") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupo" ADD CONSTRAINT "grupo_id_periodo_fkey" FOREIGN KEY ("id_periodo") REFERENCES "periodo_academico"("id_periodo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupo" ADD CONSTRAINT "grupo_id_profesor_fkey" FOREIGN KEY ("id_profesor") REFERENCES "profesores"("id_profesor") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horario_grupo" ADD CONSTRAINT "horario_grupo_id_grupo_fkey" FOREIGN KEY ("id_grupo") REFERENCES "grupo"("id_grupo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importacion_horario" ADD CONSTRAINT "importacion_horario_id_periodo_fkey" FOREIGN KEY ("id_periodo") REFERENCES "periodo_academico"("id_periodo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lista_grupo" ADD CONSTRAINT "lista_grupo_id_grupo_fkey" FOREIGN KEY ("id_grupo") REFERENCES "grupo"("id_grupo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lista_grupo" ADD CONSTRAINT "lista_grupo_id_alumno_vinculado_fkey" FOREIGN KEY ("id_alumno_vinculado") REFERENCES "alumno"("id_alumno") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carga_lista" ADD CONSTRAINT "carga_lista_id_grupo_fkey" FOREIGN KEY ("id_grupo") REFERENCES "grupo"("id_grupo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesion_clase" ADD CONSTRAINT "sesion_clase_id_grupo_fkey" FOREIGN KEY ("id_grupo") REFERENCES "grupo"("id_grupo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencia" ADD CONSTRAINT "asistencia_id_sesion_clase_fkey" FOREIGN KEY ("id_sesion_clase") REFERENCES "sesion_clase"("id_sesion_clase") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencia" ADD CONSTRAINT "asistencia_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumno"("id_alumno") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profesores" ADD CONSTRAINT "profesores_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profesores" ADD CONSTRAINT "profesores_id_categoria_academica_fkey" FOREIGN KEY ("id_categoria_academica") REFERENCES "categoria_academica"("id_categoria_academica") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estudio_profesor" ADD CONSTRAINT "estudio_profesor_id_profesor_fkey" FOREIGN KEY ("id_profesor") REFERENCES "profesores"("id_profesor") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publicacion_profesor" ADD CONSTRAINT "publicacion_profesor_id_profesor_fkey" FOREIGN KEY ("id_profesor") REFERENCES "profesores"("id_profesor") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categoria_profesor" ADD CONSTRAINT "categoria_profesor_id_profesor_fkey" FOREIGN KEY ("id_profesor") REFERENCES "profesores"("id_profesor") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categoria_profesor" ADD CONSTRAINT "categoria_profesor_id_categoria_fkey" FOREIGN KEY ("id_categoria") REFERENCES "categoria"("id_categoria") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alias_profesor" ADD CONSTRAINT "alias_profesor_id_profesor_fkey" FOREIGN KEY ("id_profesor") REFERENCES "profesores"("id_profesor") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversaciones" ADD CONSTRAINT "conversaciones_id_carrera_fkey" FOREIGN KEY ("id_carrera") REFERENCES "carrera"("id_carrera") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retroalimentacion_mensaje" ADD CONSTRAINT "retroalimentacion_mensaje_id_mensaje_fkey" FOREIGN KEY ("id_mensaje") REFERENCES "mensajes"("id_mensaje") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etiqueta_conversacion" ADD CONSTRAINT "etiqueta_conversacion_id_conversacion_fkey" FOREIGN KEY ("id_conversacion") REFERENCES "conversaciones"("id_conversacion") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etiqueta_conversacion" ADD CONSTRAINT "etiqueta_conversacion_id_tema_fkey" FOREIGN KEY ("id_tema") REFERENCES "tema"("id_tema") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultado_ia" ADD CONSTRAINT "resultado_ia_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumno"("id_alumno") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opcion_resultado_ia" ADD CONSTRAINT "opcion_resultado_ia_id_resultado_ia_fkey" FOREIGN KEY ("id_resultado_ia") REFERENCES "resultado_ia"("id_resultado_ia") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resumen_psicologico" ADD CONSTRAINT "resumen_psicologico_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumno"("id_alumno") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preferencia_aviso" ADD CONSTRAINT "preferencia_aviso_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pregunta" ADD CONSTRAINT "pregunta_id_cuestionario_fkey" FOREIGN KEY ("id_cuestionario") REFERENCES "cuestionario"("id_cuestionario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opcion_pregunta" ADD CONSTRAINT "opcion_pregunta_id_pregunta_fkey" FOREIGN KEY ("id_pregunta") REFERENCES "pregunta"("id_pregunta") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envio_cuestionario" ADD CONSTRAINT "envio_cuestionario_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumno"("id_alumno") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envio_cuestionario" ADD CONSTRAINT "envio_cuestionario_id_cuestionario_fkey" FOREIGN KEY ("id_cuestionario") REFERENCES "cuestionario"("id_cuestionario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envio_cuestionario" ADD CONSTRAINT "envio_cuestionario_id_periodo_fkey" FOREIGN KEY ("id_periodo") REFERENCES "periodo_academico"("id_periodo") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envio_cuestionario" ADD CONSTRAINT "envio_cuestionario_id_materia_fkey" FOREIGN KEY ("id_materia") REFERENCES "materia"("id_materia") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respuesta" ADD CONSTRAINT "respuesta_id_envio_fkey" FOREIGN KEY ("id_envio") REFERENCES "envio_cuestionario"("id_envio") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respuesta" ADD CONSTRAINT "respuesta_id_pregunta_fkey" FOREIGN KEY ("id_pregunta") REFERENCES "pregunta"("id_pregunta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respuesta" ADD CONSTRAINT "respuesta_id_opcion_pregunta_fkey" FOREIGN KEY ("id_opcion_pregunta") REFERENCES "opcion_pregunta"("id_opcion_pregunta") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento_conocimiento" ADD CONSTRAINT "documento_conocimiento_id_institucion_fkey" FOREIGN KEY ("id_institucion") REFERENCES "institucion"("id_institucion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiencia_profesional" ADD CONSTRAINT "experiencia_profesional_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumno"("id_alumno") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concurso_alumno" ADD CONSTRAINT "concurso_alumno_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumno"("id_alumno") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curso_alumno" ADD CONSTRAINT "curso_alumno_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumno"("id_alumno") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beca_alumno" ADD CONSTRAINT "beca_alumno_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumno"("id_alumno") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idioma_alumno" ADD CONSTRAINT "idioma_alumno_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumno"("id_alumno") ON DELETE CASCADE ON UPDATE CASCADE;
