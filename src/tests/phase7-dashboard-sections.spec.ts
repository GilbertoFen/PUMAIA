import { MetricsService } from '../metrics/metrics.service';
import { DashboardService } from '../metrics/dashboard.service';
import { lastWeeks, weekKey, weekStart } from '../metrics/metrics.utils';
import { bucketFor } from '../metrics/sections/progress.section';
import {
  AttendanceStatus,
  ConsentKind,
  FeedbackValue,
  RosterStatus,
  TopicGroup,
} from '@prisma/client';

// Domingo 8 nov 2026, 12:00 CDMX (18:00 UTC)
const NOW = new Date('2026-11-08T18:00:00Z');

function makePrisma(overrides: Record<string, any> = {}) {
  const m = (v: any = []) => jest.fn().mockResolvedValue(v);
  const base: any = {
    student: { findMany: m() },
    enrollment: { findMany: m() },
    courseSection: { findMany: m(), count: m(0) },
    conversation: { findMany: m(), count: m(0) },
    sectionRoster: { findMany: m() },
    authSession: { findMany: m() },
    message: { findMany: m() },
    messageFeedback: { findMany: m() },
    conversationLabel: { findMany: m() },
    attendanceRecord: { findMany: m() },
    classSession: { count: m(0) },
    professor: { count: m(0) },
    privacyNotice: { findFirst: m(null) },
    consentRecord: { findMany: m() },
    academicPeriod: { findFirst: m(null), findUnique: m(null) },
    subject: { findMany: m() },
  };
  for (const [model, methods] of Object.entries(overrides)) {
    base[model] = { ...base[model], ...methods };
  }
  return base;
}

function build(prisma: any, k = '1') {
  const metrics = new MetricsService(prisma, { get: () => k } as any);
  const dashboard = new DashboardService(prisma, metrics);
  jest.useFakeTimers().setSystemTime(NOW);
  return dashboard;
}

afterEach(() => jest.useRealTimers());

/** Notice vigente "n2" y una lista de consentimientos (ordenados desc). */
function consents(kindNotice: Record<string, string>, records: any[]) {
  return {
    privacyNotice: {
      findFirst: jest.fn(({ where }) =>
        Promise.resolve(
          kindNotice[where.kind]
            ? { id: kindNotice[where.kind], version: 'v' }
            : null,
        ),
      ),
    },
    consentRecord: {
      findMany: jest.fn(({ where }) =>
        Promise.resolve(records.filter((r) => r.kind === where.kind)),
      ),
    },
  };
}

describe('Dashboard — utilidades de semanas (lunes a domingo, CDMX)', () => {
  it('domingo por la noche en CDMX sigue siendo la misma semana aunque en UTC ya sea lunes', () => {
    expect(weekKey(new Date('2026-11-09T05:30:00Z'))).toBe('2026-11-02'); // dom 23:30 CDMX
    expect(weekKey(new Date('2026-11-09T06:00:00Z'))).toBe('2026-11-09'); // lun 00:00 CDMX
    expect(weekStart('2026-11-09').toISOString()).toBe(
      '2026-11-09T06:00:00.000Z',
    );
  });

  it('lastWeeks devuelve n semanas consecutivas terminando en la actual', () => {
    const { keys, from } = lastWeeks(3, NOW);
    expect(keys).toEqual(['2026-10-19', '2026-10-26', '2026-11-02']);
    expect(from.toISOString()).toBe('2026-10-19T06:00:00.000Z');
  });
});

