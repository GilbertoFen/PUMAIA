import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  EnrollmentStatus,
  AttendanceStatus,
  QuestionnaireKind,
  ConsentKind,
} from '@prisma/client';

@Injectable()
export class MetricsService {
  public static readonly K_ANONYMITY_THRESHOLD = 10;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Métricas de Rendimiento Académico Agregado.
   * Regla de privacidad:
   * 1. Conteo estricto de estudiantes únicos (DISTINCT studentId).
   * 2. k-anonymity con umbral mínimo de 10 estudiantes únicos.
   * 3. Supresión complementaria ante filtros combinados (periodId / careerId) para impedir ataques por diferencia.
   */
  async getAcademicPerformance(periodId?: string, careerId?: string) {
    const subjects = await this.prisma.subject.findMany({
      include: {
        category: true,
        enrollments: {
          include: {
            student: {
              select: { id: true, careerId: true },
            },
          },
        },
      },
    });

    return subjects.map((sub: any) => {
      const allEnrollments: any[] = sub.enrollments || [];

      const periodFiltered = periodId
        ? allEnrollments.filter((e) => !e.periodId || e.periodId === periodId)
        : allEnrollments;

      const filteredEnrollments = careerId
        ? periodFiltered.filter(
            (e) => !e.student || e.student.careerId === careerId,
          )
        : periodFiltered;

      const distinctFilteredStudents = new Set(
        filteredEnrollments.map((e: any, idx: number) => e.studentId || e.id || idx),
      );
      const totalStudents = distinctFilteredStudents.size;

      // Protección contra ataque por diferencia: si se filtra por carrera y el complemento tiene entre 1 y 9 alumnos,
      // se suprime también la cohorte filtrada para evitar aislar a los alumnos restantes por resta.
      let differencingRisk = false;
      if (careerId) {
        const distinctPeriodStudents = new Set(
          periodFiltered.map((e: any, idx: number) => e.studentId || e.id || idx),
        );
        const complementCount = distinctPeriodStudents.size - totalStudents;
        if (
          complementCount > 0 &&
          complementCount < MetricsService.K_ANONYMITY_THRESHOLD
        ) {
          differencingRisk = true;
        }
      }

      if (
        totalStudents < MetricsService.K_ANONYMITY_THRESHOLD ||
        differencingRisk
      ) {
        return {
          subjectId: sub.id,
          subjectName: sub.subject,
          category: sub.category?.category || null,
          totalStudents: '<10',
          averageGrade: 'RESTRINGIDO',
          passRate: 'RESTRINGIDO',
          failRate: 'RESTRINGIDO',
          kAnonymityProtected: true,
        };
      }

      const validGrades = filteredEnrollments.filter(
        (e) => e.grade !== null && e.grade !== undefined,
      );
      const sumGrades = validGrades.reduce(
        (acc, curr) => acc + Number(curr.grade || 0),
        0,
      );
      const avgGrade =
        validGrades.length > 0
          ? parseFloat((sumGrades / validGrades.length).toFixed(2))
          : null;

      const passedStudents = new Set(
        filteredEnrollments
          .filter((e) => e.status === EnrollmentStatus.PASSED)
          .map((e: any, idx: number) => e.studentId || e.id || `p-${idx}`),
      ).size;

      const failedStudents = new Set(
        filteredEnrollments
          .filter((e) => e.status === EnrollmentStatus.FAILED)
          .map((e: any, idx: number) => e.studentId || e.id || `f-${idx}`),
      ).size;

      const passRate = parseFloat(
        ((passedStudents / totalStudents) * 100).toFixed(2),
      );
      const failRate = parseFloat(
        ((failedStudents / totalStudents) * 100).toFixed(2),
      );

      return {
        subjectId: sub.id,
        subjectName: sub.subject,
        category: sub.category?.category || null,
        totalStudents: String(totalStudents),
        averageGrade: avgGrade !== null ? avgGrade.toFixed(2) : 'N/A',
        passRate: `${passRate}%`,
        failRate: `${failRate}%`,
        kAnonymityProtected: false,
      };
    });
  }

