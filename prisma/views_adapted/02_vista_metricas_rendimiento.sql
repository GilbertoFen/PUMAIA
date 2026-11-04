-- =====================================================================
-- VISTA ADAPTADA 2: vista_metricas_rendimiento_academico
-- Agregación de aprobación, reprobación y promedio por materia y periodo.
-- Regla de privacidad: k-anonymity con umbral mínimo de 10 alumnos únicos.
-- Correcciones aplicadas:
-- 1. m.materia (columna física real en tabla materia).
-- 2. COUNT(DISTINCT i.id_alumno) >= 10 (conteo de estudiantes únicos).
-- =====================================================================

CREATE OR REPLACE VIEW vista_metricas_rendimiento_academico AS
SELECT
  p.id_periodo,
  p.clave AS clave_periodo,
  m.id_materia,
  m.materia AS materia,
  cat.categoria AS categoria_materia,
  CASE
    WHEN COUNT(DISTINCT i.id_alumno) >= 10 THEN COUNT(DISTINCT i.id_alumno)::TEXT
    ELSE '<10'
  END AS total_alumnos_muestra,
  CASE
    WHEN COUNT(DISTINCT i.id_alumno) >= 10 THEN
      ROUND(AVG(CASE WHEN i.calificacion IS NOT NULL THEN i.calificacion ELSE NULL END), 2)::TEXT
    ELSE 'RESTRINGIDO'
  END AS promedio_general,
  CASE
    WHEN COUNT(DISTINCT i.id_alumno) >= 10 THEN
      ROUND((COUNT(DISTINCT CASE WHEN i.estado = 'PASSED' THEN i.id_alumno END)::NUMERIC / NULLIF(COUNT(DISTINCT i.id_alumno), 0)) * 100, 2)::TEXT
    ELSE 'RESTRINGIDO'
  END AS porcentaje_aprobacion,
  CASE
    WHEN COUNT(DISTINCT i.id_alumno) >= 10 THEN
      ROUND((COUNT(DISTINCT CASE WHEN i.estado = 'FAILED' THEN i.id_alumno END)::NUMERIC / NULLIF(COUNT(DISTINCT i.id_alumno), 0)) * 100, 2)::TEXT
    ELSE 'RESTRINGIDO'
  END AS porcentaje_reprobacion
FROM materia m
JOIN inscripcion i ON i.id_materia = m.id_materia
LEFT JOIN periodo_academico p ON p.id_periodo = i.id_periodo
LEFT JOIN categoria cat ON cat.id_categoria = m.id_categoria
GROUP BY p.id_periodo, p.clave, m.id_materia, m.materia, cat.categoria;