describe('Dashboard — Adopción', () => {
  it('embudo independiente por paso y activos por semana (login o mensaje), con semanas vacías en 0', async () => {
    const prisma = makePrisma({
      student: {
        findMany: jest.fn().mockResolvedValue([
          { id: 's1', userId: 'u1' },
          { id: 's2', userId: 'u2' },
          { id: 's3', userId: 'u3' },
        ]),
      },
      ...consents({ [ConsentKind.TERMS_AND_NOTICE]: 'n2' }, [
        {
          kind: ConsentKind.TERMS_AND_NOTICE,
          userId: 'u1',
          granted: true,
          noticeId: 'n2',
        },
        {
          kind: ConsentKind.TERMS_AND_NOTICE,
          userId: 'u2',
          granted: true,
          noticeId: 'n1',
        }, // versión vieja
      ]),
      enrollment: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ studentId: 's1' }]) // tira
          .mockResolvedValueOnce([{ studentId: 's2' }]), // inscritos con grupo
      },
      sectionRoster: {
        findMany: jest.fn().mockResolvedValue([{ linkedStudentId: 's1' }]),
      },
      conversation: {
        findMany: jest.fn().mockResolvedValue([{ studentId: 's3' }]),
      },
      authSession: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { userId: 'u1', createdAt: new Date('2026-11-03T15:00:00Z') },
          ]),
      },
      message: {
        findMany: jest.fn().mockResolvedValue([
          {
            createdAt: new Date('2026-11-04T15:00:00Z'),
            conversation: { studentId: 's3' },
          },
          {
            createdAt: new Date('2026-11-04T16:00:00Z'),
            conversation: { studentId: 's1' },
          },
        ]),
      },
    });
    const res = await build(prisma).adoption({ weeks: 2 });
    const counts = Object.fromEntries(
      res.items.funnel.map((f) => [f.step, f.count]),
    );
    expect(counts).toEqual({
      REGISTERED: 3,
      ACCEPTED_TERMS: 1,
      UPLOADED_TRANSCRIPT: 1,
      JOINED_SECTION: 2,
      CHATTED: 1,
    });
    expect(res.items.activeStudentsByWeek).toEqual([
      { week: '2026-10-26', activeStudents: 0 },
      { week: '2026-11-02', activeStudents: 2 },
    ]);
  });
});

describe('Dashboard — Chat (ANALYTICS vigente en todo)', () => {
  it('filtra temas, consultas y feedback por ANALYTICS vigente y agrupa por topicGroup', async () => {
    const prisma = makePrisma({
      ...consents({ [ConsentKind.ANALYTICS]: 'a2' }, [
        {
          kind: ConsentKind.ANALYTICS,
          userId: 'u1',
          granted: true,
          noticeId: 'a2',
        },
        {
          kind: ConsentKind.ANALYTICS,
          userId: 'u2',
          granted: false,
          noticeId: 'a2',
        },
      ]),
      conversation: { count: jest.fn().mockResolvedValue(4) },
      conversationLabel: {
        findMany: jest.fn().mockResolvedValue([
          {
            conversationId: 'c1',
            conversation: { studentId: 's1' },
            topic: {
              code: 'BECAS',
              label: 'Becas',
              topicGroup: TopicGroup.TRAMITES,
            },
          },
          {
            conversationId: 'c1',
            conversation: { studentId: 's1' },
            topic: {
              code: 'BAJA',
              label: 'Bajas',
              topicGroup: TopicGroup.TRAMITES,
            },
          },
          {
            conversationId: 'c2',
            conversation: { studentId: 's1' },
            topic: {
              code: 'ESTRES',
              label: 'Estrés',
              topicGroup: TopicGroup.BIENESTAR,
            },
          },
        ]),
      },
      message: {
        findMany: jest.fn().mockResolvedValue([
          {
            createdAt: new Date('2026-11-05T15:00:00Z'),
            conversation: { studentId: 's1' },
          },
          {
            createdAt: new Date('2026-11-05T16:00:00Z'),
            conversation: { studentId: 's1' },
          },
        ]),
      },
      messageFeedback: {
        findMany: jest.fn().mockResolvedValue([
          {
            value: FeedbackValue.UP,
            createdAt: new Date('2026-11-05T15:00:00Z'),
            message: { conversation: { studentId: 's1' } },
          },
          {
            value: FeedbackValue.UP,
            createdAt: new Date('2026-11-05T15:00:00Z'),
            message: { conversation: { studentId: 's1' } },
          },
          {
            value: FeedbackValue.DOWN,
            createdAt: new Date('2026-11-05T15:00:00Z'),
            message: { conversation: { studentId: 's1' } },
          },
        ]),
      },
    });
    const res = await build(prisma).chat({ weeks: 1 });

    const expectedWhere = {
      sensitive: false,
      student: { userId: { in: ['u1'] } },
    };
    expect(
      prisma.conversationLabel.findMany.mock.calls[0][0].where.conversation,
    ).toEqual(expectedWhere);
    expect(prisma.message.findMany.mock.calls[0][0].where.conversation).toEqual(
      expectedWhere,
    );
    expect(
      prisma.messageFeedback.findMany.mock.calls[0][0].where.message
        .conversation,
    ).toEqual(expectedWhere);

    const tramites = res.items.topicsByGroup.find(
      (g) => g.topicGroup === TopicGroup.TRAMITES,
    )!;
    expect(tramites.conversations).toBe(1); // c1 con dos temas cuenta una vez
    expect(tramites.topics).toHaveLength(2);
    expect(res.items.topicsByGroup).toHaveLength(
      Object.values(TopicGroup).length,
    );
    expect(res.items.coverage).toEqual({
      eligibleConversations: 4,
      labeledConversations: 2,
      labeledRate: 50,
    });
    expect(res.items.queriesByWeek).toEqual([
      { week: '2026-11-02', queries: 2 },
    ]);
    expect(res.items.feedback.total).toEqual({
      useful: 2,
      notUseful: 1,
      usefulRate: 66.67,
      notUsefulRate: 33.33,
    });
  });
});