  /**
   * Métricas de Rezago y Riesgo Académico (bajas y no presentados).
   * Regla de privacidad:
   * 1. k-anonymity (mínimo 10 alumnos únicos por cohorte/semestre).
   * 2. Supresión complementaria cuando una única subcohorte de una carrera tiene entre 1 y 9 alumnos.
   */
  async getRetentionAndRiskMetrics(careerId?: string) {
    const students = await this.prisma.student.findMany({
      where: careerId ? { careerId } : undefined,
      include: {
        career: true,
        enrollments: true,
      },
    });

    const groups = new Map<
      string,
      {
        careerKey: string;
        careerName: string;
        semester: number;
        studentMap: Map<string, any>;
      }
    >();

    for (const st of students) {
      const careerKey = st.careerId || 'sin_carrera';
      const sem = st.currentSemester || 1;
      const key = `${careerKey}_${sem}`;
      if (!groups.has(key)) {
        groups.set(key, {
          careerKey,
          careerName: st.career?.name || 'No asignada',
          semester: sem,
          studentMap: new Map(),
        });
      }
      groups.get(key)!.studentMap.set(st.id, st);
    }

    const groupList = Array.from(groups.values());

    // Supresión complementaria por carrera: si exactamente 1 semestre en una carrera tiene < 10 alumnos
    // y hay otro semestre en la misma carrera, también se protege el segundo semestre más pequeño para impedir resta contra el total de carrera.
    const suppressedSemesters = new Set<string>();
    const byCareer = new Map<string, typeof groupList>();
    for (const g of groupList) {
      if (!byCareer.has(g.careerKey)) byCareer.set(g.careerKey, []);
      byCareer.get(g.careerKey)!.push(g);
    }

    for (const [, careerGroups] of byCareer.entries()) {
      const smallGroups = careerGroups.filter(
        (cg) =>
          cg.studentMap.size > 0 &&
          cg.studentMap.size < MetricsService.K_ANONYMITY_THRESHOLD,
      );
      if (smallGroups.length === 1 && careerGroups.length > 1) {
        const sorted = [...careerGroups].sort(
          (a, b) => a.studentMap.size - b.studentMap.size,
        );
        suppressedSemesters.add(`${sorted[0].careerKey}_${sorted[0].semester}`);
        suppressedSemesters.add(`${sorted[1].careerKey}_${sorted[1].semester}`);
      }
    }

    return groupList.map((g) => {
      const uniqueStudents = Array.from(g.studentMap.values());
      const count = uniqueStudents.length;
      const groupKey = `${g.careerKey}_${g.semester}`;

      if (
        count < MetricsService.K_ANONYMITY_THRESHOLD ||
        suppressedSemesters.has(groupKey)
      ) {
        return {
          career: g.careerName,
          semester: g.semester,
          totalStudents: '<10',
          notPresentedCount: 'RESTRINGIDO',
          withdrawnCount: 'RESTRINGIDO',
          riskRate: 'RESTRINGIDO',
          kAnonymityProtected: true,
        };
      }

      let notPresented = 0;
      let withdrawn = 0;
      let failed = 0;
      let totalEnrollments = 0;

      for (const st of uniqueStudents) {
        const enrollments = st.enrollments || [];
        totalEnrollments += enrollments.length;
        notPresented += enrollments.filter(
          (e: any) => e.status === EnrollmentStatus.NOT_PRESENTED,
        ).length;
        withdrawn += enrollments.filter(
          (e: any) => e.status === EnrollmentStatus.WITHDRAWN,
        ).length;
        failed += enrollments.filter(
          (e: any) => e.status === EnrollmentStatus.FAILED,
        ).length;
      }

      const riskEnrollments = notPresented + withdrawn + failed;
      const riskRate =
        totalEnrollments > 0
          ? parseFloat(((riskEnrollments / totalEnrollments) * 100).toFixed(2))
          : 0;

      return {
        career: g.careerName,
        semester: g.semester,
        totalStudents: String(count),
        notPresentedCount: notPresented,
        withdrawnCount: withdrawn,
        riskRate: `${riskRate}%`,
        kAnonymityProtected: false,
      };
    });
  }

