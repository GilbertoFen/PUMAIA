-- CreateEnum
CREATE TYPE "KnowledgeAreaEnum" AS ENUM ('CIENCIAS_FISICO_MATEMATICAS_Y_DE_LAS_INGENIERIAS', 'CIENCIAS_BIOLOGICAS_Y_DE_LA_SALUD', 'CIENCIAS_SOCIALES', 'HUMANIDADES_Y_ARTES');

-- CreateEnum
CREATE TYPE "CategoryEnum" AS ENUM ('MATEMATICAS', 'PROBABILIDAD_ESTADISTICA_Y_OPTIMIZACION', 'MATEMATICAS_COMPUTACIONALES', 'COMPUTACION', 'HUMANISTICA_SOCIAL', 'MODELADO_ANALITICO', 'MODELADO_ESTOCASTICO', 'ADMINISTRACION_Y_FINANZAS', 'SISTEMAS_COMPUTACIONALES', 'CIENCIAS_DE_LA_COMPUTACION');

-- CreateTable
CREATE TABLE "alumno" (
    "id_alumno" TEXT NOT NULL,
    "numero_cuenta" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido_paterno" TEXT NOT NULL,
    "apellido_materno" TEXT NOT NULL,
    "interes" TEXT,
    "semestre_actual" INTEGER NOT NULL,
    "promedio" INTEGER NOT NULL,
    "correo" TEXT NOT NULL,
    "contrasena" TEXT NOT NULL,
    "id_direccion" TEXT,

    CONSTRAINT "alumno_pkey" PRIMARY KEY ("id_alumno")
);

-- CreateTable
CREATE TABLE "categoria_ia" (
    "id_categoria_ia" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "categoria_ia_pkey" PRIMARY KEY ("id_categoria_ia")
);

-- CreateTable
CREATE TABLE "resultado_ia" (
    "id_resultado_ia" TEXT NOT NULL,
    "opcion_a" TEXT NOT NULL,
    "descripcion_a" TEXT NOT NULL,
    "opcion_b" TEXT NOT NULL,
    "descripcion_b" TEXT NOT NULL,
    "opcion_c" TEXT NOT NULL,
    "descripcion_c" TEXT NOT NULL,
    "opcion_d" TEXT NOT NULL,
    "descripcion_d" TEXT NOT NULL,
    "opcion_e" TEXT NOT NULL,
    "descripcion_e" TEXT NOT NULL,
    "id_alumno" TEXT NOT NULL,
    "id_categoria_ia" TEXT NOT NULL,

    CONSTRAINT "resultado_ia_pkey" PRIMARY KEY ("id_resultado_ia")
);

-- CreateTable
CREATE TABLE "area_expertise" (
    "id_area_expertise" TEXT NOT NULL,
    "area_expertise" TEXT NOT NULL,

    CONSTRAINT "area_expertise_pkey" PRIMARY KEY ("id_area_expertise")
);

-- CreateTable
CREATE TABLE "experiencia_profesional" (
    "id_experiencia_profesional" TEXT NOT NULL,
    "id_area_expertise" TEXT NOT NULL,
    "id_alumno" TEXT NOT NULL,
    "id_categoria" TEXT NOT NULL,

    CONSTRAINT "experiencia_profesional_pkey" PRIMARY KEY ("id_experiencia_profesional")
);

-- CreateTable
CREATE TABLE "concurso" (
    "id_concurso" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "id_categoria" TEXT NOT NULL,

    CONSTRAINT "concurso_pkey" PRIMARY KEY ("id_concurso")
);

-- CreateTable
CREATE TABLE "concurso_alumno" (
    "id_concurso_alumno" TEXT NOT NULL,
    "id_concurso" TEXT NOT NULL,
    "id_alumno" TEXT NOT NULL,

    CONSTRAINT "concurso_alumno_pkey" PRIMARY KEY ("id_concurso_alumno")
);

-- CreateTable
CREATE TABLE "area_conocimiento" (
    "id_area_conocimiento" TEXT NOT NULL,
    "area_conocimiento" "KnowledgeAreaEnum" NOT NULL,

    CONSTRAINT "area_conocimiento_pkey" PRIMARY KEY ("id_area_conocimiento")
);

-- CreateTable
CREATE TABLE "plan_estudios" (
    "id_plan_estudios" TEXT NOT NULL,
    "plan_estudios" TEXT NOT NULL,
    "cantidad_semestres" INTEGER NOT NULL,

    CONSTRAINT "plan_estudios_pkey" PRIMARY KEY ("id_plan_estudios")
);

-- CreateTable
CREATE TABLE "categoria" (
    "id_categoria" TEXT NOT NULL,
    "categoria" "CategoryEnum" NOT NULL,

    CONSTRAINT "categoria_pkey" PRIMARY KEY ("id_categoria")
);