describe('Dashboard — Avance de créditos', () => {
  it('clasifica por proporción de créditos obtenidos / esperados', () => {
    expect(bucketFor(0, 0)).toBe('ON_TRACK');
    expect(bucketFor(92, 100)).toBe('ON_TRACK');
    expect(bucketFor(75, 100)).toBe('SLIGHT_DELAY');
    expect(bucketFor(50, 100)).toBe('DELAY');
  });

  it('esperados = 406/8 × (semestre − 1); cada materia aprobada cuenta una vez; sin tira va aparte', async () => {
    const plan = { totalCredits: 406, semesters: 8 };
    const st = (sem: number, credits: number[], transcript = 1) => ({
      currentSemester: sem,
      career: { studyPlan: plan },
      enrollments: credits.map((c, i) => ({
        subjectId: `m${i}`,
        subject: { credits: c },
      })),
      _count: { enrollments: transcript },
    });
    const prisma = makePrisma({
      student: {
        findMany: jest.fn().mockResolvedValue([
          st(3, [50, 50]), // esperado 102 → 100/102 al corriente
          st(3, [40, 40]), // 80/102 = 0.78 rezago leve
          st(3, [], 0), // sin tira
        ]),
      },
    });
    const res = await build(prisma).progress();
    expect(res.items[0]).toMatchObject({
      semester: 3,
      expectedCredits: 102,
      studentsWithTranscript: 2,
      studentsWithoutTranscript: 1,
      averageEarnedCredits: 90,
      onTrack: 1,
      slightDelay: 1,
      delay: 0,
    });
  });
});

