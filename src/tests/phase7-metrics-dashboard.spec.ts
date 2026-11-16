import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { MetricsService } from '../metrics/metrics.service';
import { MetricsController } from '../metrics/metrics.controller';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  AttendanceQueryDto,
  SatisfactionQueryDto,
} from '../metrics/dto/metrics-query.dto';
import {
  AttendanceStatus,
  EnrollmentStatus,
  QuestionType,
  TopicGroup,
} from '@prisma/client';

const admin = {
  userId: 'admin-1',
  studentId: null,
  email: 'admin@test',
  name: 'Admin',
  roles: ['INSTITUTION_ADMIN'],
  accountNumber: null,
} as any;

describe('Fase 7 — Métricas agregadas del dashboard (PumaIA)', () => {
  let prismaMock: any;
  let auditMock: { log: jest.Mock };
  let controller: MetricsController;

  // Los casos de privacidad se prueban con k=10; el default real (1) se prueba aparte.
  async function build(minGroup: string | undefined = '10') {
    prismaMock = {
      subject: { findMany: jest.fn().mockResolvedValue([]) },
      student: { findMany: jest.fn().mockResolvedValue([]) },
      courseSection: { findMany: jest.fn().mockResolvedValue([]) },
      topicCategory: { findMany: jest.fn().mockResolvedValue([]) },
      question: { findMany: jest.fn().mockResolvedValue([]) },
      privacyNotice: { findFirst: jest.fn().mockResolvedValue(null) },
      consentRecord: { findMany: jest.fn().mockResolvedValue([]) },
    };
    auditMock = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [
        MetricsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
        {
          provide: ConfigService,
          useValue: { get: () => minGroup },
        },
      ],
    }).compile();

    controller = module.get(MetricsController);
  }

  beforeEach(() => build());

  describe('0. Umbral configurable (METRICS_MIN_GROUP)', () => {
    it('usa 10 por defecto y acepta enteros >= 1', () => {
      expect(MetricsService.parseMinGroup(undefined)).toBe(1);
      expect(MetricsService.parseMinGroup('')).toBe(1);
      expect(MetricsService.parseMinGroup('10')).toBe(10);
      expect(MetricsService.parseMinGroup('1')).toBe(1);
    });

    it('falla al arrancar con valores inválidos', () => {
      for (const bad of ['0', '-3', 'abc', '2.5']) {
        expect(() => MetricsService.parseMinGroup(bad)).toThrow();
      }
    });

    it('con umbral 1 muestra grupos pequeños (modo desarrollo)', async () => {
      await build('1');
      prismaMock.subject.findMany.mockResolvedValue([
        {
          id: 's',
          subject: 'Tópicos',
          semester: 8,
          credits: 8,
          category: { category: 'COMPUTACION' },
          enrollments: [
            enr('a', EnrollmentStatus.PASSED, 9),
            enr('b', EnrollmentStatus.FAILED, 5),
          ],
        },
      ]);
      const res = await controller.getAcademicPerformance({}, admin);
      expect(res.minGroupSize).toBe(1);
      expect(res.items[0].suppressed).toBe(false);
      expect(res.items[0].passRate).toBe(50);
    });
  });

  describe('1. Rendimiento académico', () => {
    it('suprime materias con menos de k alumnos', async () => {
      prismaMock.subject.findMany.mockResolvedValue([
        subject(
          Array.from({ length: 3 }, (_, i) =>
            enr(`s${i}`, EnrollmentStatus.PASSED, 9),
          ),
        ),
      ]);
      const res = await controller.getAcademicPerformance({}, admin);
      expect(res.items[0]).toMatchObject({
        suppressed: true,
        suppressionReason: 'MIN_GROUP',
        totalStudents: null,
        averageGrade: null,
        passRate: null,
      });
    });

    it('calcula tasas sobre alumnos que terminaron, no sobre IN_PROGRESS', async () => {
      const enrollments = [
        ...Array.from({ length: 8 }, (_, i) =>
          enr(`p${i}`, EnrollmentStatus.PASSED, 8),
        ),
        ...Array.from({ length: 2 }, (_, i) =>
          enr(`f${i}`, EnrollmentStatus.FAILED, 5),
        ),
        ...Array.from({ length: 5 }, (_, i) =>
          enr(`c${i}`, EnrollmentStatus.IN_PROGRESS, null),
        ),
      ];
      prismaMock.subject.findMany.mockResolvedValue([subject(enrollments)]);
      const { items } = await controller.getAcademicPerformance({}, admin);
      expect(items[0]).toMatchObject({
        totalStudents: 15,
        completedStudents: 10,
        inProgressStudents: 5,
        passRate: 80,
        failRate: 20,
        averageGrade: 7.4,
        suppressed: false,
      });
    });

    it('filtra por periodo en la base, sin incluir inscripciones sin periodo', async () => {
      await controller.getAcademicPerformance({ periodId: 'per-1' }, admin);
      const args = prismaMock.subject.findMany.mock.calls[0][0];
      expect(args.select.enrollments.where).toEqual({ periodId: 'per-1' });
      expect(args.where).toEqual({
        enrollments: { some: { periodId: 'per-1' } },
      });
    });

    it('cuenta un solo registro por alumno (intento más reciente)', async () => {
      const enrollments = Array.from({ length: 10 }, (_, i) =>
        enr(`s${i}`, EnrollmentStatus.PASSED, 8),
      );
      enrollments.push({
        ...enr('s0', EnrollmentStatus.FAILED, 5),
        attempt: 0,
      });
      prismaMock.subject.findMany.mockResolvedValue([subject(enrollments)]);
      const { items } = await controller.getAcademicPerformance({}, admin);
      expect(items[0].totalStudents).toBe(10);
      expect(items[0].passRate).toBe(100);
    });

    it('suprime por diferencia si el resto de carreras queda entre 1 y k-1', async () => {
      const enrollments = [
        ...Array.from({ length: 12 }, (_, i) =>
          enr(`m${i}`, EnrollmentStatus.PASSED, 8, 'mac'),
        ),
        enr('x', EnrollmentStatus.FAILED, 5, 'otra'),
      ];
      prismaMock.subject.findMany.mockResolvedValue([subject(enrollments)]);
      const { items } = await controller.getAcademicPerformance(
        { careerId: 'mac' },
        admin,
      );
      expect(items[0].suppressionReason).toBe('DIFFERENCING');
    });
  });

  describe('2. Rezago y riesgo', () => {
    it('agrupa por currentSemester real (ya no todo cae en semestre 1)', async () => {
      await build('2');
      const students = [
        st('a', 3, [EnrollmentStatus.PASSED]),
        st('b', 3, [EnrollmentStatus.FAILED]),
        st('c', 5, [EnrollmentStatus.PASSED, EnrollmentStatus.WITHDRAWN]),
        st('d', 5, [EnrollmentStatus.PASSED]),
      ];
      prismaMock.student.findMany.mockResolvedValue(students);
      const { items } = await controller.getRetentionAndRisk({}, admin);
      expect(items.map((g) => g.semester)).toEqual([3, 5]);
      expect(items[0]).toMatchObject({
        totalStudents: 2,
        riskRate: 50,
        studentsWithRiskRate: 50,
      });
      expect(items[1]).toMatchObject({
        withdrawnRate: 33.33,
        studentsWithRiskRate: 50,
      });
    });

    it('excluye egresados y filtra inscripciones por periodo', async () => {
      await controller.getRetentionAndRisk({ periodId: 'per-1' }, admin);
      const args = prismaMock.student.findMany.mock.calls[0][0];
      expect(args.where.isGraduated).toBe(false);
      expect(args.select.enrollments.where).toEqual({ periodId: 'per-1' });
    });

    it('aplica supresión complementaria cuando solo un semestre es pequeño', async () => {
      const students = [
        ...Array.from({ length: 12 }, (_, i) =>
          st(`a${i}`, 3, [EnrollmentStatus.PASSED]),
        ),
        ...Array.from({ length: 11 }, (_, i) =>
          st(`b${i}`, 5, [EnrollmentStatus.PASSED]),
        ),
        st('solo', 7, [EnrollmentStatus.FAILED]),
      ];
      prismaMock.student.findMany.mockResolvedValue(students);
      const { items } = await controller.getRetentionAndRisk({}, admin);
      const bySem = Object.fromEntries(items.map((g) => [g.semester, g]));
      expect(bySem[7].suppressionReason).toBe('MIN_GROUP');
      expect(bySem[5].suppressionReason).toBe('DIFFERENCING');
      expect(bySem[3].suppressed).toBe(false);
    });
  });

  describe('3. Asistencia por grupo', () => {
    it('incluye EXCUSED (suma 100 %), ignora faltas de bajas y no expone al profesor', async () => {
      const records = [
        ...Array.from({ length: 6 }, (_, i) => ({
          studentId: `s${i}`,
          status: AttendanceStatus.PRESENT,
        })),
        { studentId: 's6', status: AttendanceStatus.LATE },
        { studentId: 's7', status: AttendanceStatus.ABSENT },
        { studentId: 's8', status: AttendanceStatus.EXCUSED },
        { studentId: 's9', status: AttendanceStatus.EXCUSED },
        { studentId: 'baja', status: AttendanceStatus.ABSENT },
      ];
      prismaMock.courseSection.findMany.mockResolvedValue([
        {
          id: 'sec-1',
          groupCode: '1101',
          subject: { id: 'sub-1', subject: 'Álgebra' },
          period: { id: 'per-1', code: '2026-1' },
          sessions: [{ id: 'ses-1', records }],
          enrollments: [{ studentId: 'baja' }],
          _count: { sessions: 2 },
        },
      ]);
      const { items } = await controller.getAttendance({}, admin);
      const row = items[0];
      expect(row).toMatchObject({
        totalStudents: 10,
        totalRecords: 10,
        presentRate: 60,
        lateRate: 10,
        absentRate: 10,
        excusedRate: 20,
        openSessionsExcluded: 2,
      });
      expect(
        row.presentRate! + row.lateRate! + row.absentRate! + row.excusedRate!,
      ).toBe(100);
      expect(JSON.stringify(row)).not.toMatch(/professor/i);
    });

    it('solo considera sesiones cerradas', async () => {
      await controller.getAttendance({}, admin);
      const args = prismaMock.courseSection.findMany.mock.calls[0][0];
      expect(args.select.sessions.where).toEqual({ status: 'CLOSED' });
      expect(args.select.professor).toBeUndefined();
    });
  });

  describe('4. Temas del chat y consentimiento ANALYTICS vigente', () => {
    it('solo cuenta usuarios cuyo último consentimiento es de la versión vigente', async () => {
      prismaMock.privacyNotice.findFirst.mockResolvedValue({
        id: 'n2',
        version: '2.0',
      });
      prismaMock.consentRecord.findMany.mockResolvedValue([
        // ordenados por createdAt desc
        { userId: 'u-ok', granted: true, noticeId: 'n2' },
        { userId: 'u-old', granted: true, noticeId: 'n1' }, // versión vieja
        { userId: 'u-revoked', granted: false, noticeId: 'n2' },
        { userId: 'u-revoked', granted: true, noticeId: 'n2' }, // anterior, ya no cuenta
      ]);
      await controller.getChatTopics(admin);
      const args = prismaMock.topicCategory.findMany.mock.calls[0][0];
      expect(args.select.labels.where.conversation).toEqual({
        sensitive: false,
        student: { userId: { in: ['u-ok'] } },
      });
    });

    it('sin aviso ANALYTICS publicado nadie es elegible', async () => {
      const res = await controller.getChatTopics(admin);
      const args = prismaMock.topicCategory.findMany.mock.calls[0][0];
      expect(args.select.labels.where.conversation.student.userId.in).toEqual(
        [],
      );
      expect(res.analyticsNoticeVersion).toBeNull();
      expect(prismaMock.consentRecord.findMany).not.toHaveBeenCalled();
    });

    it('cuenta conversaciones distintas y no expone contenido', async () => {
      const labels = Array.from({ length: 10 }, (_, i) => ({
        conversationId: `c${i}`,
        confidence: i % 2 === 0 ? 0.95 : 0.85,
        conversation: { studentId: `s${i}` },
      }));
      labels.push({
        conversationId: 'c0',
        confidence: 0.95,
        conversation: { studentId: 's0' },
      });
      prismaMock.topicCategory.findMany.mockResolvedValue([
        {
          code: 'CAREER',
          label: 'Orientación',
          topicGroup: TopicGroup.ACADEMICO,
          active: true,
          labels,
        },
      ]);
      const { items } = await controller.getChatTopics(admin);
      expect(items[0]).toMatchObject({
        totalStudents: 10,
        totalConversations: 10,
        suppressed: false,
      });
      expect(JSON.stringify(items)).not.toMatch(
        /message|transcript|studentId/i,
      );
    });
  });

  describe('5. Cuestionarios', () => {
    it('promedia solo valores de escala válidos y una vez por alumno', async () => {
      const options = [1, 2, 3, 4, 5].map((n) => ({
        id: `o${n}`,
        value: String(n),
        label: `L${n}`,
        position: n,
      }));
      const answers = [
        ...Array.from({ length: 10 }, (_, i) =>
          ans(`s${i}`, `r${i}`, new Date(2026, 1, 1), null, 4),
        ),
        ans('s0', 'r0-new', new Date(2026, 5, 1), null, 5), // envío más reciente de s0
        ans('s10', 'r10', new Date(2026, 1, 1), null, 999), // fuera de escala
      ];
      prismaMock.question.findMany.mockResolvedValue([
        {
          id: 'q1',
          code: 'SAT',
          text: '¿Satisfacción?',
          type: QuestionType.SCALE,
          category: null,
          position: 1,
          questionnaire: { version: 1 },
          options,
          answers,
        },
      ]);
      const { items } = await controller.getSatisfaction({}, admin);
      expect(items[0].respondents).toBe(11);
      expect(items[0].averageScale).toBe(4.1); // (9×4 + 5) / 10
      const dist = items[0].optionDistribution!;
      // Solo una celda pequeña (5 → 1 alumno): también se oculta la siguiente (4 → 9) para que no se deduzca por resta.
      expect(dist.find((d) => d.value === '4')!).toMatchObject({
        count: null,
        suppressed: true,
      });
      expect(dist.find((d) => d.value === '1')!).toMatchObject({
        count: 0,
        suppressed: false,
      });
      expect(dist.find((d) => d.value === '5')!).toMatchObject({
        count: null,
        suppressed: true,
      });
    });

    it('no devuelve distribución para preguntas de texto libre', async () => {
      const answers = Array.from({ length: 10 }, (_, i) =>
        ans(`s${i}`, `r${i}`, new Date(), null, null),
      );
      prismaMock.question.findMany.mockResolvedValue([
        {
          id: 'q',
          code: 'TXT',
          text: 'Comentarios',
          type: QuestionType.TEXT,
          category: null,
          position: 1,
          questionnaire: { version: 1 },
          options: [],
          answers,
        },
      ]);
      const { items } = await controller.getSatisfaction(
        { kind: 'TERM_SURVEY' as any },
        admin,
      );
      expect(items[0]).toMatchObject({
        respondents: 10,
        averageScale: null,
        optionDistribution: null,
      });
    });
  });

  describe('6. Validación de parámetros y auditoría', () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    it('rechaza kind inválido con 400 (antes 500)', async () => {
      await expect(
        pipe.transform(
          { kind: 'NOPE' },
          { type: 'query', metatype: SatisfactionQueryDto },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza UUIDs mal formados y descarta parámetros desconocidos', async () => {
      await expect(
        pipe.transform(
          { periodId: "1' OR 1=1" },
          { type: 'query', metatype: AttendanceQueryDto },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      const ok = await pipe.transform(
        { subjectId: '6f1c1e3e-2b7a-4a43-9d2c-1f2e3d4c5b6a', extra: 'x' },
        { type: 'query', metatype: AttendanceQueryDto },
      );
      expect(ok.extra).toBeUndefined();
    });

    it('registra cada consulta en la bitácora', async () => {
      await controller.getAttendance({ periodId: 'per-1' }, admin);
      await controller.getChatTopics(admin);
      expect(auditMock.log).toHaveBeenCalledTimes(2);
      expect(auditMock.log).toHaveBeenCalledWith({
        actorType: 'ADMIN',
        actorId: 'admin-1',
        action: 'METRICS_VIEWED',
        detail: {
          endpoint: 'attendance',
          filters: { periodId: 'per-1' },
          roles: ['INSTITUTION_ADMIN'],
          minGroupSize: 10,
        },
      });
    });
  });

  // ---- helpers ----
  function enr(
    studentId: string,
    status: EnrollmentStatus,
    grade: number | null,
    careerId = 'mac',
  ) {
    return {
      studentId,
      status,
      grade,
      attempt: 1,
      createdAt: new Date(2026, 0, 1),
      student: { careerId },
    };
  }
  function subject(enrollments: any[]) {
    return {
      id: 'sub',
      subject: 'Cálculo',
      semester: 1,
      credits: 10,
      category: { category: 'MATEMATICAS' },
      enrollments,
    };
  }
  function st(
    id: string,
    currentSemester: number,
    statuses: EnrollmentStatus[],
  ) {
    return {
      id,
      careerId: 'mac',
      currentSemester,
      career: { name: 'MAC' },
      enrollments: statuses.map((status) => ({ status })),
    };
  }
  function ans(
    studentId: string,
    responseId: string,
    createdAt: Date,
    optionId: string | null,
    numberValue: number | null,
  ) {
    return {
      optionId,
      numberValue,
      responseId,
      response: { studentId, createdAt },
    };
  }
});
