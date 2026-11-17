import {
  ConsentKind,
  EnrollmentSource,
  RolMensaje,
  RosterStatus,
} from '@prisma/client';
import { SectionContext } from './context';
import {
  getConsentStates,
  lastWeeks,
  loadRegisteredStudents,
  pct,
  visible,
  weekKey,
} from '../metrics.utils';

/**
 * Adopción: embudo y alumnos activos por semana. Cifras de uso: cuentan a todos los registrados.
 * Cada paso del embudo se cuenta por separado (no exige el paso anterior).
 * Activo en una semana = inició sesión o envió al menos un mensaje al chat.
 */
export async function getAdoption(
  ctx: SectionContext,
  filters: { weeks: number },
) {
  const { prisma, k } = ctx;
  const students = await loadRegisteredStudents(prisma);
  const studentIds = students.map((s) => s.id);
  const userIds = students.map((s) => s.userId);
  const studentByUser = new Map(students.map((s) => [s.userId, s.id]));

  const { states: terms } = await getConsentStates(
    prisma,
    ConsentKind.TERMS_AND_NOTICE,
  );
  const acceptedTerms = students.filter(
    (s) => terms.get(s.userId) === 'CURRENT',
  ).length;

  const [transcript, roster, sectionEnrollments, chatted] = await Promise.all([
    prisma.enrollment.findMany({
      where: {
        source: EnrollmentSource.TRANSCRIPT,
        studentId: { in: studentIds },
      },
      distinct: ['studentId'],
      select: { studentId: true },
    }),
    prisma.sectionRoster.findMany({
      where: {
        linkedStudentId: { in: studentIds },
        status: { in: [RosterStatus.LINKED, RosterStatus.CONFIRMED] },
      },
      select: { linkedStudentId: true },
    }),
    prisma.enrollment.findMany({
      where: { studentId: { in: studentIds }, sectionId: { not: null } },
      distinct: ['studentId'],
      select: { studentId: true },
    }),
    prisma.conversation.findMany({
      where: {
        studentId: { in: studentIds },
        messages: { some: { role: RolMensaje.USER } },
      },
      distinct: ['studentId'],
      select: { studentId: true },
    }),
  ]);

  const joined = new Set<string>([
    ...roster.map((r) => r.linkedStudentId!).filter(Boolean),
    ...sectionEnrollments.map((e) => e.studentId),
  ]);

  const registered = students.length;
  const step = (key: string, label: string, count: number) => ({
    step: key,
    label,
    count: visible(count, k) ? count : null,
    rateOfRegistered: visible(count, k) ? pct(count, registered) : null,
  });
  const funnel = [
    step('REGISTERED', 'Registrados', registered),
    step('ACCEPTED_TERMS', 'Aceptaron términos', acceptedTerms),
    step('UPLOADED_TRANSCRIPT', 'Subieron tira', transcript.length),
    step('JOINED_SECTION', 'Se unieron a un grupo', joined.size),
    step('CHATTED', 'Usaron el chat', chatted.length),
  ];

  // Activos por semana
  const { keys, from } = lastWeeks(filters.weeks, ctx.now);
  const activeByWeek = new Map<string, Set<string>>(
    keys.map((key) => [key, new Set<string>()]),
  );
  const [logins, messages] = await Promise.all([
    prisma.authSession.findMany({
      where: { userId: { in: userIds }, createdAt: { gte: from } },
      select: { userId: true, createdAt: true },
    }),
    prisma.message.findMany({
      where: {
        role: RolMensaje.USER,
        createdAt: { gte: from },
        conversation: { studentId: { in: studentIds } },
      },
      select: {
        createdAt: true,
        conversation: { select: { studentId: true } },
      },
    }),
  ]);
  for (const l of logins) {
    const sid = studentByUser.get(l.userId);
    if (sid) activeByWeek.get(weekKey(l.createdAt))?.add(sid);
  }
  for (const m of messages) {
    activeByWeek.get(weekKey(m.createdAt))?.add(m.conversation.studentId);
  }

  const activeStudentsByWeek = keys.map((week) => {
    const n = activeByWeek.get(week)!.size;
    return { week, activeStudents: visible(n, k) ? n : null };
  });

  return ctx.metrics.envelope(
    { weeks: filters.weeks },
    { funnel, activeStudentsByWeek },
    [
      'Cada paso del embudo se cuenta de forma independiente sobre los alumnos registrados.',
      'Aceptaron términos = aceptación de la versión vigente de TERMS_AND_NOTICE.',
      'Se unieron a un grupo = vinculados en la lista (LINKED/CONFIRMED) o inscritos con grupo.',
      'Activo = inició sesión o escribió en el chat esa semana (lunes a domingo, CDMX).',
    ],
  );
}
