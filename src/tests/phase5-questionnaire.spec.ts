import { Test, TestingModule } from '@nestjs/testing';
import { QuestionnaireService } from '../questionnaire/questionnaire.service';
import { QuestionnaireController } from '../questionnaire/questionnaire.controller';
import { PrismaService } from '../prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  QuestionnaireKind,
  QuestionType,
  CategoriaPregunta,
  RoleType,
} from '@prisma/client';
import type { AuthUser } from '../autenticacion/interfaces/auth-user.interface';

describe('Auditoría y Pruebas Unitarias — Fase 5: Cuestionarios Normalizados (PumaIA)', () => {
  let prismaMock: any;
  let service: QuestionnaireService;
  let controller: QuestionnaireController;

  const mockStudentUser: AuthUser = {
    userId: 'user-stu-1',
    email: 'alumno@ciencias.unam.mx',
    name: 'Carlos Puma',
    roles: [RoleType.STUDENT],
    studentId: 'student-uuid-1',
    accountNumber: 318111222,
  };

  const mockAdminUser: AuthUser = {
    userId: 'user-admin-1',
    email: 'admin@fi.unam.mx',
    name: 'Admin Puma',
    roles: [RoleType.INSTITUTION_ADMIN],
    studentId: null,
    accountNumber: null,
  };

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn(async (cb) => cb(prismaMock)),
      questionnaire: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      question: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      questionOption: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      response: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      answer: {
        create: jest.fn(),
        deleteMany: jest.fn(),
        count: jest.fn(),
      },
      student: {
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuestionnaireController],
      providers: [
        QuestionnaireService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<QuestionnaireService>(QuestionnaireService);
    controller = module.get<QuestionnaireController>(QuestionnaireController);
  });

  describe('1. Envíos y Respuestas de Alumnos (Response y Answer)', () => {
    it('debe guardar respuestas de un alumno de forma atómica y marcar hasCompletedQuiz', async () => {
      prismaMock.questionnaire.findFirst.mockResolvedValue({
        id: 'q-onboarding',
        kind: QuestionnaireKind.ONBOARDING,
        version: 1,
        active: true,
      });

      prismaMock.response.findFirst.mockResolvedValue(null);
      prismaMock.response.create.mockResolvedValue({
        id: 'resp-1',
        studentId: mockStudentUser.studentId,
        questionnaireId: 'q-onboarding',
      });

      prismaMock.question.findUnique.mockResolvedValue({
        id: 'ques-1',
        questionnaireId: 'q-onboarding',
        code: 'p1_area',
      });

      prismaMock.questionOption.findFirst.mockResolvedValue({
        id: 'opt-software',
        questionId: 'ques-1',
        value: 'software',
      });

      prismaMock.answer.deleteMany.mockResolvedValue({ count: 0 });
      prismaMock.answer.create.mockResolvedValue({ id: 'ans-1' });
      prismaMock.student.update.mockResolvedValue({ id: mockStudentUser.studentId, hasCompletedQuiz: true });

      const res = await controller.save(mockStudentUser, {
        answers: [
          {
            id: 'p1_area',
            category: 'INTERESES',
            optionId: 'opt-software',
            value: 'software',
          },
        ],
      });

      expect(res.message).toBe('Cuestionario guardado exitosamente');
      expect(res.totalAnswers).toBe(1);
      expect(prismaMock.student.update).toHaveBeenCalledWith({
        where: { id: mockStudentUser.studentId },
        data: { hasCompletedQuiz: true },
      });
      expect(prismaMock.answer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          responseId: 'resp-1',
          questionId: 'ques-1',
          optionId: 'opt-software',
          textValue: 'software',
        }),
      });
    });

    it('debe rechazar un envío sin respuestas o con arreglo vacío', async () => {
      await expect(
        controller.save(mockStudentUser, { answers: [] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe rechazar guardado o consulta si el usuario no tiene perfil de estudiante', async () => {
      const userWithoutStudent: AuthUser = {
        userId: 'admin-1',
        email: 'admin@fi.unam.mx',
        name: 'Admin',
        roles: [RoleType.INSTITUTION_ADMIN],
        studentId: null,
        accountNumber: null,
      };

      await expect(
        controller.save(userWithoutStudent, { answers: [{ id: 'q1', value: 'test' }] }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.getMyAnswers(userWithoutStudent),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe recuperar las respuestas formateadas y deserializar JSON cuando corresponda', async () => {
      prismaMock.response.findFirst.mockResolvedValue({
        id: 'resp-1',
        answers: [
          {
            id: 'ans-1',
            optionId: 'opt-1',
            numberValue: null,
            textValue: 'Inteligencia Artificial',
            question: { code: 'p1_area', category: CategoriaPregunta.INTERESES },
            option: { value: 'ia', label: 'Inteligencia Artificial' },
          },
          {
            id: 'ans-2',
            optionId: null,
            numberValue: null,
            textValue: JSON.stringify(['Python', 'TypeScript']),
            question: { code: 'p2_techs', category: CategoriaPregunta.HABILIDADES },
            option: null,
          },
        ],
      });

      const answers = await controller.getMyAnswers(mockStudentUser);

      expect(answers).toHaveLength(2);
      expect(answers[0].questionId).toBe('p1_area');
      expect(answers[0].answer).toBe('ia');
      expect(answers[1].questionId).toBe('p2_techs');
      expect(answers[1].answer).toEqual(['Python', 'TypeScript']);
    });
  });

  describe('2. Gestión de Cuestionarios (Questionnaire)', () => {
    it('debe crear un nuevo cuestionario y evitar conflicto de versión y tipo', async () => {
      prismaMock.questionnaire.findUnique.mockResolvedValueOnce(null);
      prismaMock.questionnaire.create.mockResolvedValue({
        id: 'q-new',
        kind: QuestionnaireKind.CHECK_IN,
        version: 1,
        active: true,
      });

      const res = await controller.createQuestionnaire({
        kind: QuestionnaireKind.CHECK_IN,
        version: 1,
        active: true,
      });

      expect(res.kind).toBe(QuestionnaireKind.CHECK_IN);
      expect(res.version).toBe(1);

      // Si ya existe debe rechazar con ConflictException
      prismaMock.questionnaire.findUnique.mockResolvedValueOnce({ id: 'q-existing' });
      await expect(
        controller.createQuestionnaire({
          kind: QuestionnaireKind.CHECK_IN,
          version: 1,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('debe impedir eliminar un cuestionario que ya posee respuestas de alumnos', async () => {
      prismaMock.questionnaire.findUnique.mockResolvedValue({
        id: 'q-with-responses',
        _count: { responses: 5 },
      });

      await expect(
        controller.deleteQuestionnaire('q-with-responses'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('3. Gestión de Preguntas y Opciones (Question & QuestionOption)', () => {
    it('debe agregar una pregunta al cuestionario validando que no duplique código', async () => {
      prismaMock.questionnaire.findUnique.mockResolvedValue({ id: 'q-1', _count: { responses: 0 } });
      prismaMock.question.findUnique.mockResolvedValueOnce(null);
      prismaMock.question.create.mockResolvedValue({
        id: 'ques-new',
        questionnaireId: 'q-1',
        code: 'p_satisfaccion',
        position: 1,
        text: 'Nivel de satisfacción',
        type: QuestionType.SCALE,
      });

      const res = await controller.createQuestion('q-1', {
        code: 'p_satisfaccion',
        position: 1,
        text: 'Nivel de satisfacción',
        type: QuestionType.SCALE,
        required: true,
      });

      expect(res.code).toBe('p_satisfaccion');

      // Si ya existe la clave en el mismo cuestionario
      prismaMock.question.findUnique.mockResolvedValueOnce({ id: 'ques-existing' });
      await expect(
        controller.createQuestion('q-1', {
          code: 'p_satisfaccion',
          position: 1,
          text: 'Nivel de satisfacción',
          type: QuestionType.SCALE,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('debe impedir eliminar una pregunta o una opción si ya existen respuestas registradas', async () => {
      prismaMock.answer.count.mockResolvedValueOnce(3); // 3 respuestas vinculadas a la pregunta
      await expect(
        controller.deleteQuestion('ques-used'),
      ).rejects.toThrow(BadRequestException);

      prismaMock.answer.count.mockResolvedValueOnce(2); // 2 respuestas vinculadas a la opción
      await expect(
        controller.deleteOption('opt-used'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