  /**
   * Métricas de Asistencia Agregada por Grupo y Materia.
   * Reglas de privacidad:
   * 1. NUNCA genera rankings ni comparaciones de profesores.
   * 2. Umbral mínimo de 10 alumnos únicos por muestra.
   */
  async getAttendanceOverview(periodId?: string, subjectId?: string) {
    const sections = await this.prisma.courseSection.findMany({
      where: {
        ...(periodId && { periodId }),
        ...(subjectId && { subjectId }),
      },
      include: {
        subject: true,
        period: true,
        sessions: {
          include: {
            records: true,
          },
        },
      },
    });

    return sections.map((sec) => {
      const allRecords = sec.sessions.flatMap((s) => s.records);
      const uniqueStudents = new Set(allRecords.map((r) => r.studentId));
      const totalStudents = uniqueStudents.size;

      if (totalStudents < MetricsService.K_ANONYMITY_THRESHOLD) {
        return {
          sectionId: sec.id,
          groupCode: sec.groupCode,
          subject: sec.subject.subject,
          period: sec.period.code,
          attendeesCount: '<10',
          presentPercentage: 'RESTRINGIDO',
          absencePercentage: 'RESTRINGIDO',
          latePercentage: 'RESTRINGIDO',
          kAnonymityProtected: true,
        };
      }

      const totalEntries = allRecords.length;
      const presentCount = allRecords.filter(
        (r) => r.status === AttendanceStatus.PRESENT,
      ).length;
      const absentCount = allRecords.filter(
        (r) => r.status === AttendanceStatus.ABSENT,
      ).length;
      const lateCount = allRecords.filter(
        (r) => r.status === AttendanceStatus.LATE,
      ).length;

      const presentPct =
        totalEntries > 0
          ? parseFloat(((presentCount / totalEntries) * 100).toFixed(2))
          : 0;
      const absentPct =
        totalEntries > 0
          ? parseFloat(((absentCount / totalEntries) * 100).toFixed(2))
          : 0;
      const latePct =
        totalEntries > 0
          ? parseFloat(((lateCount / totalEntries) * 100).toFixed(2))
          : 0;

      return {
        sectionId: sec.id,
        groupCode: sec.groupCode,
        subject: sec.subject.subject,
        period: sec.period.code,
        attendeesCount: String(totalStudents),
        presentPercentage: `${presentPct}%`,
        absencePercentage: `${absentPct}%`,
        latePercentage: `${latePct}%`,
        kAnonymityProtected: false,
      };
    });
  }

