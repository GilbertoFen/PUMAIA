-- CreateTable
CREATE TABLE "alumno" (
    "id_alumno" TEXT NOT NULL,
    "numeroCuenta" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellidoP" TEXT NOT NULL,
    "apellidoM" TEXT NOT NULL,
    "interes" TEXT NOT NULL,
    "semestreAct" INTEGER NOT NULL,
    "promedio" INTEGER NOT NULL,
    "id_ubicacion" TEXT,

    CONSTRAINT "alumno_pkey" PRIMARY KEY ("id_alumno")
);

-- CreateTable
CREATE TABLE "categoria_ia" (
    "id_categoriaIA" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "categoria_ia_pkey" PRIMARY KEY ("id_categoriaIA")
);

-- CreateTable
CREATE TABLE "resultado_ia" (
    "id_resultadoIA" TEXT NOT NULL,
    "opcionA" TEXT NOT NULL,
    "descripcionA" TEXT NOT NULL,
    "opcionB" TEXT NOT NULL,
    "descripcionB" TEXT NOT NULL,
    "opcionC" TEXT NOT NULL,
    "descripcionC" TEXT NOT NULL,
    "opcionD" TEXT NOT NULL,
    "descripcionD" TEXT NOT NULL,
    "opcionE" TEXT NOT NULL,
    "descripcionE" TEXT NOT NULL,
    "id_alumno" TEXT NOT NULL,
    "id_categoriaIA" TEXT NOT NULL,

    CONSTRAINT "resultado_ia_pkey" PRIMARY KEY ("id_resultadoIA")
);

-- CreateTable
CREATE TABLE "area_expertise" (
    "id_areaExpertise" TEXT NOT NULL,
    "areaExpertise" TEXT NOT NULL,

    CONSTRAINT "area_expertise_pkey" PRIMARY KEY ("id_areaExpertise")
);

-- CreateTable
CREATE TABLE "experiencia_profesional" (
    "id_experienciaP" TEXT NOT NULL,
    "id_AreaExpertise" TEXT NOT NULL,
    "id_categoria" TEXT NOT NULL,

    CONSTRAINT "experiencia_profesional_pkey" PRIMARY KEY ("id_experienciaP")
);

-- CreateTable
CREATE TABLE "concurso" (
    "id_Concurso" TEXT NOT NULL,
    "concurso" TEXT NOT NULL,
    "id_categoria" TEXT NOT NULL,

    CONSTRAINT "concurso_pkey" PRIMARY KEY ("id_Concurso")
);

-- CreateTable
CREATE TABLE "concurso_alumno" (
    "id_concursoAlumno" TEXT NOT NULL,
    "id_concurso" TEXT NOT NULL,
    "id_alumno" TEXT NOT NULL,

    CONSTRAINT "concurso_alumno_pkey" PRIMARY KEY ("id_concursoAlumno")
);

-- AddForeignKey
ALTER TABLE "resultado_ia" ADD CONSTRAINT "resultado_ia_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumno"("id_alumno") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultado_ia" ADD CONSTRAINT "resultado_ia_id_categoriaIA_fkey" FOREIGN KEY ("id_categoriaIA") REFERENCES "categoria_ia"("id_categoriaIA") ON DELETE RESTRICT ON UPDATE CASCADE;