describe('Dashboard — Asistencia', () => {
  it('serie semanal y por materia; ignora faltas de bajas; sin profesor', async () => {
    const rec = (
      studentId: string,
      status: AttendanceStatus,
      startsAt: string,
      sectionId = 'g1',
    ) => ({
      studentId,
      status,
      session: {
        id: `s-${sectionId}-${startsAt}`,
        startsAt: new Date(startsAt),
        sectionId,
        section: {
          subjectId: 'sub1',
          groupCode: sectionId === 'g1' ? '1301' : '1151',
          subject: { subject: 'Álgebra' },
        },
      },
    });
    const prisma = makePrisma({
      attendanceRecord: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            rec('a', AttendanceStatus.PRESENT, '2026-11-03T15:00:00Z'),
            rec('b', AttendanceStatus.LATE, '2026-11-03T15:00:00Z'),
            rec('c', AttendanceStatus.EXCUSED, '2026-11-03T15:00:00Z'),
            rec('d', AttendanceStatus.ABSENT, '2026-11-03T15:00:00Z'),
            rec('baja', AttendanceStatus.ABSENT, '2026-11-03T15:00:00Z'),
          ]),
      },
      enrollment: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ studentId: 'baja', sectionId: 'g1' }]),
      },
      classSession: { count: jest.fn().mockResolvedValue(3) },
    });
    const res = await build(prisma).attendance({ weeks: 1 });
    const week = res.items.byWeek[0];
    expect(week).toMatchObject({
      week: '2026-11-02',
      students: 4,
      records: 4,
      presentRate: 25,
      lateRate: 25,
      absentRate: 25,
      excusedRate: 25,
    });
    expect(res.items.bySubject[0]).toMatchObject({
      subject: 'Álgebra',
      students: 4,
    });
    expect(res.items.openSessionsExcluded).toBe(3);
    expect(JSON.stringify(res)).not.toMatch(/professor/i);
  });

  it('agrega por grupo (materia + clave), cuenta sesiones, ordena alfabético y respeta el umbral', async () => {
    const rec = (
      studentId: string,
      status: AttendanceStatus,
      startsAt: string,
      sectionId: string,
      subject: string,
      groupCode: string,
    ) => ({
      studentId,
      status,
      session: {
        id: `s-${sectionId}-${startsAt}`,
        startsAt: new Date(startsAt),
        sectionId,
        section: { subjectId: subject, groupCode, subject: { subject } },
      },
    });
    const prisma = makePrisma({
      attendanceRecord: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            rec(
              'a',
              AttendanceStatus.PRESENT,
              '2026-11-03T15:00:00Z',
              'g2',
              'Cálculo',
              '1302',
            ),
            rec(
              'b',
              AttendanceStatus.ABSENT,
              '2026-11-03T15:00:00Z',
              'g2',
              'Cálculo',
              '1302',
            ),
            rec(
              'a',
              AttendanceStatus.PRESENT,
              '2026-11-05T15:00:00Z',
              'g2',
              'Cálculo',
              '1302',
            ),
            rec(
              'b',
              AttendanceStatus.PRESENT,
              '2026-11-05T15:00:00Z',
              'g2',
              'Cálculo',
              '1302',
            ),
            rec(
              'c',
              AttendanceStatus.PRESENT,
              '2026-11-03T15:00:00Z',
              'g1',
              'Álgebra',
              '1301',
            ),
          ]),
      },
    });
    const res = await build(prisma, '2').attendance({ weeks: 1 });
    const rows = res.items.bySection;
    expect(rows.map((r: any) => r.subject)).toEqual(['Álgebra', 'Cálculo']);
    expect(rows[1]).toMatchObject({
      groupCode: '1302',
      sessions: 2,
      students: 2,
      records: 4,
      presentRate: 75,
      absentRate: 25,
    });
    // Un solo alumno en Álgebra con k=2: protegido, pero las sesiones sí se muestran.
    expect(rows[0]).toMatchObject({
      groupCode: '1301',
      sessions: 1,
      students: null,
      presentRate: null,
    });
    expect(JSON.stringify(res)).not.toMatch(/professor/i);
  });
});

