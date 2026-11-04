-- =====================================================================
-- VISTA ADAPTADA 3: vista_metricas_rezago_abandono
-- Monitoreo de indicadores de abandono y no presentación por carrera y semestre.
-- Regla de privacidad: k-anonymity con umbral mínimo de 10 alumnos.
-- =====================================================================

CREATE OR REPLACE VIEW vista_metricas_rezago_abandono AS
SELECT
  c.id_carrera,
  c.nombre AS carrera,
  a.semestre_actual,
  CASE
    WHEN COUNT(DISTINCT a.id_alumno) >= 10 THEN COUNT(DISTINCT a.id_alumno)::TEXT
    ELSE '<10'
  END AS alumnos_en_cohorte,
  CASE
    WHEN COUNT(DISTINCT a.id_alumno) >= 10 THEN
      COUNT(CASE WHEN i.estado = 'NOT_PRESENTED' THEN 1 END)::TEXT
    ELSE 'RESTRINGIDO'
  END AS total_no_presentados,
  CASE
    WHEN COUNT(DISTINCT a.id_alumno) >= 10 THEN
      COUNT(CASE WHEN i.estado = 'WITHDRAWN' THEN 1 END)::TEXT
    ELSE 'RESTRINGIDO'
  END AS total_bajas,
  CASE
    WHEN COUNT(DISTINCT a.id_alumno) >= 10 THEN
      ROUND((COUNT(CASE WHEN i.estado IN ('NOT_PRESENTED', 'WITHDRAWN', 'FAILED') THEN 1 END)::NUMERIC / NULLIF(COUNT(i.id_inscripcion), 0)) * 100, 2)::TEXT
    ELSE 'RESTRINGIDO'
  END AS tasa_riesgo_academico
FROM carrera c
JOIN alumno a ON a.id_carrera = c.id_carrera
LEFT JOIN inscripcion i ON i.id_alumno = a.id_alumno
GROUP BY c.id_carrera, c.nombre, a.semestre_actual;