  /**
   * Métricas de Tendencias Temáticas de Consultas de IA.
   * Reglas de privacidad:
   * 1. CERO contenido de mensajes o transcripciones de chat.
   * 2. CERO identificadores de alumnos.
   * 3. Excluye conversaciones sensibles (sensitive: false) y exige consentimiento vigente ANALYTICS.
   * 4. Conteo por estudiantes únicos (DISTINCT studentId) y enmascaramiento estricto cuando < 10 estudiantes únicos.
   */
  async getChatTopicDistribution() {
    const topics = await this.prisma.topicCategory.findMany({
      include: {
        labels: {
          where: {
            conversation: {
              sensitive: false,
            },
          },
          include: {
            conversation: {
              select: {
                id: true,
                studentId: true,
                sensitive: true,
                student: {
                  select: {
                    id: true,
                    userId: true,
                    user: {
                      select: {
                        consents: {
                          where: { kind: ConsentKind.ANALYTICS },
                          orderBy: { createdAt: 'desc' },
                          take: 1,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    return topics
      .map((t: any) => {
        const safeLabels = (t.labels || []).filter((l: any) => {
          if (l.conversation?.sensitive === true) return false;
          const analyticsConsents =
            l.conversation?.student?.user?.consents;
          if (Array.isArray(analyticsConsents)) {
            if (
              analyticsConsents.length === 0 ||
              !analyticsConsents[0]?.granted
            ) {
              return false;
            }
          }
          return true;
        });

        const uniqueStudentIds = new Set(
          safeLabels.map(
            (l: any, idx: number) =>
              l.conversation?.studentId || l.studentId || l.id || `s-${idx}`,
          ),
        );
        const uniqueStudentsCount = uniqueStudentIds.size;

        if (uniqueStudentsCount < MetricsService.K_ANONYMITY_THRESHOLD) {
          return {
            topicCode: t.code,
            label: t.label,
            topicGroup: t.topicGroup,
            totalStudents: '<10',
            totalQueries: 'RESTRINGIDO' as const,
            averageConfidence: 'RESTRINGIDO' as const,
            kAnonymityProtected: true,
          };
        }

        const totalQueries = safeLabels.length;
        const validConfidences = safeLabels
          .map((l: any) =>
            l.confidence !== null && l.confidence !== undefined
              ? Number(l.confidence)
              : null,
          )
          .filter((c: number | null): c is number => c !== null);

        const avgConfidence =
          validConfidences.length > 0
            ? parseFloat(
                (
                  validConfidences.reduce((a: number, b: number) => a + b, 0) /
                  validConfidences.length
                ).toFixed(2),
              )
            : null;

        return {
          topicCode: t.code,
          label: t.label,
          topicGroup: t.topicGroup,
          totalStudents: String(uniqueStudentsCount),
          totalQueries,
          averageConfidence: avgConfidence,
          kAnonymityProtected: false,
        };
      })
      .sort((a, b) => {
        const qa = typeof a.totalQueries === 'number' ? a.totalQueries : -1;
        const qb = typeof b.totalQueries === 'number' ? b.totalQueries : -1;
        return qb - qa;
      });
  }

  /**
   * Métricas de Clima y Satisfacción Estudiantil a partir de Cuestionarios.
   * Regla de privacidad:
   * 1. Cuenta estudiantes únicos (response.studentId), nunca respuestas crudas.
   * 2. Si hay menos de 10 estudiantes únicos, enmascara sampleCount, averageScale y optionDistribution.
   * 3. En optionDistribution, suprime opciones con muestras menores a 10 estudiantes únicos (y aplica supresión complementaria).
   */
  async getSatisfactionSurveyMetrics(
    kind: QuestionnaireKind = QuestionnaireKind.ONBOARDING,
  ) {
    const questions = await this.prisma.question.findMany({
      where: {
        questionnaire: { kind, active: true },
      },
      include: {
        options: true,
        answers: {
          select: {
            id: true,
            responseId: true,
            optionId: true,
            numberValue: true,
            response: {
              select: {
                studentId: true,
              },
            },
          },
        },
      },
      orderBy: { position: 'asc' },
    });

    return questions.map((q: any) => {
      const answers: any[] = q.answers || [];
      const uniqueRespondents = new Set(
        answers.map(
          (a: any, idx: number) =>
            a.response?.studentId ||
            a.studentId ||
            a.responseId ||
            a.id ||
            `resp-${idx}`,
        ),
      );
      const uniqueCount = uniqueRespondents.size;

      if (uniqueCount < MetricsService.K_ANONYMITY_THRESHOLD) {
        return {
          questionCode: q.code,
          text: q.text,
          category: q.category,
          sampleCount: '<10',
          averageScale: 'RESTRINGIDO',
          optionDistribution: 'RESTRINGIDO',
          kAnonymityProtected: true,
        };
      }

      // Promedio calculado una vez por estudiante único para evitar sesgo por múltiples respuestas
      const numericByStudent = new Map<string, number>();
      answers.forEach((a: any, idx: number) => {
        if (a.numberValue !== null && a.numberValue !== undefined) {
          const stKey =
            a.response?.studentId ||
            a.studentId ||
            a.responseId ||
            a.id ||
            `resp-${idx}`;
          numericByStudent.set(stKey, Number(a.numberValue));
        }
      });

      const numericValues = Array.from(numericByStudent.values());
      const avgScore =
        numericValues.length > 0
          ? parseFloat(
              (
                numericValues.reduce((a, b) => a + b, 0) / numericValues.length
              ).toFixed(2),
            )
          : null;

      // Distribución por opción contando estudiantes únicos y suprimiendo celdas < 10
      const rawOptionCounts = (q.options || []).map((opt: any) => {
        const optStudents = new Set(
          answers
            .filter((a: any) => a.optionId === opt.id)
            .map(
              (a: any, idx: number) =>
                a.response?.studentId ||
                a.studentId ||
                a.responseId ||
                a.id ||
                `opt-${idx}`,
            ),
        );
        return {
          optionLabel: opt.label,
          rawCount: optStudents.size,
        };
      });

      const smallNonZeroCells = rawOptionCounts.filter(
        (c: any) =>
          c.rawCount > 0 && c.rawCount < MetricsService.K_ANONYMITY_THRESHOLD,
      );

      // Si sólo 1 opción tiene entre 1 y 9 alumnos, también suprimimos la siguiente más pequeña para impedir deducción por resta
      const suppressedLabels = new Set<string>(
        smallNonZeroCells.map((c: any) => c.optionLabel),
      );
      if (smallNonZeroCells.length === 1 && rawOptionCounts.length > 1) {
        const sortedNonZero = rawOptionCounts
          .filter((c: any) => c.rawCount > 0)
          .sort((a: any, b: any) => a.rawCount - b.rawCount);
        if (sortedNonZero.length > 1) {
          suppressedLabels.add(sortedNonZero[1].optionLabel);
        }
      }

      const optionDistribution = rawOptionCounts.map((c: any) => ({
        optionLabel: c.optionLabel,
        count: suppressedLabels.has(c.optionLabel)
          ? ('<10' as const)
          : c.rawCount,
        kAnonymityProtected: suppressedLabels.has(c.optionLabel),
      }));

      return {
        questionCode: q.code,
        text: q.text,
        category: q.category,
        sampleCount: String(uniqueCount),
        averageScale: avgScore !== null ? avgScore.toFixed(2) : 'N/A',
        optionDistribution,
        kAnonymityProtected: false,
      };
    });
  }
}
