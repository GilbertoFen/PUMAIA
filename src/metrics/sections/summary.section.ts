import { ConsentKind, EnrollmentSource } from '@prisma/client';
import { SectionContext } from './context';
import {
  getConsentStates,
  loadRegisteredStudents,
  pct,
  resolvePeriod,
  weekKey,
  weekStart,
} from '../metrics.utils';

/**
 * Resumen (tarjetas). Son cifras de uso de la plataforma: cuentan a todos los alumnos registrados.
 * Grupos: del periodo pedido o del periodo en curso; si no hay ninguno, de todos.
 */
export async function getSummary(
  ctx: SectionContext,
  filters: { periodId?: string },
) {
  const { prisma, k } = ctx;
  const period = await resolvePeriod(prisma, filters.periodId, ctx.now);
  const students = await loadRegisteredStudents(prisma);
  const studentIds = students.map((s) => s.id);
  const registered = students.length;
  const showRates = registered === 0 || registered >= k;

  const { states: analytics } = await getConsentStates(
    prisma,
    ConsentKind.ANALYTICS,
  );
  const withAnalytics = students.filter(
    (s) => analytics.get(s.userId) === 'CURRENT',
  ).length;

  const withTranscript = (
    await prisma.enrollment.findMany({
      where: {
        source: EnrollmentSource.TRANSCRIPT,
        studentId: { in: studentIds },
      },
      distinct: ['studentId'],
      select: { studentId: true },
    })
  ).length;

  const sectionWhere = period ? { periodId: period.id } : {};
  const [sectionsTotal, sectionsWithProfessor, conversationsThisWeek] =
    await Promise.all([
      prisma.courseSection.count({ where: sectionWhere }),
      prisma.courseSection.count({
        where: { ...sectionWhere, professorId: { not: null } },
      }),
      prisma.conversation.count({
        where: { createdAt: { gte: weekStart(weekKey(ctx.now)) } },
      }),
    ]);

  return ctx.metrics.envelope(
    { periodId: period?.id, periodCode: period?.code },
    {
      registeredStudents: registered,
      analyticsConsentRate: showRates ? pct(withAnalytics, registered) : null,
      transcriptUploadedRate: showRates
        ? pct(withTranscript, registered)
        : null,
      sections: {
        total: sectionsTotal,
        withProfessor: sectionsWithProfessor,
        rate: pct(sectionsWithProfessor, sectionsTotal),
      },
      conversationsThisWeek,
    },
    [
      'Alumno registrado = cuenta ACTIVE no eliminada.',
      '% con ANALYTICS = última decisión es aceptar la versión vigente del aviso.',
      'Grupos del periodo en curso si no se indica periodId (todos si no hay periodo en curso).',
      'Semana de lunes a domingo, hora de la Ciudad de México.',
    ],
  );
}