-- CreateTable
CREATE TABLE "materia" (
    "id_materia" TEXT NOT NULL,
    "materia" TEXT NOT NULL,
    "id_categoria" TEXT NOT NULL,

    CONSTRAINT "materia_pkey" PRIMARY KEY ("id_materia")
);

-- CreateTable
CREATE TABLE "calificacion" (
    "id_calificacion" TEXT NOT NULL,
    "calificacion" INTEGER NOT NULL,
    "id_materia" TEXT NOT NULL,
    "id_alumno" TEXT NOT NULL,

    CONSTRAINT "calificacion_pkey" PRIMARY KEY ("id_calificacion")
);

-- CreateTable
CREATE TABLE "carrera" (
    "id_carrera" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "id_plan_estudios" TEXT NOT NULL,
    "id_area_conocimiento" TEXT NOT NULL,
    "es_maestria" BOOLEAN NOT NULL,

    CONSTRAINT "carrera_pkey" PRIMARY KEY ("id_carrera")
);

-- CreateTable
CREATE TABLE "carrera_alumno" (
    "id_carrera_alumno" TEXT NOT NULL,
    "id_carrera" TEXT NOT NULL,
    "id_alumno" TEXT NOT NULL,
    "es_egresado" BOOLEAN NOT NULL,

    CONSTRAINT "carrera_alumno_pkey" PRIMARY KEY ("id_carrera_alumno")
);

-- CreateTable
CREATE TABLE "direccion" (
    "id_direccion" TEXT NOT NULL,
    "calle" TEXT,
    "codigo_postal" INTEGER NOT NULL,
    "id_colonia" TEXT NOT NULL,
    "id_municipio" TEXT NOT NULL,
    "id_estado" TEXT NOT NULL,

    CONSTRAINT "direccion_pkey" PRIMARY KEY ("id_direccion")
);

-- CreateTable
CREATE TABLE "estado" (
    "id_estado" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "estado_pkey" PRIMARY KEY ("id_estado")
);

-- CreateTable
CREATE TABLE "colonia" (
    "id_colonia" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "colonia_pkey" PRIMARY KEY ("id_colonia")
);

-- CreateTable
CREATE TABLE "municipio" (
    "id_municipio" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "municipio_pkey" PRIMARY KEY ("id_municipio")
);

-- CreateTable
CREATE TABLE "idioma_alumno" (
    "id_idioma_alumno" TEXT NOT NULL,
    "id_alumno" TEXT NOT NULL,
    "id_idioma" TEXT NOT NULL,
    "id_habilidad" TEXT NOT NULL,

    CONSTRAINT "idioma_alumno_pkey" PRIMARY KEY ("id_idioma_alumno")
);

-- CreateTable
CREATE TABLE "habilidad" (
    "id_habilidad" TEXT NOT NULL,
    "nivel" TEXT NOT NULL,

    CONSTRAINT "habilidad_pkey" PRIMARY KEY ("id_habilidad")
);

-- CreateTable
CREATE TABLE "idioma" (
    "id_idioma" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "idioma_pkey" PRIMARY KEY ("id_idioma")
);

-- CreateTable
CREATE TABLE "certificado" (
    "id_certificado" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "id_idioma" TEXT NOT NULL,

    CONSTRAINT "certificado_pkey" PRIMARY KEY ("id_certificado")
);

-- CreateTable
CREATE TABLE "curso_alumno" (
    "id_curso_alumno" TEXT NOT NULL,
    "id_alumno" TEXT NOT NULL,
    "id_curso" TEXT NOT NULL,

    CONSTRAINT "curso_alumno_pkey" PRIMARY KEY ("id_curso_alumno")
);

-- CreateTable
CREATE TABLE "curso" (
    "id_curso" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "id_categoria" TEXT NOT NULL,

    CONSTRAINT "curso_pkey" PRIMARY KEY ("id_curso")
);

-- CreateTable
CREATE TABLE "beca_alumno" (
    "id_beca_alumno" TEXT NOT NULL,
    "id_alumno" TEXT NOT NULL,
    "id_beca" TEXT NOT NULL,

    CONSTRAINT "beca_alumno_pkey" PRIMARY KEY ("id_beca_alumno")
);

