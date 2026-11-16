import { ConsentKind, RosterStatus } from '@prisma/client';
import { SectionContext } from './context';
import {
  getConsentStates,
  loadRegisteredStudents,
  pct,
  resolvePeriod,
} from '../metrics.utils';

/**
 * Operación: estado de las listas de grupo, profesores con cuenta y consentimientos por tipo.
 * Son cifras operativas (sin datos de alumnos individuales).
 */
export async function getOperations(
  ctx: SectionContext,
  filters: { periodId?: string },
) {
  const { prisma } = ctx;
  const period = await resolvePeriod(prisma, filters.periodId, ctx.now);

  // Grupos por estado de lista
  const sections = await prisma.courseSection.findMany({
    where: period ? { periodId: period.id } : {},
    select: { roster: { select: { status: true } } },
  });
  let noList = 0;
  let pending = 0;
  let confirmed = 0;
  for (const s of sections) {
    const active = s.roster.filter((r) => r.status !== RosterStatus.REJECTED);
    if (active.length === 0) noList++;
    else if (active.every((r) => r.status === RosterStatus.CONFIRMED))
      confirmed++;
    else pending++;
  }

  // Profesores
  const [professorsActive, professorsWithAccount] = await Promise.all([
    prisma.professor.count({ where: { active: true } }),
    prisma.professor.count({ where: { active: true, userId: { not: null } } }),
  ]);

  // Consentimientos de alumnos registrados, por tipo
  const students = await loadRegisteredStudents(prisma);
  const consents = await Promise.all(
    Object.values(ConsentKind).map(async (kind) => {
      const { noticeVersion, states } = await getConsentStates(prisma, kind);
      const counts = { CURRENT: 0, REVOKED: 0, OUTDATED: 0, NONE: 0 };
      for (const s of students) counts[states.get(s.userId) ?? 'NONE']++;
      return {
        kind,
        noticeVersion,
        granted: counts.CURRENT,
        revoked: counts.REVOKED,
        outdatedVersion: counts.OUTDATED,
        noResponse: counts.NONE,
      };
    }),
  );

  return ctx.metrics.envelope(
    { periodId: period?.id, periodCode: period?.code },
    {
      sections: {
        total: sections.length,
        noList,
        pendingConfirmation: pending,
        confirmed,
        confirmedRate: pct(confirmed, sections.length),
      },
      professors: {
        active: professorsActive,
        withAccount: professorsWithAccount,
        withoutAccount: professorsActive - professorsWithAccount,
        withAccountRate: pct(professorsWithAccount, professorsActive),
      },
      consents,
    },
    [
      'Lista confirmada = todos los alumnos no rechazados de la lista están CONFIRMED.',
      'Grupos del periodo en curso si no se indica periodId (todos si no hay periodo en curso).',
      'Consentimientos: última decisión de cada alumno registrado frente a la versión vigente del aviso.',
    ],
  );
}
