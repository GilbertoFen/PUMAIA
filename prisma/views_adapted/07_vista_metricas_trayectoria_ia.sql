-- =====================================================================
-- VISTA ADAPTADA 7: vista_metricas_trayectoria_ia
-- Distribución de áreas de especialidad y recomendaciones generadas por IA.
-- Regla de privacidad: k-anonymity con umbral mínimo de 10 alumnos únicos.
-- Correcciones aplicadas:
-- 1. opt.id_opcion_ia (columna física real en tabla opcion_resultado_ia).
-- 2. Enmascaramiento de total_rutas_propuestas cuando COUNT(DISTINCT ar.id_alumno) < 10.
-- =====================================================================

CREATE OR REPLACE VIEW vista_metricas_trayectoria_ia AS
SELECT
  c.id_carrera,
  c.nombre AS carrera,
  cat_ia.nombre AS categoria_vocacional,
  CASE
    WHEN COUNT(DISTINCT ar.id_alumno) >= 10 THEN COUNT(DISTINCT ar.id_alumno)::TEXT
    ELSE '<10'
  END AS alumnos_orientados,
  CASE
    WHEN COUNT(DISTINCT ar.id_alumno) >= 10 THEN COUNT(DISTINCT opt.id_opcion_ia)::TEXT
    ELSE 'RESTRINGIDO'
  END AS total_rutas_propuestas
FROM carrera c
JOIN alumno a ON a.id_carrera = c.id_carrera
JOIN resultado_ia ar ON ar.id_alumno = a.id_alumno
JOIN categoria_ia cat_ia ON cat_ia.id_categoria_ia = ar.id_categoria_ia
LEFT JOIN opcion_resultado_ia opt ON opt.id_resultado_ia = ar.id_resultado_ia
GROUP BY c.id_carrera, c.nombre, cat_ia.nombre;
