-- CreateTable
CREATE TABLE "carrera" (
    "id_carrera" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "id_planEstudios" TEXT NOT NULL,
    "id_areaConocimiento" TEXT NOT NULL,
    "esMaestria" BOOLEAN NOT NULL,

    CONSTRAINT "carrera_pkey" PRIMARY KEY ("id_carrera")
);

-- CreateTable
CREATE TABLE "carrera_alumno" (
    "id_carreraAlumno" TEXT NOT NULL,
    "id_carrera" TEXT NOT NULL,
    "id_alumno" TEXT NOT NULL,
    "esEgresado" BOOLEAN NOT NULL,

    CONSTRAINT "carrera_alumno_pkey" PRIMARY KEY ("id_carreraAlumno")
);

-- AddForeignKey
ALTER TABLE "carrera" ADD CONSTRAINT "carrera_id_planEstudios_fkey" FOREIGN KEY ("id_planEstudios") REFERENCES "plan_estudios"("id_planEstudios") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrera" ADD CONSTRAINT "carrera_id_areaConocimiento_fkey" FOREIGN KEY ("id_areaConocimiento") REFERENCES "area_conocimiento"("id_areaConocimiento") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrera_alumno" ADD CONSTRAINT "carrera_alumno_id_carrera_fkey" FOREIGN KEY ("id_carrera") REFERENCES "carrera"("id_carrera") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrera_alumno" ADD CONSTRAINT "carrera_alumno_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumno"("id_alumno") ON DELETE RESTRICT ON UPDATE CASCADE;
