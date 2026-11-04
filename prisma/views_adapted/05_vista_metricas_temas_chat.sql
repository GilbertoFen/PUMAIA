-- =====================================================================
-- VISTA ADAPTADA 5: vista_metricas_temas_chat
-- Frecuencia y tendencias temáticas de consultas en el asistente PumaIA.
-- Reglas de privacidad:
-- 1. CERO contenido de mensajes o transcripciones.
-- 2. CERO identificadores de alumnos.
-- 3. Excluye conversaciones sensibles (conv.sensible = false) y verifica
--    que el alumno tenga otorgado el consentimiento vigente ANALYTICS.
-- 4. K-anonimato basado en alumnos únicos (COUNT(DISTINCT conv.id_alumno) >= 10).
-- =====================================================================

CREATE OR REPLACE VIEW vista_metricas_temas_chat AS
SELECT
  tc.id_tema,
  tc.clave AS clave_tema,
  tc.etiqueta AS tema,
  tc.grupo_tema,
  CASE
    WHEN COUNT(DISTINCT conv.id_alumno) >= 10 THEN COUNT(DISTINCT conv.id_alumno)::TEXT
    ELSE '<10'
  END AS alumnos_unicos_muestra,
  CASE
    WHEN COUNT(DISTINCT conv.id_alumno) >= 10 THEN COUNT(cl.id_etiqueta)::TEXT
    ELSE 'RESTRINGIDO'
  END AS total_consultas_asociadas,
  CASE
    WHEN COUNT(DISTINCT conv.id_alumno) >= 10 THEN
      ROUND(AVG(CASE WHEN cl.confianza IS NOT NULL THEN cl.confianza ELSE NULL END), 2)::TEXT
    ELSE 'RESTRINGIDO'
  END AS confianza_promedio_modelo
FROM tema tc
JOIN etiqueta_conversacion cl ON cl.id_tema = tc.id_tema
JOIN conversaciones conv ON conv.id_conversacion = cl.id_conversacion
JOIN alumno al ON al.id_alumno = conv.id_alumno
WHERE conv.sensible = false
  AND EXISTS (
    SELECT 1
    FROM consentimiento cs
    WHERE cs.id_usuario = al.id_usuario
      AND cs.tipo = 'ANALYTICS'
      AND cs.otorgado = true
      AND cs.creado_en = (
        SELECT MAX(cs2.creado_en)
        FROM consentimiento cs2
        WHERE cs2.id_usuario = al.id_usuario
          AND cs2.tipo = 'ANALYTICS'
      )
  )
GROUP BY tc.id_tema, tc.clave, tc.etiqueta, tc.grupo_tema;