describe('Dashboard — Operación', () => {
  it('clasifica grupos por estado de lista y cuenta consentimientos por tipo', async () => {
    const prisma = makePrisma({
      courseSection: {
        findMany: jest.fn().mockResolvedValue([
          { roster: [] },
          { roster: [{ status: RosterStatus.REJECTED }] },
          {
            roster: [
              { status: RosterStatus.CONFIRMED },
              { status: RosterStatus.REJECTED },
            ],
          },
          {
            roster: [
              { status: RosterStatus.CONFIRMED },
              { status: RosterStatus.LINKED },
            ],
          },
        ]),
      },
      professor: {
        count: jest.fn().mockResolvedValueOnce(10).mockResolvedValueOnce(3),
      },
      student: {
        findMany: jest.fn().mockResolvedValue([
          { id: 's1', userId: 'u1' },
          { id: 's2', userId: 'u2' },
          { id: 's3', userId: 'u3' },
        ]),
      },
      ...consents({ [ConsentKind.ANALYTICS]: 'a2' }, [
        {
          kind: ConsentKind.ANALYTICS,
          userId: 'u1',
          granted: true,
          noticeId: 'a2',
        },
        {
          kind: ConsentKind.ANALYTICS,
          userId: 'u2',
          granted: false,
          noticeId: 'a2',
        },
        {
          kind: ConsentKind.ANALYTICS,
          userId: 'u3',
          granted: true,
          noticeId: 'a1',
        },
      ]),
    });
    const res = await build(prisma).operations();
    expect(res.items.sections).toMatchObject({
      total: 4,
      noList: 2,
      pendingConfirmation: 1,
      confirmed: 1,
    });
    expect(res.items.professors).toMatchObject({
      active: 10,
      withAccount: 3,
      withoutAccount: 7,
    });
    const analytics = res.items.consents.find(
      (c) => c.kind === ConsentKind.ANALYTICS,
    )!;
    expect(analytics).toMatchObject({
      granted: 1,
      revoked: 1,
      outdatedVersion: 1,
      noResponse: 0,
    });
  });
});

describe('Dashboard — Rendimiento', () => {
  it('histograma de promedios, promedio por periodo y recursamiento; con k=2 oculta celdas pequeñas', async () => {
    const prisma = makePrisma({
      student: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { average: 8.5 },
            { average: 8.1 },
            { average: 9.9 },
            { average: 10 },
            { average: 6.2 },
          ]),
      },
      enrollment: {
        findMany: jest
          .fn()
          // promedio por periodo
          .mockResolvedValueOnce([
            {
              studentId: 'a',
              grade: 8,
              period: { id: 'p1', code: '2025-1', startsAt: null },
            },
            {
              studentId: 'b',
              grade: 10,
              period: { id: 'p1', code: '2025-1', startsAt: null },
            },
            {
              studentId: 'a',
              grade: 7,
              period: { id: 'p2', code: '2025-2', startsAt: null },
            },
          ])
          // recursamiento
          .mockResolvedValueOnce([
            {
              studentId: 'a',
              subjectId: 'm1',
              attempt: 1,
              subject: { subject: 'Cálculo', semester: 1 },
            },
            {
              studentId: 'a',
              subjectId: 'm1',
              attempt: 2,
              subject: { subject: 'Cálculo', semester: 1 },
            },
            {
              studentId: 'b',
              subjectId: 'm1',
              attempt: 2,
              subject: { subject: 'Cálculo', semester: 1 },
            },
            {
              studentId: 'a',
              subjectId: 'm2',
              attempt: 1,
              subject: { subject: 'Álgebra', semester: 1 },
            },
          ]),
      },
    });
    const res = await build(prisma, '2').performance();
    const bins = Object.fromEntries(
      res.items.averageHistogram.map((b) => [b.bin, b.students]),
    );
    // 6–7 tiene 1 alumno (< 2) → oculto; también la siguiente más pequeña (8–9 o 9–10, ambas con 2)
    expect(bins['6–7']).toBeNull();
    expect(bins['5–6']).toBe(0);
    expect([bins['8–9'], bins['9–10']]).toContain(null);
    expect(res.items.averageByPeriod).toEqual([
      { periodId: 'p1', period: '2025-1', students: 2, averageGrade: 9 },
      { periodId: 'p2', period: '2025-2', students: null, averageGrade: null },
    ]);
    expect(res.items.mostRetaken).toEqual([
      {
        subjectId: 'm1',
        subjectName: 'Cálculo',
        semester: 1,
        studentsRetaking: 2,
      },
    ]);
  });
});
