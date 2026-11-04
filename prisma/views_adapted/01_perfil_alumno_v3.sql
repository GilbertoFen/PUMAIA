-- =====================================================================
-- VISTA ADAPTADA 1: perfil_alumno (Esquema Prisma v3)
-- Fuente original: prisma/views/public/perfil_alumno.sql
-- Correcciones aplicadas:
-- 1. m.materia (en lugar de m.nombre inexistente en tabla materia).
-- 2. ae.area_expertise (en lugar de ae.nombre inexistente en tabla area_expertise).
-- 3. Eliminación del producto cartesiano entre las 6 relaciones 1:N mediante
--    subconsultas agregadas correlacionadas por alumno (1 fila por alumno).
-- =====================================================================

CREATE OR REPLACE VIEW vista_perfil_alumno_v3 AS
SELECT
  a.id_alumno,
  a.numero_cuenta,
  u.nombre,
  u.apellido_paterno,
  u.apellido_materno,
  u.correo,
  a.interes,
  a.semestre_actual,
  a.promedio,
  c.nombre AS carrera,
  a.es_egresado,
  (
    SELECT STRING_AGG(DISTINCT m.materia, ', ' ORDER BY m.materia)
    FROM inscripcion i
    JOIN materia m ON m.id_materia = i.id_materia
    WHERE i.id_alumno = a.id_alumno
  ) AS materia,
  (
    SELECT cat_mat.categoria
    FROM inscripcion i
    JOIN materia m ON m.id_materia = i.id_materia
    JOIN categoria cat_mat ON cat_mat.id_categoria = m.id_categoria
    WHERE i.id_alumno = a.id_alumno
    ORDER BY i.creado_en DESC
    LIMIT 1
  ) AS categoria_materia,
  (
    SELECT ROUND(AVG(i.calificacion))::INT
    FROM inscripcion i
    WHERE i.id_alumno = a.id_alumno
      AND i.calificacion IS NOT NULL
  ) AS calificacion,
  (
    SELECT STRING_AGG(DISTINCT con.nombre, ', ' ORDER BY con.nombre)
    FROM concurso_alumno coa
    JOIN concurso con ON con.id_concurso = coa.id_concurso
    WHERE coa.id_alumno = a.id_alumno
  ) AS concurso,
  (
    SELECT STRING_AGG(DISTINCT cur.nombre, ', ' ORDER BY cur.nombre)
    FROM curso_alumno cua
    JOIN curso cur ON cur.id_curso = cua.id_curso
    WHERE cua.id_alumno = a.id_alumno
  ) AS curso,
  (
    SELECT cat_cur.categoria
    FROM curso_alumno cua
    JOIN curso cur ON cur.id_curso = cua.id_curso
    JOIN categoria cat_cur ON cat_cur.id_categoria = cur.id_categoria
    WHERE cua.id_alumno = a.id_alumno
    LIMIT 1
  ) AS categoria_curso,
  (
    SELECT STRING_AGG(DISTINCT bec.nombre, ', ' ORDER BY bec.nombre)
    FROM beca_alumno beca_rel
    JOIN beca bec ON bec.id_beca = beca_rel.id_beca
    WHERE beca_rel.id_alumno = a.id_alumno
  ) AS beca,
  (
    SELECT STRING_AGG(DISTINCT ae.area_expertise, ', ' ORDER BY ae.area_expertise)
    FROM experiencia_profesional exp
    JOIN area_expertise ae ON ae.id_area_expertise = exp.id_area_expertise
    WHERE exp.id_alumno = a.id_alumno
  ) AS area_experiencia,
  (
    SELECT STRING_AGG(DISTINCT idi.nombre, ', ' ORDER BY idi.nombre)
    FROM idioma_alumno idi_rel
    JOIN idioma idi ON idi.id_idioma = idi_rel.id_idioma
    WHERE idi_rel.id_alumno = a.id_alumno
  ) AS idioma,
  (
    SELECT STRING_AGG(DISTINCT hab.nivel, ', ' ORDER BY hab.nivel)
    FROM idioma_alumno idi_rel
    JOIN habilidad hab ON hab.id_habilidad = idi_rel.id_habilidad
    WHERE idi_rel.id_alumno = a.id_alumno
  ) AS nivel_idioma
FROM alumno a
JOIN usuario u ON u.id_usuario = a.id_usuario
LEFT JOIN carrera c ON c.id_carrera = a.id_carrera;
