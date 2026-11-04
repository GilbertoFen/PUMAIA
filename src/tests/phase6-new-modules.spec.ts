import { Test, TestingModule } from '@nestjs/testing';
import { SectionsService } from '../sections/sections.service';
import { SectionsController } from '../sections/sections.controller';
import { AttendanceService } from '../attendance/attendance.service';
import { AttendanceController } from '../attendance/attendance.controller';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsController } from '../notifications/notifications.controller';
import { KnowledgeDocumentsService } from '../knowledge-documents/knowledge-documents.service';
import { KnowledgeDocumentsController } from '../knowledge-documents/knowledge-documents.controller';
import { ChatService } from '../chat/chat.service';
import { ChatController } from '../chat/chat.controller';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ConsentsService } from '../consents/consents.service';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import {
  RoleType,
  SessionStatus,
  AttendanceStatus,
  AttendanceMethod,
  DocumentStatus,
  LabelSource,
} from '@prisma/client';
import type { AuthUser } from '../autenticacion/interfaces/auth-user.interface';

describe('Auditoría y Pruebas Unitarias — Fase 6: Módulos Nuevos y Gestión Académica (PumaIA)', () => {
  let prismaMock: any;
  let auditServiceMock: any;
  let sectionsService: SectionsService;
  let sectionsController: SectionsController;
  let attendanceService: AttendanceService;
  let attendanceController: AttendanceController;
  let notificationsService: NotificationsService;
  let notificationsController: NotificationsController;
  let knowledgeService: KnowledgeDocumentsService;
  let knowledgeController: KnowledgeDocumentsController;
  let chatService: ChatService;
  let chatController: ChatController;

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
      subject: { findUnique: jest.fn() },
      academicPeriod: { findUnique: jest.fn() },
      courseSection: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      sectionMeeting: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      sectionRoster: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      enrollment: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      classSession: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      attendanceRecord: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      notificationPreference: {
        upsert: jest.fn(),
      },
      institution: { findUnique: jest.fn() },
      knowledgeDocument: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      student: { findUnique: jest.fn() },
      conversation: { findUnique: jest.fn() },
      topicCategory: { findUnique: jest.fn() },
      conversationLabel: {
        upsert: jest.fn(),
        findMany: jest.fn(),
      },
    };

    auditServiceMock = {
      log: jest.fn().mockResolvedValue({}),
    };

    const consentsServiceMock = {
      hasValidConsent: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [
        SectionsController,
        AttendanceController,
        NotificationsController,
        KnowledgeDocumentsController,
        ChatController,
      ],
      providers: [
        SectionsService,
        AttendanceService,
        NotificationsService,
        KnowledgeDocumentsService,
        ChatService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditServiceMock },
        { provide: ConsentsService, useValue: consentsServiceMock },
      ],
    }).compile();

    sectionsService = module.get<SectionsService>(SectionsService);
    sectionsController = module.get<SectionsController>(SectionsController);
    attendanceService = module.get<AttendanceService>(AttendanceService);
    attendanceController = module.get<AttendanceController>(AttendanceController);
    notificationsService = module.get<NotificationsService>(NotificationsService);
    notificationsController = module.get<NotificationsController>(NotificationsController);
    knowledgeService = module.get<KnowledgeDocumentsService>(KnowledgeDocumentsService);
    knowledgeController = module.get<KnowledgeDocumentsController>(KnowledgeDocumentsController);
    chatService = module.get<ChatService>(ChatService);
    chatController = module.get<ChatController>(ChatController);
  });

  describe('1. Grupos Académicos y Listas (SectionsModule)', () => {
    it('debe crear un grupo con código único de ingreso (joinCode)', async () => {
      prismaMock.subject.findUnique.mockResolvedValue({ id: 'sub-1', name: 'Estructuras de Datos' });
      prismaMock.academicPeriod.findUnique.mockResolvedValue({ id: 'per-1', code: '2025-1' });
      prismaMock.courseSection.findUnique.mockResolvedValue(null);
      prismaMock.courseSection.create.mockResolvedValue({
        id: 'sec-1',
        subjectId: 'sub-1',
        periodId: 'per-1',
        groupCode: '1301',
        joinCode: 'ABC12345',
      });

      const res = await sectionsController.createSection({
        subjectId: 'sub-1',
        periodId: 'per-1',
        groupCode: '1301',
      });

      expect(res.groupCode).toBe('1301');
      expect(res.joinCode).toBe('ABC12345');
    });

    it('debe impedir crear grupo duplicado para la misma materia y periodo', async () => {
      prismaMock.subject.findUnique.mockResolvedValue({ id: 'sub-1' });
      prismaMock.academicPeriod.findUnique.mockResolvedValue({ id: 'per-1' });
      prismaMock.courseSection.findUnique.mockResolvedValue({ id: 'sec-existing' });

      await expect(
        sectionsController.createSection({
          subjectId: 'sub-1',
          periodId: 'per-1',
          groupCode: '1301',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('debe validar horario de reunión rechazando si inicio >= fin', async () => {
      prismaMock.courseSection.findUnique.mockResolvedValue({ id: 'sec-1' });

      await expect(
        sectionsController.addMeeting('sec-1', {
          weekday: 1,
          startTime: '10:00',
          endTime: '08:00',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe permitir a un alumno unirse con joinCode y vincular Enrollment', async () => {
      prismaMock.courseSection.findUnique.mockResolvedValue({
        id: 'sec-1',
        groupCode: '1301',
        subjectId: 'sub-1',
        periodId: 'per-1',
        subject: { subject: 'Redes' },
        period: { code: '2025-1' },
        roster: [],
        capacity: 40,
      });

      prismaMock.student.findUnique.mockResolvedValue({
        id: mockStudentUser.studentId,
        accountNumber: 318111222,
        user: { name: 'Carlos', lastNameP: 'Puma' },
      });

      prismaMock.sectionRoster.findUnique.mockResolvedValue(null);
      prismaMock.sectionRoster.create.mockResolvedValue({ id: 'rost-1' });
      prismaMock.enrollment.findFirst.mockResolvedValue(null);
      prismaMock.enrollment.create.mockResolvedValue({ id: 'enr-1' });

      const res = await sectionsController.joinWithCode(mockStudentUser, { joinCode: 'ABC12345' });

      expect(res.message).toBe('Te has unido exitosamente al grupo.');
      expect(res.section.groupCode).toBe('1301');
    });
  });

  describe('2. Sesiones y Asistencia (AttendanceModule)', () => {
    it('debe abrir una sesión de clase con secreto generado para QR', async () => {
      prismaMock.courseSection.findUnique.mockResolvedValue({ id: 'sec-1' });
      prismaMock.classSession.findFirst.mockResolvedValue(null);
      prismaMock.classSession.create.mockResolvedValue({
        id: 'sess-1',
        sectionId: 'sec-1',
        status: SessionStatus.OPEN,
        secret: 'SEC12345',
      });

      const res = await attendanceController.openSession(mockAdminUser, { sectionId: 'sec-1' });

      expect(res.status).toBe(SessionStatus.OPEN);
      expect(res.secret).toBe('SEC12345');
    });

    it('debe registrar asistencia si el token QR dinámico vigente coincide y el alumno está inscrito', async () => {
      prismaMock.classSession.findUnique.mockResolvedValue({
        id: 'sess-1',
        sectionId: 'sec-1',
        status: SessionStatus.OPEN,
        secret: 'VALID_SECRET',
      });

      prismaMock.enrollment.findFirst.mockResolvedValue({ id: 'enr-1' });
      prismaMock.attendanceRecord.findUnique.mockResolvedValue(null);
      prismaMock.attendanceRecord.create.mockResolvedValue({
        id: 'rec-1',
        status: AttendanceStatus.PRESENT,
        method: AttendanceMethod.QR,
      });

      const dynamicQr = attendanceService.generateDynamicQrToken('VALID_SECRET');

      const res = await attendanceController.markAttendance(mockStudentUser, {
        sessionId: 'sess-1',
        secret: dynamicQr.qrToken,
      });

      expect(res.status).toBe(AttendanceStatus.PRESENT);
      expect(res.method).toBe(AttendanceMethod.QR);
    });

    it('debe rechazar asistencia si el secreto es incorrecto o la sesión está cerrada', async () => {
      prismaMock.classSession.findUnique.mockResolvedValueOnce({
        id: 'sess-1',
        sectionId: 'sec-1',
        status: SessionStatus.CLOSED,
        secret: 'VALID_SECRET',
      });

      await expect(
        attendanceController.markAttendance(mockStudentUser, { sessionId: 'sess-1', secret: 'VALID_SECRET' }),
      ).rejects.toThrow(BadRequestException);

      prismaMock.classSession.findUnique.mockResolvedValueOnce({
        id: 'sess-1',
        sectionId: 'sec-1',
        status: SessionStatus.OPEN,
        secret: 'VALID_SECRET',
      });

      await expect(
        attendanceController.markAttendance(mockStudentUser, { sessionId: 'sess-1', secret: 'WRONG_SECRET' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('debe cerrar la sesión y registrar faltas automáticas para alumnos no asistentes', async () => {
      prismaMock.classSession.findUnique.mockResolvedValue({
        id: 'sess-1',
        status: SessionStatus.OPEN,
        section: {
          roster: [{ linkedStudentId: 'student-uuid-1' }, { linkedStudentId: 'student-uuid-2' }],
          enrollments: [],
        },
        records: [{ studentId: 'student-uuid-1', status: AttendanceStatus.PRESENT }], // Solo alumno 1 asistió
      });

      prismaMock.classSession.update.mockResolvedValue({ id: 'sess-1', status: SessionStatus.CLOSED });
      prismaMock.attendanceRecord.create.mockResolvedValue({ id: 'rec-absent' });

      const closed = await attendanceController.closeSession('sess-1');

      expect(closed.status).toBe(SessionStatus.CLOSED);
      // Alumno 2 debe recibir registro de falta
      expect(prismaMock.attendanceRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sessionId: 'sess-1',
          studentId: 'student-uuid-2',
          status: AttendanceStatus.ABSENT,
          method: AttendanceMethod.MANUAL,
        }),
      });
    });

    it('debe registrar en auditoría las correcciones manuales de asistencia', async () => {
      prismaMock.attendanceRecord.findUnique.mockResolvedValue({
        id: 'rec-1',
        studentId: 'student-uuid-1',
        sessionId: 'sess-1',
        status: AttendanceStatus.ABSENT,
      });

      prismaMock.attendanceRecord.update.mockResolvedValue({
        id: 'rec-1',
        status: AttendanceStatus.EXCUSED,
      });

      const updated = await attendanceController.manualOverride(mockAdminUser, 'rec-1', {
        status: AttendanceStatus.EXCUSED,
        reason: 'Justificante médico',
      });

      expect(updated.status).toBe(AttendanceStatus.EXCUSED);
      expect(auditServiceMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ATTENDANCE_MANUAL_OVERRIDE',
          actorId: 'user-admin-1',
          actorType: 'ADMIN',
          detail: expect.objectContaining({
            recordId: 'rec-1',
            newStatus: AttendanceStatus.EXCUSED,
          }),
        }),
      );
    });
  });

  describe('3. Preferencias de Notificación (NotificationPreference)', () => {
    it('debe obtener y actualizar preferencias del usuario', async () => {
      prismaMock.notificationPreference.upsert.mockResolvedValueOnce({
        userId: mockStudentUser.userId,
        emailEnabled: true,
        classReminders: true,
      });

      const prefs = await notificationsController.getPreferences(mockStudentUser);
      expect(prefs.emailEnabled).toBe(true);

      prismaMock.notificationPreference.upsert.mockResolvedValueOnce({
        userId: mockStudentUser.userId,
        emailEnabled: false,
        classReminders: true,
      });

      const updated = await notificationsController.updatePreferences(mockStudentUser, {
        emailEnabled: false,
      });
      expect(updated.emailEnabled).toBe(false);
    });
  });

  describe('4. Documentos de Conocimiento RAG (KnowledgeDocuments)', () => {
    it('debe registrar un documento institucional en estado PENDING', async () => {
      prismaMock.institution.findUnique.mockResolvedValue({ id: 'inst-1', code: '240' });
      prismaMock.knowledgeDocument.create.mockResolvedValue({
        id: 'doc-1',
        title: 'Reglamento General',
        status: DocumentStatus.PENDING,
      });

      const doc = await knowledgeController.create(mockAdminUser, {
        institutionId: 'inst-1',
        title: 'Reglamento General',
        version: '1.0',
      });

      expect(doc.status).toBe(DocumentStatus.PENDING);
    });

    it('debe impedir eliminar un documento ya indexado en el vector store', async () => {
      prismaMock.knowledgeDocument.findUnique.mockResolvedValue({
        id: 'doc-indexed',
        status: DocumentStatus.INDEXED,
      });

      await expect(
        knowledgeController.remove('doc-indexed'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('5. Etiquetas Temáticas de Conversación (ConversationLabel)', () => {
    it('debe permitir etiquetar una conversación validando pertenencia del alumno', async () => {
      prismaMock.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        studentId: mockStudentUser.studentId,
      });

      prismaMock.topicCategory.findUnique.mockResolvedValue({
        id: 'top-1',
        code: 'VOCATIONAL',
        label: 'Orientación Vocacional',
      });

      prismaMock.conversationLabel.upsert.mockResolvedValue({
        id: 'lbl-1',
        conversationId: 'conv-1',
        topicId: 'top-1',
        source: LabelSource.MANUAL,
        topic: { label: 'Orientación Vocacional' },
      });

      const lbl = await chatController.addConversationLabel(mockStudentUser, 'conv-1', {
        topicId: 'top-1',
      });

      expect(lbl.topic.label).toBe('Orientación Vocacional');
    });

    it('debe impedir que un alumno etiquete o consulte etiquetas de una conversación ajena', async () => {
      prismaMock.conversation.findUnique.mockResolvedValue({
        id: 'conv-foreign',
        studentId: 'other-student-uuid',
      });

      await expect(
        chatController.addConversationLabel(mockStudentUser, 'conv-foreign', {
          topicId: 'top-1',
        }),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        chatController.getConversationLabels(mockStudentUser, 'conv-foreign'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
