import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from '../metrics/metrics.service';
import { MetricsController } from '../metrics/metrics.controller';
import { PrismaService } from '../prisma/prisma.service';
import { EnrollmentStatus, AttendanceStatus, TopicGroup } from '@prisma/client';

describe('Auditoría y Pruebas Unitarias — Fase 7: Vistas y Métricas Agregadas (PumaIA)', () => {
  let prismaMock: any;
  let service: MetricsService;
  let controller: MetricsController;

  beforeEach(async () => {
    prismaMock = {
      subject: { findMany: jest.fn() },
      student: { findMany: jest.fn() },
      courseSection: { findMany: jest.fn() },
      topicCategory: { findMany: jest.fn() },
      question: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [
        MetricsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
    controller = module.get<MetricsController>(MetricsController);
  });

  describe('1. Rendimiento Académico y K-Anonimato', () => {
    it('debe aplicar k-anonimato y restringir datos si la muestra es menor a 10 alumnos', async () => {
      prismaMock.subject.findMany.mockResolvedValue([
        {
          id: 'sub-small',
          subject: 'Tópicos Avanzados',
          category: { category: 'COMPUTACION' },
          enrollments: [
            { id: 'e1', grade: 9, status: EnrollmentStatus.PASSED },
            { id: 'e2', grade: 8, status: EnrollmentStatus.PASSED },
            { id: 'e3', grade: 5, status: EnrollmentStatus.FAILED },
          ], // Solo 3 alumnos (< 10)
        },
      ]);

      const res = await controller.getAcademicPerformance();

      expect(res).toHaveLength(1);
      expect(res[0].totalStudents).toBe('<10');
      expect(res[0].averageGrade).toBe('RESTRINGIDO');
      expect(res[0].passRate).toBe('RESTRINGIDO');
      expect(res[0].kAnonymityProtected).toBe(true);
    });

    it('debe calcular estadísticas agregadas cuando la muestra es mayor o igual a 10 alumnos', async () => {
      const tenEnrollments = Array.from({ length: 10 }, (_, i) => ({
        id: `e-${i}`,
        grade: i >= 2 ? 8 : 5,
        status: i >= 2 ? EnrollmentStatus.PASSED : EnrollmentStatus.FAILED,
      }));

      prismaMock.subject.findMany.mockResolvedValue([
        {
          id: 'sub-large',
          subject: 'Cálculo Diferencial',
          category: { category: 'MATEMATICAS' },
          enrollments: tenEnrollments,
        },
      ]);

      const res = await controller.getAcademicPerformance();

      expect(res).toHaveLength(1);
      expect(res[0].totalStudents).toBe('10');
      expect(res[0].passRate).toBe('80%');
      expect(res[0].failRate).toBe('20%');
      expect(res[0].kAnonymityProtected).toBe(false);
    });
  });

  describe('2. Indicadores de Rezago y Riesgo', () => {
    it('debe agregar bajas y no presentados por cohorte respetando el umbral de 10 alumnos', async () => {
      // 12 estudiantes en cohorte
      const students = Array.from({ length: 12 }, (_, i) => ({
        id: `st-${i}`,
        careerId: 'car-1',
        currentSemester: 2,
        career: { name: 'Ingeniería en Computación' },
        enrollments: [
          { status: i === 0 ? EnrollmentStatus.NOT_PRESENTED : EnrollmentStatus.PASSED },
          { status: i === 1 ? EnrollmentStatus.WITHDRAWN : EnrollmentStatus.PASSED },
        ],
      }));

      prismaMock.student.findMany.mockResolvedValue(students);

      const res = await controller.getRetentionAndRisk();

      expect(res).toHaveLength(1);
      expect(res[0].totalStudents).toBe('12');
      expect(res[0].notPresentedCount).toBe(1);
      expect(res[0].withdrawnCount).toBe(1);
      expect(res[0].kAnonymityProtected).toBe(false);
    });
  });

  describe('3. Asistencia Agregada sin Rankings de Profesores', () => {
    it('debe reportar porcentajes de asistencia por grupo sin exponer datos del profesor', async () => {
      // 10 estudiantes únicos con registros
      const records = Array.from({ length: 10 }, (_, i) => ({
        studentId: `stu-${i}`,
        status: i < 8 ? AttendanceStatus.PRESENT : AttendanceStatus.ABSENT,
      }));

      prismaMock.courseSection.findMany.mockResolvedValue([
        {
          id: 'sec-1',
          groupCode: '1101',
          subject: { subject: 'Álgebra' },
          period: { code: '2025-1' },
          sessions: [{ records }],
        },
      ]);

      const res = await controller.getAttendance();

      expect(res).toHaveLength(1);
      expect(res[0].attendeesCount).toBe('10');
      expect(res[0].presentPercentage).toBe('80%');
      expect(res[0].absencePercentage).toBe('20%');
      // Asegurarse de que no existe ninguna propiedad que rankee al profesor
      expect((res[0] as any).professorRanking).toBeUndefined();
    });
  });

  describe('4. Temas de Chat y Cuestionarios', () => {
    it('debe devolver tendencias de temas consultados respetando k-anonimato (>= 10 alumnos únicos) y sin exponer contenido de mensajes', async () => {
      const tenLabelsFromDistinctStudents = Array.from({ length: 10 }, (_, idx) => ({
        id: `lbl-${idx}`,
        confidence: idx % 2 === 0 ? 0.95 : 0.85,
        conversation: {
          id: `conv-${idx}`,
          studentId: `stu-${idx}`,
          sensitive: false,
        },
      }));

      prismaMock.topicCategory.findMany.mockResolvedValue([
        {
          code: 'CAREER_ORIENTATION',
          label: 'Orientación de Carrera',
          topicGroup: TopicGroup.ACADEMICO,
          labels: tenLabelsFromDistinctStudents,
        },
      ]);

      const res = await controller.getChatTopics();

      expect(res).toHaveLength(1);
      expect(res[0].topicCode).toBe('CAREER_ORIENTATION');
      expect(res[0].totalStudents).toBe('10');
      expect(res[0].totalQueries).toBe(10);
      expect(res[0].averageConfidence).toBe(0.9);
      expect((res[0] as any).messages).toBeUndefined();
      expect((res[0] as any).transcripts).toBeUndefined();
    });

    it('debe agregar resultados numéricos de cuestionarios ignorando texto libre', async () => {
      const answers = Array.from({ length: 10 }, (_, i) => ({
        optionId: 'opt-1',
        numberValue: 5,
      }));

      prismaMock.question.findMany.mockResolvedValue([
        {
          code: 'SATISFACTION_Q1',
          text: 'Satisfacción con los recursos de estudio',
          category: 'EXPECTATIVAS',
          options: [{ id: 'opt-1', label: 'Muy Satisfecho' }],
          answers,
        },
      ]);

      const res = await controller.getSatisfaction();

      expect(res).toHaveLength(1);
      expect(res[0].questionCode).toBe('SATISFACTION_Q1');
      expect(res[0].sampleCount).toBe('10');
      expect(res[0].averageScale).toBe('5.00');
      expect(res[0].optionDistribution?.[0]?.count).toBe(10);
    });
  });
});
