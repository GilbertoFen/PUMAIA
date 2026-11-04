-- =====================================================================
-- VISTA ADAPTADA 6: vista_metricas_cuestionarios_satisfaccion
-- Métricas agregadas de satisfacción estudiantil y clima universitario.
-- Regla de privacidad:
-- 1. Solo procesa valores numéricos (valor_numerico) y opciones estructuradas,
--    NUNCA texto libre (valor_texto).
-- 2. K-anonimato basado en estudiantes únicos (COUNT(DISTINCT env.id_alumno) >= 10).
-- =====================================================================

CREATE OR REPLACE VIEW vista_metricas_cuestionarios_satisfaccion AS
SELECT
  q.tipo AS tipo_cuestionario,
  q.version,
  pr.clave AS clave_pregunta,
  pr.texto AS pregunta,
  pr.categoria AS categoria_pregunta,
  CASE
    WHEN COUNT(DISTINCT env.id_alumno) >= 10 THEN COUNT(DISTINCT env.id_alumno)::TEXT
    ELSE '<10'
  END AS respuestas_muestra,
  CASE
    WHEN COUNT(DISTINCT env.id_alumno) >= 10 THEN
      ROUND(AVG(CASE WHEN ans.valor_numerico IS NOT NULL THEN ans.valor_numerico ELSE NULL END), 2)::TEXT
    ELSE 'RESTRINGIDO'
  END AS puntaje_promedio_escala
FROM cuestionario q
JOIN pregunta pr ON pr.id_cuestionario = q.id_cuestionario
JOIN respuesta ans ON ans.id_pregunta = pr.id_pregunta
JOIN envio_cuestionario env ON env.id_envio = ans.id_envio
GROUP BY q.tipo, q.version, pr.clave, pr.texto, pr.categoria;
