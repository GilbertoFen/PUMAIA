import { Test, TestingModule } from '@nestjs/testing';
import { StudentsService } from '../students/students.service';
import { StudentsController } from '../students/students.controller';
import { GradeService } from '../grades/grade.service';
import { QuestionnaireService } from '../questionnaire/questionnaire.service';
import { AIResultService } from '../ai-result/ai-result.service';
import { AIResultController } from '../ai-result/ai-result.controller';
import { StudyPlanService } from '../studyPlan/studyPlan.service';
import { CareerService } from '../career/career.service';
import { PrismaService } from '../prisma/prisma.service';
import { AICategoryService } from '../ai-category/ai-category.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import {
  Prisma,
  StudyLevel,
  StudySystem,
  EnrollmentStatus,
  EnrollmentSource,
  RoleType,
} from '@prisma/client';
import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';

describe('Auditoría y Pruebas Unitarias/Integración — Fase 2 PumaIA', () => {
  let prismaMock: any;
  let studentsService: StudentsService;
  let studentsController: StudentsController;
  let gradeService: GradeService;
  let questionnaireService: QuestionnaireService;
  let aiResultService: AIResultService;
  let aiResultController: AIResultController;
  let studyPlanService: StudyPlanService;
  let careerService: CareerService;
  let cloudinaryServiceMock: any;

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn(async (cb) => cb(prismaMock)),
      student: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      enrollment: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        createMany: jest.fn(),
      },
      institution: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      career: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      studyPlan: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      questionnaire: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      question: {
        findUnique: jest.fn(),
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      questionOption: {
        findFirst: jest.fn(),
      },
      response: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      answer: {
        deleteMany: jest.fn(),
        create: jest.fn(),
      },
      aIResult: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      aIResultOption: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      aICategory: {
        create: jest.fn(),
      },
    };

    const aiCategoryServiceMock = {
      findAll: jest.fn().mockResolvedValue([{ id: 'cat-ia-1', name: 'Rutas' }]),
    };

    cloudinaryServiceMock = {
      uploadImage: jest.fn().mockResolvedValue({ secure_url: 'https://storage.supabase.com/avatars/new.png' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StudentsController, AIResultController],
      providers: [
        StudentsService,
        GradeService,
        QuestionnaireService,
        AIResultService,
        StudyPlanService,
        CareerService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AICategoryService, useValue: aiCategoryServiceMock },
        { provide: CloudinaryService, useValue: cloudinaryServiceMock },
      ],
    }).compile();

    studentsService = module.get<StudentsService>(StudentsService);
    studentsController = module.get<StudentsController>(StudentsController);
    gradeService = module.get<GradeService>(GradeService);
    questionnaireService = module.get<QuestionnaireService>(QuestionnaireService);
    aiResultService = module.get<AIResultService>(AIResultService);
    aiResultController = module.get<AIResultController>(AIResultController);
    studyPlanService = module.get<StudyPlanService>(StudyPlanService);
    careerService = module.get<CareerService>(CareerService);
  });

  describe('1. StudentsModule y Autorización Cruzada', () => {
    it('debe obtener el expediente integral combinando User, Student, Enrollments y Cuestionario', async () => {
      prismaMock.student.findUnique.mockResolvedValue({
        id: 'student-123',
        accountNumber: 318123456,
        isGraduated: false,
        interest: 'Inteligencia Artificial',
        currentSemester: 6,
        average: new Prisma.Decimal('9.25'),
        hasCompletedQuiz: true,
        user: {
          id: 'user-123',
          name: 'JUAN',
          lastNameP: 'PEREZ',
          lastNameM: 'LOPEZ',
          email: '318123456@pcpuma.acatlan.unam.mx',
          avatarUrl: 'https://cdn.unam.mx/avatar.jpg',
        },
        career: {
          id: 'career-1',
          name: 'Matemáticas Aplicadas y Computación',
        },
        enrollments: [
          {
            id: 'enr-1',
            grade: 9,
            attempt: 1,
            status: EnrollmentStatus.PASSED,
            source: EnrollmentSource.TRANSCRIPT,
            subject: { id: 'sub-1', subject: 'Cálculo I', code: 1101, semester: 1, credits: 10 },
          },
          {
            id: 'enr-2',
            grade: 10,
            attempt: 1,
            status: EnrollmentStatus.PASSED,
            source: EnrollmentSource.TRANSCRIPT,
            subject: { id: 'sub-2', subject: 'Estructuras de Datos', code: 1201, semester: 2, credits: 8 },
          },
        ],
        responses: [
          {
            id: 'resp-1',
            answers: [
              {
                id: 'ans-1',
                question: { code: 'tiempo_traslado', category: 'EXPECTATIVAS' },
                textValue: '1 a 2 horas',
                numberValue: null,
                option: null,
              },
            ],
          },
        ],
      });

      const summary = await studentsService.getFullProfileSummary('student-123');

      expect(summary).toBeDefined();
      expect(summary!.accountNumber).toBe(318123456);
      expect(summary!.accountNumberFormatted).toBe('318123456');
      expect(summary!.name).toBe('JUAN');
      expect(summary!.email).toBe('318123456@pcpuma.acatlan.unam.mx');
      expect(summary!.career).toBe('Matemáticas Aplicadas y Computación');
      expect(summary!.grades).toHaveLength(2);
      expect(summary!.grades[0].subject.subject).toBe('Cálculo I');
      expect(summary!.grades[0].grade).toBe(9);
      expect(summary!.answers).toHaveLength(1);
      expect(summary!.answers[0].questionId).toBe('tiempo_traslado');
      expect(summary!.answers[0].answer).toBe('1 a 2 horas');
    });

    it('uploadAvatar debe actualizar User.avatarUrl y no el registro de Student', async () => {
      prismaMock.student.findUnique.mockResolvedValue({
        id: 'student-123',
        userId: 'user-123',
      });
      prismaMock.user.update.mockResolvedValue({
        id: 'user-123',
        avatarUrl: 'https://storage.supabase.com/avatars/new.png',
      });

      const fakeFile = { originalname: 'avatar.png', buffer: Buffer.from('test') } as any;
      const result = await studentsService.uploadAvatar('student-123', fakeFile);

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { avatarUrl: 'https://storage.supabase.com/avatars/new.png' },
      });
      expect(result.avatarUrl).toBe('https://storage.supabase.com/avatars/new.png');
    });

    it('aislamiento: un estudiante NO puede consultar la cuenta de otro estudiante (ForbiddenException)', async () => {
      const studentA: any = {
        userId: 'user-a',
        studentId: 'student-a',
        accountNumber: 318111111,
        roles: [RoleType.STUDENT],
      };

      await expect(
        studentsController.findOne('318222222', studentA),
      ).rejects.toThrow(ForbiddenException);
    });

    it('aislamiento: un estudiante SÍ puede consultar su propia cuenta', async () => {
      const studentA: any = {
        userId: 'user-a',
        studentId: 'student-a',
        accountNumber: 318111111,
        roles: [RoleType.STUDENT],
      };

      prismaMock.student.findUnique.mockResolvedValue({
        id: 'student-a',
        accountNumber: 318111111,
        currentSemester: 4,
        average: new Prisma.Decimal('8.50'),
        interest: 'Redes',
        user: { name: 'ANA', lastNameP: 'RUIZ', lastNameM: '' },
        career: { name: 'MAC' },
      });

      const result = await studentsController.findOne('318111111', studentA);
      expect(result.accountNumber).toBe(318111111);
      expect(result.fullName).toBe('ANA RUIZ');
    });

    it('aislamiento: un administrador institucional SÍ puede consultar la cuenta de cualquier estudiante', async () => {
      const admin: any = {
        userId: 'admin-1',
        roles: [RoleType.INSTITUTION_ADMIN],
      };

      prismaMock.student.findUnique.mockResolvedValue({
        id: 'student-b',
        accountNumber: 318222222,
        currentSemester: 2,
        average: new Prisma.Decimal('9.00'),
        interest: 'Data Science',
        user: { name: 'CARLOS', lastNameP: 'GARCIA', lastNameM: '' },
        career: { name: 'MAC' },
      });

      const result = await studentsController.findOne('318222222', admin);
      expect(result.accountNumber).toBe(318222222);
      expect(result.fullName).toBe('CARLOS GARCIA');
    });
  });

  describe('2. GradeService — Enrollment, Recálculo Atómico de Promedio y Manejo de Materias sin Calificación', () => {
    it('saveConfirmedGrades debe upsertar en Enrollment y recalcular promedio de forma atómica', async () => {
      prismaMock.enrollment.findFirst.mockResolvedValue(null);
      prismaMock.enrollment.create.mockResolvedValue({});
      prismaMock.enrollment.findMany.mockResolvedValue([
        { grade: 8 },
        { grade: 10 },
      ]);
      prismaMock.student.update.mockResolvedValue({});

      const confirmedGrades = {
        subjects: [
          { subjectID: 'sub-1', grade: 8, status: EnrollmentStatus.PASSED, attempt: 1 },
          { subjectID: 'sub-2', grade: 10, status: EnrollmentStatus.PASSED, attempt: 1 },
        ],
      };

      const res = await gradeService.saveConfirmedGrades('student-123', confirmedGrades as any);

      expect(res.registeredCount).toBe(2);
      expect(res.message).toContain('registrado');
      // Promedio debe ser (8 + 10) / 2 = 9.00
      expect(prismaMock.student.update).toHaveBeenCalledWith({
        where: { id: 'student-123' },
        data: { average: 9 },
      });
    });

    it('updateGrade debe actualizar calificación y recalcular atómicamente el promedio del alumno', async () => {
      prismaMock.enrollment.findUnique.mockResolvedValue({
        id: 'enr-1',
        studentId: 'student-123',
        grade: 6,
      });
      prismaMock.enrollment.update.mockResolvedValue({
        id: 'enr-1',
        studentId: 'student-123',
        grade: 10,
      });
      prismaMock.enrollment.findMany.mockResolvedValue([
        { grade: 10 },
        { grade: 8 },
      ]);

      await gradeService.updateGrade('enr-1', { grade: 10 });

      expect(prismaMock.enrollment.update).toHaveBeenCalled();
      // Promedio recalculado: (10 + 8) / 2 = 9.00
      expect(prismaMock.student.update).toHaveBeenCalledWith({
        where: { id: 'student-123' },
        data: { average: 9 },
      });
    });

    it('deleteGrade debe eliminar la inscripción y recalcular atómicamente el promedio del alumno', async () => {
      prismaMock.enrollment.findUnique.mockResolvedValue({
        id: 'enr-to-delete',
        studentId: 'student-123',
        grade: 5,
      });
      prismaMock.enrollment.delete.mockResolvedValue({});
      // Solo queda una materia con 10
      prismaMock.enrollment.findMany.mockResolvedValue([
        { grade: 10 },
      ]);

      await gradeService.deleteGrade('enr-to-delete');

      expect(prismaMock.enrollment.delete).toHaveBeenCalledWith({ where: { id: 'enr-to-delete' } });
      // Promedio recalculado = 10.00
      expect(prismaMock.student.update).toHaveBeenCalledWith({
        where: { id: 'student-123' },
        data: { average: 10 },
      });
    });

    it('las materias sin calificación (grade: null o en curso) se excluyen del divisor y dividendo en el promedio', async () => {
      prismaMock.enrollment.findUnique.mockResolvedValue({
        id: 'enr-1',
        studentId: 'student-123',
      });
      prismaMock.enrollment.update.mockResolvedValue({});
      // Simulamos que el query filtra grade: { not: null } en la BD
      prismaMock.enrollment.findMany.mockResolvedValue([
        { grade: 9 },
        { grade: 7 },
      ]);

      await gradeService.updateGrade('enr-1', { status: EnrollmentStatus.IN_PROGRESS });

      expect(prismaMock.enrollment.findMany).toHaveBeenCalledWith({
        where: { studentId: 'student-123', grade: { not: null } },
      });
      // (9 + 7) / 2 = 8.00
      expect(prismaMock.student.update).toHaveBeenCalledWith({
        where: { id: 'student-123' },
        data: { average: 8 },
      });
    });

    it('getMyGrades debe entregar el formato exacto requerido por el frontend', async () => {
      prismaMock.enrollment.findMany.mockResolvedValue([
        {
          id: 'enr-1',
          grade: 10,
          attempt: 1,
          status: EnrollmentStatus.PASSED,
          source: EnrollmentSource.TRANSCRIPT,
          subjectId: 'sub-1',
          subject: {
            id: 'sub-1',
            subject: 'Álgebra Lineal',
            code: 1102,
            semester: 1,
            credits: 8,
          },
          period: {
            code: '2025-1',
          },
        },
      ]);

      const grades = await gradeService.getMyGrades('student-123');

      expect(grades).toHaveLength(1);
      expect(grades[0].subjectId).toBe('sub-1');
      expect(grades[0].subjectID).toBe('sub-1');
      expect(grades[0].subjectName).toBe('Álgebra Lineal');
      expect(grades[0].grade).toBe(10);
      expect(grades[0].period).toBe('2025-1');
    });
  });

  describe('3. QuestionnaireService — Normalización, Validación de Opciones y Almacenamiento Limpio', () => {
    it('saveAll rechaza envíos vacíos o sin respuestas (BadRequestException)', async () => {
      await expect(
        questionnaireService.saveAll('student-123', { answers: [] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('saveAll rechaza una opción si pertenece a una pregunta distinta (BadRequestException)', async () => {
      prismaMock.questionnaire.findFirst.mockResolvedValue({ id: 'quest-1' });
      prismaMock.response.findFirst.mockResolvedValue(null);
      prismaMock.response.create.mockResolvedValue({ id: 'resp-1' });
      prismaMock.question.findUnique.mockResolvedValue({ id: 'q-tiempo' });
      // La opción pertenece a otra pregunta -> findFirst retorna null
      prismaMock.questionOption.findFirst.mockResolvedValue(null);

      const dto = {
        answers: [
          {
            id: 'tiempo_traslado',
            optionId: 'opcion-de-otra-pregunta',
            value: '2 horas',
          },
        ],
      };

      await expect(
        questionnaireService.saveAll('student-123', dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('almacenamiento limpio: números en numberValue, strings en textValue, objetos en JSON serializado', async () => {
      prismaMock.questionnaire.findFirst.mockResolvedValue({ id: 'quest-1' });
      prismaMock.response.findFirst.mockResolvedValue({ id: 'resp-1' });
      prismaMock.question.findUnique.mockResolvedValue({ id: 'q-test' });
      prismaMock.questionOption.findFirst.mockResolvedValue(null);
      prismaMock.answer.deleteMany.mockResolvedValue({});
      prismaMock.answer.create.mockResolvedValue({});
      prismaMock.student.update.mockResolvedValue({});

      const dto = {
        answers: [
          { id: 'semestre_cursado', value: 5 },
          { id: 'comentario', value: 'Excelente servicio' },
          { id: 'proyectos', value: { list: ['A', 'B'] } },
        ],
      };

      await questionnaireService.saveAll('student-123', dto);

      expect(prismaMock.answer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          numberValue: 5,
          textValue: null,
        }),
      });

      expect(prismaMock.answer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          numberValue: null,
          textValue: 'Excelente servicio',
        }),
      });

      expect(prismaMock.answer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          numberValue: null,
          textValue: JSON.stringify({ list: ['A', 'B'] }),
        }),
      });
    });

    it('getAnswers deserializa respuestas JSON y reconstruye formato consumible por el frontend', async () => {
      prismaMock.response.findFirst.mockResolvedValue({
        id: 'resp-1',
        answers: [
          {
            id: 'ans-1',
            question: { code: 'tiempo_traslado', category: 'EXPECTATIVAS' },
            textValue: '1 hora',
            numberValue: null,
            option: null,
          },
          {
            id: 'ans-2',
            question: { code: 'proyectos_interes', category: 'INTERESES' },
            textValue: JSON.stringify({ _list: ['Web', 'Data'], exp: 'básica' }),
            numberValue: null,
            option: null,
          },
        ],
      });

      const answers = await questionnaireService.getAnswers('student-123');

      expect(answers).toHaveLength(2);
      expect(answers[0].questionId).toBe('tiempo_traslado');
      expect(answers[0].answer).toBe('1 hora');
      expect(answers[1].questionId).toBe('proyectos_interes');
      expect(answers[1].answer).toEqual({ _list: ['Web', 'Data'], exp: 'básica' });
    });
  });

  describe('4. AIResult y AIResultOption — Conteo de Opciones y Adaptador de Frontend', () => {
    it('cuando la IA devuelve exactamente 3 opciones (< 5), persiste solo 3 registros sin inventar opciones falsas', async () => {
      // Mock de fetch para FastAPI devolviendo solo 3 opciones
      const mockFetchResponse = {
        ok: true,
        json: async () => ({
          optionA: 'Desarrollador Backend',
          descriptionA: 'Match: 90%',
          meta_summary: 'Buen perfil',
          meta_strengths: 'Node.js',
          meta_opportunities: 'Cloud',
          optionB: 'Ingeniero de Datos',
          descriptionB: 'Match: 85%',
          optionC: 'Administrador de BD',
          descriptionC: 'Match: 80%',
          // optionD y optionE omitidas o no devueltas
        }),
      };
      global.fetch = jest.fn().mockResolvedValue(mockFetchResponse);

      jest.spyOn(studentsService, 'getFullProfileSummary').mockResolvedValue({
        id: 'student-123',
        name: 'LUIS',
        lastNameP: 'GIL',
        currentSemester: 8,
        average: 9.2,
      } as any);

      prismaMock.aIResult.findFirst.mockResolvedValue(null);
      prismaMock.aIResult.create.mockResolvedValue({ id: 'ai-res-1' });

      await aiResultService.processAndSaveAnalysis('student-123');

      expect(prismaMock.aIResultOption.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ position: 1, title: 'Desarrollador Backend' }),
          expect.objectContaining({ position: 2, title: 'Ingeniero de Datos' }),
          expect.objectContaining({ position: 3, title: 'Administrador de BD' }),
        ]),
      });

      // Validar que se crearon exactamente 3 opciones y NO 5 inventadas
      const createdOptions = prismaMock.aIResultOption.createMany.mock.calls[0][0].data;
      expect(createdOptions).toHaveLength(3);
    });

    it('cuando la IA devuelve más de 5 opciones (ej: 7), conserva exclusivamente las 5 principales', async () => {
      const mockFetchResponse = {
        ok: true,
        json: async () => ({
          options: [
            { title: 'Opción 1', description: 'Desc 1' },
            { title: 'Opción 2', description: 'Desc 2' },
            { title: 'Opción 3', description: 'Desc 3' },
            { title: 'Opción 4', description: 'Desc 4' },
            { title: 'Opción 5', description: 'Desc 5' },
            { title: 'Opción 6', description: 'Desc 6' },
            { title: 'Opción 7', description: 'Desc 7' },
          ],
        }),
      };
      global.fetch = jest.fn().mockResolvedValue(mockFetchResponse);

      jest.spyOn(studentsService, 'getFullProfileSummary').mockResolvedValue({
        id: 'student-123',
        name: 'LUIS',
      } as any);

      prismaMock.aIResult.findFirst.mockResolvedValue(null);
      prismaMock.aIResult.create.mockResolvedValue({ id: 'ai-res-2' });

      await aiResultService.processAndSaveAnalysis('student-123');

      const createdOptions = prismaMock.aIResultOption.createMany.mock.calls[0][0].data;
      expect(createdOptions).toHaveLength(5);
      expect(createdOptions[4].position).toBe(5);
      expect(createdOptions[4].title).toBe('Opción 5');
    });

    it('cuando la IA no devuelve opciones válidas, arroja BadRequestException', async () => {
      const mockFetchResponse = {
        ok: true,
        json: async () => ({
          options: [],
        }),
      };
      global.fetch = jest.fn().mockResolvedValue(mockFetchResponse);

      jest.spyOn(studentsService, 'getFullProfileSummary').mockResolvedValue({
        id: 'student-123',
        name: 'LUIS',
      } as any);

      await expect(
        aiResultService.processAndSaveAnalysis('student-123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('el adaptador getCurrentAnalysis reconstruye options[] y los campos retrocompatibles optionA..E', async () => {
      const mockResult = {
        id: 'ai-result-1',
        studentId: 'student-123',
        categoryId: 'cat-1',
        createdAt: new Date('2026-10-15T12:00:00Z'),
        options: [
          {
            id: 'opt-1',
            position: 1,
            title: 'Desarrollador Full Stack',
            description: 'Match: 95%||Excelente perfil analítico||Buen promedio en desarrollo||Tomar cursos cloud',
          },
          {
            id: 'opt-2',
            position: 2,
            title: 'Científico de Datos',
            description: 'Match: 88% - Recomendable reforzar estadística',
          },
        ],
      };

      prismaMock.aIResult.findMany.mockResolvedValue([mockResult]);

      const authUser: any = {
        userId: 'user-123',
        studentId: 'student-123',
        email: '318123456@pcpuma.acatlan.unam.mx',
      };

      const res = await aiResultController.getCurrentAnalysis(authUser);

      expect(res.hasAnalysis).toBe(true);
      expect(res.data!.optionA).toBe('Desarrollador Full Stack');
      expect(res.data!.descriptionA).toBe('Match: 95%');
      expect(res.data!.meta_summary).toBe('Excelente perfil analítico');
      expect(res.data!.meta_strengths).toBe('Buen promedio en desarrollo');
      expect(res.data!.meta_opportunities).toBe('Tomar cursos cloud');
      expect(res.data!.optionB).toBe('Científico de Datos');
      // Las opciones no existentes retornan cadenas vacías para no romper el frontend
      expect(res.data!.optionC).toBe('');
      expect(res.data!.optionD).toBe('');
      expect(res.data!.optionE).toBe('');
      // Arreglo estructurado contiene exactamente las 2 opciones existentes
      expect(res.data!.options).toHaveLength(2);
      expect(res.data!.options[0].position).toBe(1);
    });
  });

  describe('5. StudyPlanService — Enums StudyLevel y StudySystem', () => {
    it('debe crear un plan de estudios asignando por defecto LICENCIATURA y ESCOLARIZADO si se omiten', async () => {
      prismaMock.studyPlan.create.mockResolvedValue({
        id: 'plan-1',
        studyPlan: 'Plan 2024 MAC',
        semesters: 8,
        level: StudyLevel.LICENCIATURA,
        system: StudySystem.ESCOLARIZADO,
      });

      const res = await studyPlanService.createStudyPlan({
        studyPlan: 'Plan 2024 MAC',
        semesters: 8,
      });

      expect(prismaMock.studyPlan.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          studyPlan: 'Plan 2024 MAC',
          semesters: 8,
          level: StudyLevel.LICENCIATURA,
          system: StudySystem.ESCOLARIZADO,
        }),
      });
      expect(res.level).toBe(StudyLevel.LICENCIATURA);
    });
  });

  describe('6. CareerService — Asociación de Institución y Código Único', () => {
    it('debe rechazar la creación si el código ya existe en la misma institución', async () => {
      prismaMock.institution.findUnique.mockResolvedValue({ id: 'inst-acatlan' });
      prismaMock.career.findUnique.mockResolvedValue({ id: 'career-existente', code: 'MAC' });

      await expect(
        careerService.createCareer({
          name: 'Matemáticas Aplicadas',
          code: 'MAC',
          institutionId: 'inst-acatlan',
          studyPlanId: 'plan-1',
          knowledgeAreaId: 'area-1',
          isMasters: false,
        }),
      ).rejects.toThrow('Ya existe una carrera con la clave MAC');
    });
  });
});
