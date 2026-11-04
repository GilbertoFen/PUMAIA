-- =====================================================================
-- VISTA ADAPTADA 4: vista_metricas_asistencia_grupos
-- Asistencia agregada por grupo y materia.
-- Reglas éticas y de privacidad:
-- 1. Sin rankings de profesores.
-- 2. Sin exposición de registros individuales.
-- 3. Mínimo 10 alumnos únicos por muestra.
-- Corrección aplicada: m.materia (columna física real en tabla materia).
-- =====================================================================

CREATE OR REPLACE VIEW vista_metricas_asistencia_grupos AS
SELECT
  g.id_grupo,
  g.clave_grupo,
  m.materia AS materia,
  p.clave AS periodo,
  CASE
    WHEN COUNT(DISTINCT ar.id_alumno) >= 10 THEN COUNT(DISTINCT ar.id_alumno)::TEXT
    ELSE '<10'
  END AS alumnos_asistentes_muestra,
  CASE
    WHEN COUNT(DISTINCT ar.id_alumno) >= 10 THEN
      ROUND((COUNT(CASE WHEN ar.estado = 'PRESENT' THEN 1 END)::NUMERIC / NULLIF(COUNT(ar.id_asistencia), 0)) * 100, 2)::TEXT
    ELSE 'RESTRINGIDO'
  END AS porcentaje_presente,
  CASE
    WHEN COUNT(DISTINCT ar.id_alumno) >= 10 THEN
      ROUND((COUNT(CASE WHEN ar.estado = 'ABSENT' THEN 1 END)::NUMERIC / NULLIF(COUNT(ar.id_asistencia), 0)) * 100, 2)::TEXT
    ELSE 'RESTRINGIDO'
  END AS porcentaje_inasistencia,
  CASE
    WHEN COUNT(DISTINCT ar.id_alumno) >= 10 THEN
      ROUND((COUNT(CASE WHEN ar.estado = 'LATE' THEN 1 END)::NUMERIC / NULLIF(COUNT(ar.id_asistencia), 0)) * 100, 2)::TEXT
    ELSE 'RESTRINGIDO'
  END AS porcentaje_retardo
FROM grupo g
JOIN materia m ON m.id_materia = g.id_materia
JOIN periodo_academico p ON p.id_periodo = g.id_periodo
JOIN sesion_clase sc ON sc.id_grupo = g.id_grupo
JOIN asistencia ar ON ar.id_sesion_clase = sc.id_sesion_clase
GROUP BY g.id_grupo, g.clave_grupo, m.materia, p.clave;
