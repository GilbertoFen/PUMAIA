SELECT
  a.id_alumno,
  a.numero_cuenta,
  a.nombre,
  a.apellido_paterno,
  a.apellido_materno,
  a.correo,
  a.interes,
  a.semestre_actual,
  a.promedio,
  c.nombre AS carrera,
  ca.es_egresado,
  m.materia,
  cat.categoria AS categoria_materia,
  cal.calificacion,
  con.nombre AS concurso,
  cur.nombre AS curso,
  cat_cur.categoria AS categoria_curso,
  bec.nombre AS beca,
  ae.area_expertise AS area_experiencia,
  idi.nombre AS idioma,
  hab.nivel AS nivel_idioma
FROM
  (
    (
      (
        (
          (
            (
              (
                (
                  (
                    (
                      (
                        (
                          (
                            (
                              (
                                (
                                  (
                                    alumno a
                                    LEFT JOIN carrera_alumno ca ON ((ca.id_alumno = a.id_alumno))
                                  )
                                  LEFT JOIN carrera c ON ((c.id_carrera = ca.id_carrera))
                                )
                                LEFT JOIN calificacion cal ON ((cal.id_alumno = a.id_alumno))
                              )
                              LEFT JOIN materia m ON ((m.id_materia = cal.id_materia))
                            )
                            LEFT JOIN categoria cat ON ((cat.id_categoria = m.id_categoria))
                          )
                          LEFT JOIN concurso_alumno coa ON ((coa.id_alumno = a.id_alumno))
                        )
                        LEFT JOIN concurso con ON ((con.id_concurso = coa.id_concurso))
                      )
                      LEFT JOIN curso_alumno cua ON ((cua.id_alumno = a.id_alumno))
                    )
                    LEFT JOIN curso cur ON ((cur.id_curso = cua.id_curso))
                  )
                  LEFT JOIN categoria cat_cur ON ((cat_cur.id_categoria = cur.id_categoria))
                )
                LEFT JOIN beca_alumno ba ON ((ba.id_alumno = a.id_alumno))
              )
              LEFT JOIN beca bec ON ((bec.id_beca = ba.id_beca))
            )
            LEFT JOIN experiencia_profesional ep ON ((ep.id_alumno = a.id_alumno))
          )
          LEFT JOIN area_expertise ae ON ((ae.id_area_expertise = ep.id_area_expertise))
        )
        LEFT JOIN idioma_alumno ia ON ((ia.id_alumno = a.id_alumno))
      )
      LEFT JOIN idioma idi ON ((idi.id_idioma = ia.id_idioma))
    )
    LEFT JOIN habilidad hab ON ((hab.id_habilidad = ia.id_habilidad))
  );