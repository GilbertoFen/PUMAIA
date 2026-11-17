import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  AttendanceStatus,
  ConsentKind,
  EnrollmentStatus,
  QuestionnaireKind,
  QuestionType,
  SessionStatus,
} from '@prisma/client';
import {
  getConsentStates,
  mean,
  pct,
  suppressSmallCells,
  usersWithState,
} from './metrics.utils';

/**
 * Métricas institucionales agregadas (solo INSTITUTION_ADMIN / ANALYST).
 *
 * Reglas comunes a todos los endpoints:
 * - Solo agregados. Nunca se devuelven nombres, correos, números de cuenta ni texto libre.
 * - Umbral mínimo de alumnos únicos por celda = METRICS_MIN_GROUP (por defecto 1).
 *   Una celda por debajo del umbral se devuelve con `suppressed: true` y valores en null.
 * - Las tasas son números de 0 a 100 con 2 decimales (o null si no aplican / están suprimidas).
 *
 * Nota de rendimiento: todo se agrega en memoria. Es suficiente para el piloto (30–50 alumnos);
 * al escalar conviene mover estas agregaciones a SQL (GROUP BY / vistas).
 */

/** Piloto (30–50 alumnos): por defecto se muestra todo. Se sube con METRICS_MIN_GROUP. */
export const DEFAULT_MIN_GROUP = 1;

export type SuppressionReason = 'MIN_GROUP' | 'DIFFERENCING' | null;

export interface MetricsEnvelope<T> {
  minGroupSize: number;
  generatedAt: string;
  filters: Record<string, string | null>;
  notes: string[];
  /** Lista de filas, o un objeto con varias series cuando la sección tiene más de una gráfica. */
  items: T;
}

const COMPLETED_STATUSES: EnrollmentStatus[] = [
  EnrollmentStatus.PASSED,
  EnrollmentStatus.FAILED,
  EnrollmentStatus.NOT_PRESENTED,
];

