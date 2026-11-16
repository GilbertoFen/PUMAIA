import {
  AttendanceStatus,
  EnrollmentStatus,
  SessionStatus,
} from '@prisma/client';
import { SectionContext } from './context';
import { lastWeeks, pct, visible, weekKey } from '../metrics.utils';

type Tally = Record<AttendanceStatus, number> & { students: Set<string> };
const newTally = (): Tally => ({
  PRESENT: 0,
  LATE: 0,
  ABSENT: 0,
  EXCUSED: 0,
  students: new Set(),
});

function rates(t: Tally, k: number) {
  const total = t.PRESENT + t.LATE + t.ABSENT + t.EXCUSED;
  const show = visible(t.students.size, k);
  return {
    students: show ? t.students.size : null,
    records: show ? total : null,
    presentRate: show ? pct(t.PRESENT, total) : null,
    lateRate: show ? pct(t.LATE, total) : null,
    absentRate: show ? pct(t.ABSENT, total) : null,
    excusedRate: show ? pct(t.EXCUSED, total) : null,
  };
}

/**
 * Asistencia indicativa (el QR no prueba presencia física).
 * - Serie semanal global (últimas `weeks` semanas), agregado por materia y por grupo.
 * - Sin datos de profesor; las materias se ordenan por nombre, no por desempeño.
 * - Solo sesiones CLOSED; las faltas de alumnos dados de baja del grupo no cuentan.
 */
export async function getAttendanceDashboard(
  ctx: SectionContext,
  filters: { weeks: number; periodId?: string },
) {
  const { prisma, k } = ctx;
  const sectionWhere = filters.periodId ? { periodId: filters.periodId } : {};
  const { keys } = lastWeeks(filters.weeks, ctx.now);

  const [records, withdrawn, openSessions] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: {
        session: { status: SessionStatus.CLOSED, section: sectionWhere },
      },
      select: {
        studentId: true,
        status: true,
        session: {
          select: {
            id: true,
            startsAt: true,
            sectionId: true,
            section: {
              select: {
                subjectId: true,
                groupCode: true,
                subject: { select: { subject: true } },
              },
            },
          },
        },
      },
    }),
    prisma.enrollment.findMany({
      where: {
        status: EnrollmentStatus.WITHDRAWN,
        sectionId: { not: null },
        section: sectionWhere,
      },
      select: { studentId: true, sectionId: true },
    }),
    prisma.classSession.count({
      where: { status: SessionStatus.OPEN, section: sectionWhere },
    }),
  ]);

  const withdrawnKeys = new Set(
    withdrawn.map((e) => `${e.sectionId}|${e.studentId}`),
  );
  const weekly = new Map<string, Tally>(keys.map((key) => [key, newTally()]));
  const bySubject = new Map<string, { name: string; tally: Tally }>();
  const bySection = new Map<
    string,
    { subject: string; groupCode: string; sessions: Set<string>; tally: Tally }
  >();

  for (const r of records) {
    if (
      r.status === AttendanceStatus.ABSENT &&
      withdrawnKeys.has(`${r.session.sectionId}|${r.studentId}`)
    ) {
      continue;
    }
    const w = weekly.get(weekKey(r.session.startsAt));
    if (w) {
      w[r.status]++;
      w.students.add(r.studentId);
    }
    const subjectId = r.session.section.subjectId;
    if (!bySubject.has(subjectId)) {
      bySubject.set(subjectId, {
        name: r.session.section.subject.subject,
        tally: newTally(),
      });
    }
    const s = bySubject.get(subjectId)!.tally;
    s[r.status]++;
    s.students.add(r.studentId);

    const sectionId = r.session.sectionId;
    if (!bySection.has(sectionId)) {
      bySection.set(sectionId, {
        subject: r.session.section.subject.subject,
        groupCode: r.session.section.groupCode,
        sessions: new Set(),
        tally: newTally(),
      });
    }
    const g = bySection.get(sectionId)!;
    g.sessions.add(r.session.id);
    g.tally[r.status]++;
    g.tally.students.add(r.studentId);
  }

  return ctx.metrics.envelope(
    { weeks: filters.weeks, periodId: filters.periodId },
    {
      byWeek: keys.map((week) => ({ week, ...rates(weekly.get(week)!, k) })),
      bySubject: [...bySubject.entries()]
        .sort(([, a], [, b]) => a.name.localeCompare(b.name))
        .map(([subjectId, s]) => ({
          subjectId,
          subject: s.name,
          ...rates(s.tally, k),
        })),
      // Por grupo: materia y clave de grupo, sin profesor. Orden alfabético (materia, grupo).
      bySection: [...bySection.entries()]
        .sort(
          ([, a], [, b]) =>
            a.subject.localeCompare(b.subject) ||
            a.groupCode.localeCompare(b.groupCode),
        )
        .map(([sectionId, g]) => ({
          sectionId,
          subject: g.subject,
          groupCode: g.groupCode,
          sessions: g.sessions.size,
          ...rates(g.tally, k),
        })),
      openSessionsExcluded: openSessions,
    },
    [
      'Asistencia indicativa: el registro por QR no prueba presencia física.',
      'Uso para sugerir medidas institucionales; no es evaluación de profesores ni de alumnos.',
      'Solo sesiones cerradas; las faltas de alumnos dados de baja no se cuentan.',
      'La serie semanal cubre las últimas semanas; el agregado por materia, todo el periodo filtrado.',
    ],
  );
}
