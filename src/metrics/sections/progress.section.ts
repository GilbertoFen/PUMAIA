import { EnrollmentSource, EnrollmentStatus } from '@prisma/client';
import { SectionContext } from './context';
import {
  mean,
  REGISTERED_STUDENT,
  suppressSmallCells,
  visible,
} from '../metrics.utils';

/** Proporción de créditos obtenidos / esperados. */
export const ON_TRACK_RATIO = 0.9;
export const SLIGHT_DELAY_RATIO = 0.7;

type Bucket = 'ON_TRACK' | 'SLIGHT_DELAY' | 'DELAY';
const BUCKETS: Bucket[] = ['ON_TRACK', 'SLIGHT_DELAY', 'DELAY'];

export function bucketFor(earned: number, expected: number): Bucket {
  if (expected <= 0) return 'ON_TRACK';
  const ratio = earned / expected;
  if (ratio >= ON_TRACK_RATIO) return 'ON_TRACK';
  if (ratio >= SLIGHT_DELAY_RATIO) return 'SLIGHT_DELAY';
  return 'DELAY';
}

/**
 * Avance de créditos por semestre actual.
 * - Obtenidos: créditos de materias aprobadas (cada materia cuenta una vez).
 * - Esperados: ritmo lineal del plan = créditos totales / semestres × (semestre actual − 1).
 *   (El catálogo no distingue obligatorias de optativas y los semestres 7–8 las mezclan.)
 * - Solo alumnos que subieron tira; los demás se reportan aparte.
 */
export async function getProgress(ctx: SectionContext) {
  const { prisma, k } = ctx;

  const students = await prisma.student.findMany({
    where: { ...REGISTERED_STUDENT, isGraduated: false },
    select: {
      currentSemester: true,
      career: {
        select: {
          studyPlan: { select: { totalCredits: true, semesters: true } },
        },
      },
      enrollments: {
        where: { status: EnrollmentStatus.PASSED },
        select: { subjectId: true, subject: { select: { credits: true } } },
      },
      _count: {
        select: {
          enrollments: { where: { source: EnrollmentSource.TRANSCRIPT } },
        },
      },
    },
  });

  type Group = {
    semester: number;
    expected: number | null;
    earned: number[];
    buckets: Map<Bucket, number>;
    withoutTranscript: number;
  };
  const groups = new Map<number, Group>();
  let planTotal: number | null = null;

  for (const st of students) {
    const sem = st.currentSemester;
    if (!groups.has(sem)) {
      groups.set(sem, {
        semester: sem,
        expected: null,
        earned: [],
        buckets: new Map(BUCKETS.map((b) => [b, 0])),
        withoutTranscript: 0,
      });
    }
    const g = groups.get(sem)!;
    const plan = st.career?.studyPlan;
    if (plan?.totalCredits) planTotal = plan.totalCredits;

    if (st._count.enrollments === 0) {
      g.withoutTranscript++;
      continue;
    }
    if (!plan?.totalCredits || !plan.semesters) continue;

    const expected = Math.round(
      (plan.totalCredits / plan.semesters) * Math.max(sem - 1, 0),
    );
    const credits = new Map<string, number>();
    for (const e of st.enrollments)
      credits.set(e.subjectId, e.subject.credits ?? 0);
    const earned = [...credits.values()].reduce((a, b) => a + b, 0);

    g.expected = expected;
    g.earned.push(earned);
    const bucket = bucketFor(earned, expected);
    g.buckets.set(bucket, g.buckets.get(bucket)! + 1);
  }

  const items = [...groups.values()]
    .sort((a, b) => a.semester - b.semester)
    .map((g) => {
      const n = g.earned.length;
      const show = visible(n, k);
      const hidden = suppressSmallCells(g.buckets, k);
      return {
        semester: g.semester,
        studentsWithTranscript: show ? n : null,
        studentsWithoutTranscript: visible(g.withoutTranscript, k)
          ? g.withoutTranscript
          : null,
        expectedCredits: g.expected,
        averageEarnedCredits: show ? mean(g.earned) : null,
        onTrack:
          show && !hidden.has('ON_TRACK') ? g.buckets.get('ON_TRACK')! : null,
        slightDelay:
          show && !hidden.has('SLIGHT_DELAY')
            ? g.buckets.get('SLIGHT_DELAY')!
            : null,
        delay: show && !hidden.has('DELAY') ? g.buckets.get('DELAY')! : null,
        suppressed: !show,
      };
    });

  return ctx.metrics.envelope({}, items, [
    `Créditos esperados = ${planTotal ?? 'créditos del plan'} / semestres × (semestre actual − 1).`,
    `Al corriente ≥ ${ON_TRACK_RATIO * 100} % de lo esperado; rezago leve ≥ ${SLIGHT_DELAY_RATIO * 100} %; rezago < ${SLIGHT_DELAY_RATIO * 100} %.`,
    'Solo alumnos no egresados que subieron tira; cada materia aprobada cuenta una vez.',
  ]);
}
