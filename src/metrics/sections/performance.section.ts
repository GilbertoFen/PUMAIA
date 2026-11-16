import { SectionContext } from './context';
import {
  mean,
  REGISTERED_STUDENT,
  suppressSmallCells,
  visible,
} from '../metrics.utils';

const AVERAGE_BINS = [
  { label: '5–6', min: 5, max: 6 },
  { label: '6–7', min: 6, max: 7 },
  { label: '7–8', min: 7, max: 8 },
  { label: '8–9', min: 8, max: 9 },
  { label: '9–10', min: 9, max: 10.0001 },
];

const TOP_RETAKES = 10;

/**
 * Rendimiento:
 * - Reprobación por materia (reusa getAcademicPerformance), de mayor a menor.
 * - Histograma de promedios generales (Student.average).
 * - Promedio de calificaciones por periodo (solo inscripciones con periodo).
 * - Materias con más recursamiento (alumnos con más de un intento en la misma materia).
 */
export async function getPerformance(
  ctx: SectionContext,
  filters: { periodId?: string },
) {
  const { prisma, k } = ctx;

  // 1. Reprobación por materia
  const academic = await ctx.metrics.getAcademicPerformance({
    periodId: filters.periodId,
  });
  const failRateBySubject = academic.items
    .filter((s) => s.failRate !== null)
    .map((s) => ({
      subjectId: s.subjectId,
      subjectName: s.subjectName,
      semester: s.semester,
      failRate: s.failRate as number,
      completedStudents: s.completedStudents,
    }))
    .sort(
      (a, b) =>
        b.failRate - a.failRate ||
        (b.completedStudents ?? 0) - (a.completedStudents ?? 0),
    );

  // 2. Histograma de promedios
  const averages = await prisma.student.findMany({
    where: { ...REGISTERED_STUDENT, average: { not: null } },
    select: { average: true },
  });
  const binCounts = new Map<string, number>(
    AVERAGE_BINS.map((b) => [b.label, 0]),
  );
  for (const { average } of averages) {
    const v = Number(average);
    const bin = AVERAGE_BINS.find((b) => v >= b.min && v < b.max);
    if (bin) binCounts.set(bin.label, binCounts.get(bin.label)! + 1);
  }
  const hiddenBins = suppressSmallCells(binCounts, k);
  const averageHistogram = AVERAGE_BINS.map((b) => ({
    bin: b.label,
    students: hiddenBins.has(b.label) ? null : binCounts.get(b.label)!,
  }));

  // 3. Promedio por periodo
  const graded = await prisma.enrollment.findMany({
    where: {
      periodId: filters.periodId ?? { not: null },
      grade: { not: null },
    },
    select: {
      studentId: true,
      grade: true,
      period: { select: { id: true, code: true, startsAt: true } },
    },
  });
  const byPeriod = new Map<
    string,
    {
      code: string;
      startsAt: Date | null;
      grades: number[];
      students: Set<string>;
    }
  >();
  for (const e of graded) {
    if (!e.period) continue;
    if (!byPeriod.has(e.period.id)) {
      byPeriod.set(e.period.id, {
        code: e.period.code,
        startsAt: e.period.startsAt,
        grades: [],
        students: new Set(),
      });
    }
    const p = byPeriod.get(e.period.id)!;
    p.grades.push(e.grade!);
    p.students.add(e.studentId);
  }
  const averageByPeriod = [...byPeriod.entries()]
    .sort(
      ([, a], [, b]) =>
        (a.startsAt?.getTime() ?? 0) - (b.startsAt?.getTime() ?? 0) ||
        a.code.localeCompare(b.code),
    )
    .map(([periodId, p]) => {
      const show = visible(p.students.size, k);
      return {
        periodId,
        period: p.code,
        students: show ? p.students.size : null,
        averageGrade: show ? mean(p.grades) : null,
      };
    });

  // 4. Recursamiento
  const attempts = await prisma.enrollment.findMany({
    select: {
      studentId: true,
      subjectId: true,
      attempt: true,
      subject: { select: { subject: true, semester: true } },
    },
  });
  const perSubject = new Map<
    string,
    { name: string; semester: number | null; byStudent: Map<string, number> }
  >();
  for (const e of attempts) {
    if (!perSubject.has(e.subjectId)) {
      perSubject.set(e.subjectId, {
        name: e.subject.subject,
        semester: e.subject.semester,
        byStudent: new Map(),
      });
    }
    const s = perSubject.get(e.subjectId)!;
    // Cuenta inscripciones por alumno; un intento > 1 también indica recursamiento.
    const prev = s.byStudent.get(e.studentId) ?? 0;
    s.byStudent.set(e.studentId, Math.max(prev + 1, e.attempt));
  }
  const mostRetaken = [...perSubject.entries()]
    .map(([subjectId, s]) => {
      const retaking = [...s.byStudent.values()].filter((n) => n > 1).length;
      return { subjectId, subjectName: s.name, semester: s.semester, retaking };
    })
    .filter((s) => s.retaking > 0)
    .sort(
      (a, b) =>
        b.retaking - a.retaking || a.subjectName.localeCompare(b.subjectName),
    )
    .slice(0, TOP_RETAKES)
    .map(({ retaking, ...rest }) => ({
      ...rest,
      studentsRetaking: visible(retaking, k) ? retaking : null,
    }));

  return ctx.metrics.envelope(
    { periodId: filters.periodId },
    { failRateBySubject, averageHistogram, averageByPeriod, mostRetaken },
    [
      'Reprobación sobre alumnos que terminaron la materia (sin IN_PROGRESS).',
      'Promedio por periodo: solo inscripciones que tienen periodo; las de tira sin periodo no entran.',
      'Recursamiento depende de que la carga de tira guarde cada intento (hoy sobrescribe).',
    ],
  );
}