const RISK_STATUSES: EnrollmentStatus[] = [
  EnrollmentStatus.FAILED,
  EnrollmentStatus.NOT_PRESENTED,
  EnrollmentStatus.WITHDRAWN,
];

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  readonly minGroup: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.minGroup = MetricsService.parseMinGroup(
      config.get<string>('METRICS_MIN_GROUP'),
    );
    this.logger.log(`Umbral de métricas METRICS_MIN_GROUP=${this.minGroup}`);
  }

  /** Lee el umbral. Vacío → 1 (piloto). Valor inválido → error al arrancar (falla rápido). */
  static parseMinGroup(raw: string | number | undefined | null): number {
    if (raw === undefined || raw === null || String(raw).trim() === '') {
      return DEFAULT_MIN_GROUP;
    }
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1) {
      throw new Error(
        `METRICS_MIN_GROUP debe ser un entero >= 1 (recibido: "${raw}")`,
      );
    }
    return n;
  }

  /** Sobre común de todas las respuestas del dashboard. */
  envelope<T>(
    filters: Record<string, string | number | undefined | null>,
    items: T,
    notes: string[] = [],
  ): MetricsEnvelope<T> {
    const cleanFilters: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(filters)) {
      cleanFilters[key] =
        value === undefined || value === null ? null : String(value);
    }
    return {
      minGroupSize: this.minGroup,
      generatedAt: new Date().toISOString(),
      filters: cleanFilters,
      notes,
      items,
    };
  }

  private suppressSmallCells<K>(cells: Map<K, number>): Set<K> {
    return suppressSmallCells(cells, this.minGroup);
  }

  // ---------------------------------------------------------------------------
  // 1. Rendimiento académico por materia
  // ---------------------------------------------------------------------------

  /**
   * - Con periodId: solo inscripciones de ese periodo (ya no se cuelan las que no tienen periodo).
   * - Sin periodId: se toma el intento más reciente de cada alumno en la materia.
   * - Tasas de aprobación/reprobación/NP sobre alumnos que ya terminaron (no sobre IN_PROGRESS),
   *   y solo si los que terminaron también alcanzan el umbral.
   * - Con careerId: si el resto de la materia (otras carreras) queda entre 1 y k-1, se suprime
   *   la fila para evitar ataques por diferencia.
   */
  async getAcademicPerformance(
    filters: { periodId?: string; careerId?: string } = {},
  ) {
    const { periodId, careerId } = filters;
    const k = this.minGroup;
    const enrollmentWhere = periodId ? { periodId } : {};

    const subjects = await this.prisma.subject.findMany({
      where: { enrollments: { some: enrollmentWhere } },
      select: {
        id: true,
        subject: true,
        semester: true,
        credits: true,
        category: { select: { category: true } },
        enrollments: {
          where: enrollmentWhere,
          select: {
            studentId: true,
            grade: true,
            status: true,
            attempt: true,
            createdAt: true,
            student: { select: { careerId: true } },
          },
        },
      },
      orderBy: [{ semester: 'asc' }, { subject: 'asc' }],
    });

    const items = subjects.map((sub) => {
      // Un registro por alumno: el intento más reciente.
      const latestByStudent = new Map<string, (typeof sub.enrollments)[0]>();
      for (const e of sub.enrollments) {
        const prev = latestByStudent.get(e.studentId);
        if (
          !prev ||
          e.attempt > prev.attempt ||
          (e.attempt === prev.attempt && e.createdAt > prev.createdAt)
        ) {
          latestByStudent.set(e.studentId, e);
        }
      }
      const all = [...latestByStudent.values()];
      const cohort = careerId
        ? all.filter((e) => e.student?.careerId === careerId)
        : all;

      const total = cohort.length;
      const complement = all.length - total;
      let reason: SuppressionReason = null;
      if (total < k) reason = 'MIN_GROUP';
      else if (careerId && complement > 0 && complement < k)
        reason = 'DIFFERENCING';

      const base = {
        subjectId: sub.id,
        subjectName: sub.subject,
        category: sub.category?.category ?? null,
        semester: sub.semester ?? null,
        credits: sub.credits ?? null,
      };

      if (reason) {
        return {
          ...base,
          totalStudents: null,
          completedStudents: null,
          inProgressStudents: null,
          averageGrade: null,
          passRate: null,
          failRate: null,
          notPresentedRate: null,
          withdrawnRate: null,
          suppressed: true,
          suppressionReason: reason,
        };
      }

      const completed = cohort.filter((e) =>
        COMPLETED_STATUSES.includes(e.status),
      );
      const count = (status: EnrollmentStatus) =>
        cohort.filter((e) => e.status === status).length;
      const grades = cohort
        .map((e) => e.grade)
        .filter((g): g is number => g !== null && g !== undefined);
      const enoughCompleted = completed.length >= k;

      return {
        ...base,
        totalStudents: total,
        completedStudents: completed.length,
        inProgressStudents: count(EnrollmentStatus.IN_PROGRESS),
        averageGrade: grades.length >= k ? mean(grades) : null,
        passRate: enoughCompleted
          ? pct(count(EnrollmentStatus.PASSED), completed.length)
          : null,
        failRate: enoughCompleted
          ? pct(count(EnrollmentStatus.FAILED), completed.length)
          : null,
        notPresentedRate: enoughCompleted
          ? pct(count(EnrollmentStatus.NOT_PRESENTED), completed.length)
          : null,
        withdrawnRate: pct(count(EnrollmentStatus.WITHDRAWN), total),
        suppressed: false,
        suppressionReason: null as SuppressionReason,
      };
    });

    return this.envelope({ periodId, careerId }, items, [
      'Tasas de aprobación, reprobación y NP calculadas sobre alumnos que ya terminaron la materia.',
      'Sin periodo: se usa el intento más reciente de cada alumno.',
    ]);
  }

  // ---------------------------------------------------------------------------
  // 2. Rezago y riesgo por carrera y semestre actual
  // ---------------------------------------------------------------------------

  /**
   * Agrupa alumnos no egresados por carrera y `Student.currentSemester`.
   * Riesgo = inscripciones FAILED + NOT_PRESENTED + WITHDRAWN.
   */
  async getRetentionAndRiskMetrics(
    filters: { periodId?: string; careerId?: string } = {},
  ) {
    const { periodId, careerId } = filters;
    const k = this.minGroup;

    const students = await this.prisma.student.findMany({
      where: { isGraduated: false, ...(careerId ? { careerId } : {}) },
      select: {
        id: true,
        careerId: true,
        currentSemester: true,
        career: { select: { name: true } },
        enrollments: {
          where: periodId ? { periodId } : undefined,
          select: { status: true },
        },
      },
    });

    type Group = {
      key: string;
      careerId: string;
      careerName: string;
      semester: number | null;
      students: typeof students;
    };
    const groups = new Map<string, Group>();
    for (const st of students) {
      const semester =
        Number.isInteger(st.currentSemester) && st.currentSemester > 0
          ? st.currentSemester
          : null;
      const key = `${st.careerId}|${semester ?? 'sin_semestre'}`;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          careerId: st.careerId,
          careerName: st.career?.name ?? 'No asignada',
          semester,
          students: [],
        });
      }
      groups.get(key)!.students.push(st);
    }

    // Supresión (incluida la complementaria) dentro de cada carrera.
    const suppressed = new Set<string>();
    const byCareer = new Map<string, Map<string, number>>();
    for (const g of groups.values()) {
      if (!byCareer.has(g.careerId)) byCareer.set(g.careerId, new Map());
      byCareer.get(g.careerId)!.set(g.key, g.students.length);
    }
    for (const cells of byCareer.values()) {
      for (const key of this.suppressSmallCells(cells)) suppressed.add(key);
    }

    const items = [...groups.values()]
      .sort(
        (a, b) =>
          a.careerName.localeCompare(b.careerName) ||
          (a.semester ?? 99) - (b.semester ?? 99),
      )
      .map((g) => {
        const base = {
          careerId: g.careerId,
          career: g.careerName,
          semester: g.semester,
        };
        if (g.students.length < k || suppressed.has(g.key)) {
          return {
            ...base,
            totalStudents: null,
            totalEnrollments: null,
            failedRate: null,
            notPresentedRate: null,
            withdrawnRate: null,
            riskRate: null,
            studentsWithRiskRate: null,
            suppressed: true,
            suppressionReason: (g.students.length < k
              ? 'MIN_GROUP'
              : 'DIFFERENCING') as SuppressionReason,
          };
        }

        let totalEnrollments = 0;
        let failed = 0;
        let notPresented = 0;
        let withdrawn = 0;
        let studentsWithRisk = 0;
        for (const st of g.students) {
          totalEnrollments += st.enrollments.length;
          let risky = false;
          for (const e of st.enrollments) {
            if (e.status === EnrollmentStatus.FAILED) failed++;
            if (e.status === EnrollmentStatus.NOT_PRESENTED) notPresented++;
            if (e.status === EnrollmentStatus.WITHDRAWN) withdrawn++;
            if (RISK_STATUSES.includes(e.status)) risky = true;
          }
          if (risky) studentsWithRisk++;
        }

        return {
          ...base,
          totalStudents: g.students.length,
          totalEnrollments,
          failedRate: pct(failed, totalEnrollments),
          notPresentedRate: pct(notPresented, totalEnrollments),
          withdrawnRate: pct(withdrawn, totalEnrollments),
          riskRate: pct(failed + notPresented + withdrawn, totalEnrollments),
          studentsWithRiskRate: pct(studentsWithRisk, g.students.length),
          suppressed: false,
          suppressionReason: null as SuppressionReason,
        };
      });

    return this.envelope({ periodId, careerId }, items, [
      'Semestre tomado de Student.currentSemester; alumnos egresados excluidos.',
      'Las tasas por estado se calculan sobre inscripciones; studentsWithRiskRate sobre alumnos.',
    ]);
  }

  // ---------------------------------------------------------------------------
  // 3. Asistencia por grupo
  // ---------------------------------------------------------------------------

  /**
   * Asistencia indicativa por grupo (el QR no prueba presencia física).
   * - Nunca incluye al profesor ni ordena/compara grupos por desempeño: orden por materia y clave.
   * - Solo sesiones CLOSED (en las abiertas aún no se generan las faltas y se inflaría la asistencia).
   * - Las faltas de alumnos con baja (WITHDRAWN) en el grupo no cuentan.
   * - Incluye EXCUSED: present + late + absent + excused = 100 %.
   */
  async getAttendanceOverview(
    filters: { periodId?: string; subjectId?: string } = {},
  ) {
    const { periodId, subjectId } = filters;
    const k = this.minGroup;

    const sections = await this.prisma.courseSection.findMany({
      where: {
        ...(periodId ? { periodId } : {}),
        ...(subjectId ? { subjectId } : {}),
      },
      select: {
        id: true,
        groupCode: true,
        subject: { select: { id: true, subject: true } },
        period: { select: { id: true, code: true } },
        sessions: {
          where: { status: SessionStatus.CLOSED },
          select: {
            id: true,
            records: { select: { studentId: true, status: true } },
          },
        },
        enrollments: {
          where: { status: EnrollmentStatus.WITHDRAWN },
          select: { studentId: true },
        },
        _count: {
          select: { sessions: { where: { status: SessionStatus.OPEN } } },
        },
      },
      orderBy: [{ subject: { subject: 'asc' } }, { groupCode: 'asc' }],
    });

    const items = sections.map((sec) => {
      const withdrawn = new Set(sec.enrollments.map((e) => e.studentId));
      const records = sec.sessions
        .flatMap((s) => s.records)
        .filter(
          (r) =>
            !(
              withdrawn.has(r.studentId) && r.status === AttendanceStatus.ABSENT
            ),
        );
      const totalStudents = new Set(records.map((r) => r.studentId)).size;

      const base = {
        sectionId: sec.id,
        groupCode: sec.groupCode,
        subjectId: sec.subject.id,
        subject: sec.subject.subject,
        periodId: sec.period.id,
        period: sec.period.code,
        closedSessions: sec.sessions.length,
        openSessionsExcluded: sec._count?.sessions ?? 0,
      };

      if (totalStudents < k) {
        return {
          ...base,
          totalStudents: null,
          totalRecords: null,
          presentRate: null,
          lateRate: null,
          absentRate: null,
          excusedRate: null,
          suppressed: true,
          suppressionReason: 'MIN_GROUP' as SuppressionReason,
        };
      }

      const total = records.length;
      const count = (status: AttendanceStatus) =>
        records.filter((r) => r.status === status).length;

      return {
        ...base,
        totalStudents,
        totalRecords: total,
        presentRate: pct(count(AttendanceStatus.PRESENT), total),
        lateRate: pct(count(AttendanceStatus.LATE), total),
        absentRate: pct(count(AttendanceStatus.ABSENT), total),
        excusedRate: pct(count(AttendanceStatus.EXCUSED), total),
        suppressed: false,
        suppressionReason: null as SuppressionReason,
      };
    });

    return this.envelope({ periodId, subjectId }, items, [
      'Asistencia indicativa: el registro por QR no prueba presencia física.',
      'Uso para sugerir medidas institucionales; no es evaluación de profesores ni de alumnos.',
      'Solo sesiones cerradas; las faltas de alumnos dados de baja no se cuentan.',
    ]);
  }

  // ---------------------------------------------------------------------------
  // 4. Temas del chat
  // ---------------------------------------------------------------------------

  /**
   * IDs de usuario cuyo consentimiento ANALYTICS más reciente es `granted` y corresponde
   * a la versión vigente del aviso (misma regla que ConsentsService.hasValidConsent).
   * Si no hay aviso publicado, nadie es elegible. No escribe en la base.
   */
  async getAnalyticsEligibleUserIds(): Promise<{
    userIds: string[];
    noticeVersion: string | null;
  }> {
    const { noticeVersion, states } = await getConsentStates(
      this.prisma,
      ConsentKind.ANALYTICS,
    );
    return { userIds: usersWithState(states, 'CURRENT'), noticeVersion };
  }

  /**
   * Distribución de temas del chat. Sin contenido de mensajes ni identificadores.
   * Solo conversaciones no sensibles de alumnos con consentimiento ANALYTICS vigente.
   * Se cuentan conversaciones distintas (una conversación etiquetada por varias fuentes cuenta una vez).
   */
  async getChatTopicDistribution() {
    const k = this.minGroup;
    const { userIds, noticeVersion } = await this.getAnalyticsEligibleUserIds();

    const topics = await this.prisma.topicCategory.findMany({
      select: {
        code: true,
        label: true,
        topicGroup: true,
        active: true,
        labels: {
          where: {
            conversation: {
              sensitive: false,
              student: { userId: { in: userIds } },
            },
          },
          select: {
            conversationId: true,
            confidence: true,
            conversation: { select: { studentId: true } },
          },
        },
      },
    });

    const items = topics
      .map((t) => {
        const students = new Set(t.labels.map((l) => l.conversation.studentId));
        const conversations = new Set(t.labels.map((l) => l.conversationId));
        const base = {
          topicCode: t.code,
          label: t.label,
          topicGroup: t.topicGroup,
          active: t.active,
        };

        if (students.size > 0 && students.size < k) {
          return {
            ...base,
            totalStudents: null,
            totalConversations: null,
            averageConfidence: null,
            suppressed: true,
            suppressionReason: 'MIN_GROUP' as SuppressionReason,
          };
        }

        const confidences = t.labels
          .map((l) => (l.confidence === null ? null : Number(l.confidence)))
          .filter((c): c is number => c !== null && Number.isFinite(c));

        return {
          ...base,
          totalStudents: students.size,
          totalConversations: conversations.size,
          averageConfidence: mean(confidences),
          suppressed: false,
          suppressionReason: null as SuppressionReason,
        };
      })
      .sort(
        (a, b) =>
          Number(a.suppressed) - Number(b.suppressed) ||
          (b.totalConversations ?? 0) - (a.totalConversations ?? 0) ||
          a.label.localeCompare(b.label),
      );

    const notes = [
      'Solo conversaciones no sensibles de alumnos con consentimiento ANALYTICS de la versión vigente del aviso.',
    ];
    if (!noticeVersion) {
      notes.push(
        'No hay aviso ANALYTICS publicado: ningún alumno es elegible.',
      );
    }

    return {
      ...this.envelope({}, items, notes),
      analyticsNoticeVersion: noticeVersion,
    };
  }

  // ---------------------------------------------------------------------------
  // 5. Cuestionarios
  // ---------------------------------------------------------------------------

  /**
   * Resultados por pregunta del cuestionario activo de un tipo.
   * - Se cuenta una vez a cada alumno: solo su envío más reciente.
   * - averageScale solo para preguntas SCALE y solo con valores que existen como opción
   *   (descarta números fuera de escala que sesgaban el promedio).
   * - Nunca se devuelven respuestas de texto libre.
   */
  async getSatisfactionSurveyMetrics(
    filters: { kind?: QuestionnaireKind } = {},
  ) {
    const kind = filters.kind ?? QuestionnaireKind.ONBOARDING;
    const k = this.minGroup;

    const questions = await this.prisma.question.findMany({
      where: { questionnaire: { kind, active: true } },
      select: {
        id: true,
        code: true,
        text: true,
        type: true,
        category: true,
        position: true,
        questionnaire: { select: { version: true } },
        options: {
          select: { id: true, value: true, label: true, position: true },
          orderBy: { position: 'asc' },
        },
        answers: {
          select: {
            optionId: true,
            numberValue: true,
            responseId: true,
            response: { select: { studentId: true, createdAt: true } },
          },
        },
      },
      orderBy: [{ questionnaire: { version: 'desc' } }, { position: 'asc' }],
    });

    const items = questions.map((q) => {
      // Envío más reciente de cada alumno para esta pregunta.
      const latestResponse = new Map<string, { id: string; at: Date }>();
      for (const a of q.answers) {
        const prev = latestResponse.get(a.response.studentId);
        if (!prev || a.response.createdAt > prev.at) {
          latestResponse.set(a.response.studentId, {
            id: a.responseId,
            at: a.response.createdAt,
          });
        }
      }
      const answersByStudent = new Map<string, typeof q.answers>();
      for (const a of q.answers) {
        const studentId = a.response.studentId;
        if (latestResponse.get(studentId)?.id !== a.responseId) continue;
        if (!answersByStudent.has(studentId))
          answersByStudent.set(studentId, []);
        answersByStudent.get(studentId)!.push(a);
      }
      const respondents = answersByStudent.size;

      const base = {
        questionCode: q.code,
        text: q.text,
        type: q.type,
        category: q.category ?? null,
        questionnaireVersion: q.questionnaire.version,
      };

      if (respondents < k) {
        return {
          ...base,
          respondents: null,
          averageScale: null,
          optionDistribution: null,
          suppressed: true,
          suppressionReason: 'MIN_GROUP' as SuppressionReason,
        };
      }

      // Valor numérico de cada opción (para SCALE).
      const optionNumber = new Map<string, number>();
      for (const opt of q.options) {
        const n = Number(opt.value);
        if (Number.isInteger(n)) optionNumber.set(opt.id, n);
      }
      const validScale = new Set(optionNumber.values());
      const optionIdByNumber = new Map(
        [...optionNumber.entries()].map(([id, n]) => [n, id]),
      );

      // Opción(es) elegidas por alumno.
      const chosenByStudent = new Map<string, Set<string>>();
      const scaleValues: number[] = [];
      for (const [studentId, answers] of answersByStudent) {
        const chosen = new Set<string>();
        for (const a of answers) {
          if (a.optionId) chosen.add(a.optionId);
          else if (
            q.type === QuestionType.SCALE &&
            a.numberValue !== null &&
            optionIdByNumber.has(a.numberValue)
          ) {
            chosen.add(optionIdByNumber.get(a.numberValue)!);
          }
        }
        chosenByStudent.set(studentId, chosen);

        if (q.type === QuestionType.SCALE) {
          const first = answers[0];
          const value = first.optionId
            ? optionNumber.get(first.optionId)
            : (first.numberValue ?? undefined);
          if (value !== undefined && validScale.has(value))
            scaleValues.push(value);
        }
      }

      let optionDistribution:
        | {
            optionLabel: string;
            value: string;
            count: number | null;
            suppressed: boolean;
          }[]
        | null = null;
      if (q.type !== QuestionType.TEXT && q.options.length > 0) {
        const cells = new Map<string, number>();
        for (const opt of q.options) {
          let n = 0;
          for (const chosen of chosenByStudent.values())
            if (chosen.has(opt.id)) n++;
          cells.set(opt.id, n);
        }
        const hidden = this.suppressSmallCells(cells);
        optionDistribution = q.options.map((opt) => ({
          optionLabel: opt.label,
          value: opt.value,
          count: hidden.has(opt.id) ? null : cells.get(opt.id)!,
          suppressed: hidden.has(opt.id),
        }));
      }

      return {
        ...base,
        respondents,
        averageScale:
          q.type === QuestionType.SCALE && scaleValues.length >= k
            ? mean(scaleValues)
            : null,
        optionDistribution,
        suppressed: false,
        suppressionReason: null as SuppressionReason,
      };
    });

    return this.envelope({ kind }, items, [
      'Se cuenta solo el envío más reciente de cada alumno.',
      'averageScale ignora valores que no corresponden a una opción de la escala.',
    ]);
  }
}