-- CreateTable
CREATE TABLE "beca" (
    "id_beca" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "id_categoria" TEXT NOT NULL,

    CONSTRAINT "beca_pkey" PRIMARY KEY ("id_beca")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" BIGSERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "embedding" vector(1536) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "alumno_numero_cuenta_key" ON "alumno"("numero_cuenta");

-- CreateIndex
CREATE UNIQUE INDEX "alumno_correo_key" ON "alumno"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "idioma_alumno_id_alumno_id_idioma_key" ON "idioma_alumno"("id_alumno", "id_idioma");

-- CreateIndex
CREATE UNIQUE INDEX "habilidad_nivel_key" ON "habilidad"("nivel");

-- CreateIndex
CREATE UNIQUE INDEX "idioma_nombre_key" ON "idioma"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "curso_alumno_id_alumno_id_curso_key" ON "curso_alumno"("id_alumno", "id_curso");

-- CreateIndex
CREATE UNIQUE INDEX "beca_alumno_id_alumno_id_beca_key" ON "beca_alumno"("id_alumno", "id_beca");

-- AddForeignKey
ALTER TABLE "alumno" ADD CONSTRAINT "alumno_id_direccion_fkey" FOREIGN KEY ("id_direccion") REFERENCES "direccion"("id_direccion") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultado_ia" ADD CONSTRAINT "resultado_ia_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumno"("id_alumno") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultado_ia" ADD CONSTRAINT "resultado_ia_id_categoria_ia_fkey" FOREIGN KEY ("id_categoria_ia") REFERENCES "categoria_ia"("id_categoria_ia") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiencia_profesional" ADD CONSTRAINT "experiencia_profesional_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumno"("id_alumno") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiencia_profesional" ADD CONSTRAINT "experiencia_profesional_id_area_expertise_fkey" FOREIGN KEY ("id_area_expertise") REFERENCES "area_expertise"("id_area_expertise") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiencia_profesional" ADD CONSTRAINT "experiencia_profesional_id_categoria_fkey" FOREIGN KEY ("id_categoria") REFERENCES "categoria"("id_categoria") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concurso" ADD CONSTRAINT "concurso_id_categoria_fkey" FOREIGN KEY ("id_categoria") REFERENCES "categoria"("id_categoria") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concurso_alumno" ADD CONSTRAINT "concurso_alumno_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumno"("id_alumno") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concurso_alumno" ADD CONSTRAINT "concurso_alumno_id_concurso_fkey" FOREIGN KEY ("id_concurso") REFERENCES "concurso"("id_concurso") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materia" ADD CONSTRAINT "materia_id_categoria_fkey" FOREIGN KEY ("id_categoria") REFERENCES "categoria"("id_categoria") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calificacion" ADD CONSTRAINT "calificacion_id_materia_fkey" FOREIGN KEY ("id_materia") REFERENCES "materia"("id_materia") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calificacion" ADD CONSTRAINT "calificacion_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumno"("id_alumno") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrera" ADD CONSTRAINT "carrera_id_plan_estudios_fkey" FOREIGN KEY ("id_plan_estudios") REFERENCES "plan_estudios"("id_plan_estudios") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrera" ADD CONSTRAINT "carrera_id_area_conocimiento_fkey" FOREIGN KEY ("id_area_conocimiento") REFERENCES "area_conocimiento"("id_area_conocimiento") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrera_alumno" ADD CONSTRAINT "carrera_alumno_id_carrera_fkey" FOREIGN KEY ("id_carrera") REFERENCES "carrera"("id_carrera") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrera_alumno" ADD CONSTRAINT "carrera_alumno_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumno"("id_alumno") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direccion" ADD CONSTRAINT "direccion_id_colonia_fkey" FOREIGN KEY ("id_colonia") REFERENCES "colonia"("id_colonia") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direccion" ADD CONSTRAINT "direccion_id_municipio_fkey" FOREIGN KEY ("id_municipio") REFERENCES "municipio"("id_municipio") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direccion" ADD CONSTRAINT "direccion_id_estado_fkey" FOREIGN KEY ("id_estado") REFERENCES "estado"("id_estado") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idioma_alumno" ADD CONSTRAINT "idioma_alumno_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumno"("id_alumno") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idioma_alumno" ADD CONSTRAINT "idioma_alumno_id_idioma_fkey" FOREIGN KEY ("id_idioma") REFERENCES "idioma"("id_idioma") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idioma_alumno" ADD CONSTRAINT "idioma_alumno_id_habilidad_fkey" FOREIGN KEY ("id_habilidad") REFERENCES "habilidad"("id_habilidad") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificado" ADD CONSTRAINT "certificado_id_idioma_fkey" FOREIGN KEY ("id_idioma") REFERENCES "idioma"("id_idioma") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curso_alumno" ADD CONSTRAINT "curso_alumno_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumno"("id_alumno") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curso_alumno" ADD CONSTRAINT "curso_alumno_id_curso_fkey" FOREIGN KEY ("id_curso") REFERENCES "curso"("id_curso") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curso" ADD CONSTRAINT "curso_id_categoria_fkey" FOREIGN KEY ("id_categoria") REFERENCES "categoria"("id_categoria") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beca_alumno" ADD CONSTRAINT "beca_alumno_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumno"("id_alumno") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beca_alumno" ADD CONSTRAINT "beca_alumno_id_beca_fkey" FOREIGN KEY ("id_beca") REFERENCES "beca"("id_beca") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beca" ADD CONSTRAINT "beca_id_categoria_fkey" FOREIGN KEY ("id_categoria") REFERENCES "categoria"("id_categoria") ON DELETE RESTRICT ON UPDATE CASCADE;
