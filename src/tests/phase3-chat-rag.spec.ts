import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from '../chat/chat.service';
import { ChatController } from '../chat/chat.controller';
import { PrismaService } from '../prisma/prisma.service';
import { ConsentsService } from '../consents/consents.service';
import { AuditService } from '../audit/audit.service';
import {
  ConsentKind,
  RolMensaje,
  FeedbackValue,
  SummaryStatus,
} from '@prisma/client';
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';

describe('Auditoría y Pruebas Unitarias — Fase 3: Chat, IA y RAG (PumaIA)', () => {
  let prismaMock: any;
  let consentsServiceMock: any;
  let auditServiceMock: any;
  let chatService: ChatService;
  let chatController: ChatController;

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn(async (cb) => cb(prismaMock)),
      conversation: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      message: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      messageFeedback: {
        upsert: jest.fn(),
      },
      student: {
        findUnique: jest.fn(),
      },
      psychologicalSummary: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    consentsServiceMock = {
      hasValidConsent: jest.fn().mockResolvedValue(true),
    };

    auditServiceMock = {
      log: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        ChatService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConsentsService, useValue: consentsServiceMock },
        { provide: AuditService, useValue: auditServiceMock },
      ],
    }).compile();

    chatService = module.get<ChatService>(ChatService);
    chatController = module.get<ChatController>(ChatController);
  });

  describe('1. Verificación de Consentimiento y Privacidad en Chat', () => {
    it('debe rechazar el envío de mensajes si el alumno no ha aceptado Términos y Aviso de Privacidad', async () => {
      consentsServiceMock.hasValidConsent.mockResolvedValue(false);

      await expect(
        chatService.handleMessage('student-123', 'user-123', {
          content: 'Hola, tengo una duda sobre mi titulación',
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(consentsServiceMock.hasValidConsent).toHaveBeenCalledWith(
        'user-123',
        ConsentKind.TERMS_AND_NOTICE,
      );
    });

    it('la auditoría debe registrar el evento sin exponer el contenido sensible del mensaje', async () => {
      consentsServiceMock.hasValidConsent.mockResolvedValue(true);

      prismaMock.student.findUnique.mockResolvedValue({
        id: 'student-123',
        careerId: 'career-1',
        currentSemester: 6,
        user: { name: 'PEDRO' },
        career: { name: 'MAC' },
      });

      prismaMock.conversation.create.mockResolvedValue({
        id: 'conv-new-1',
        studentId: 'student-123',
      });

      prismaMock.message.create
        .mockResolvedValueOnce({ id: 'msg-user-1', role: RolMensaje.USER })
        .mockResolvedValueOnce({ id: 'msg-ai-1', role: RolMensaje.ASSISTANT });

      prismaMock.message.findMany.mockResolvedValue([]);
      prismaMock.conversation.update.mockResolvedValue({});

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ response: 'Los requisitos son...' }),
      });

      await chatService.handleMessage('student-123', 'user-123', {
        content: 'Pregunta confidencial sobre mi situación personal',
      });

      expect(auditServiceMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CHAT_MESSAGE_SENT',
          actorId: 'user-123',
          detail: {
            conversationId: 'conv-new-1',
            userMessageId: 'msg-user-1',
            assistantMessageId: 'msg-ai-1',
          },
        }),
      );

      // Verificamos que el texto del mensaje NO está en el detail del audit log
      const auditCall = auditServiceMock.log.mock.calls[0][0];
      expect(JSON.stringify(auditCall.detail)).not.toContain('Pregunta confidencial');
    });
  });

  describe('2. Aislamiento y Control de Propiedad entre Estudiantes', () => {
    it('un alumno NO puede ver los mensajes de la conversación de otro alumno (ForbiddenException)', async () => {
      prismaMock.conversation.findUnique.mockResolvedValue({
        id: 'conv-b',
        studentId: 'student-b',
      });

      await expect(
        chatService.getMessages('conv-b', 'student-a'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('un alumno NO puede inyectar un mensaje en la conversación de otro alumno', async () => {
      consentsServiceMock.hasValidConsent.mockResolvedValue(true);

      prismaMock.conversation.findUnique.mockResolvedValue({
        id: 'conv-b',
        studentId: 'student-b',
      });

      await expect(
        chatService.handleMessage('student-a', 'user-a', {
          conversationId: 'conv-b',
          content: 'Mensaje no autorizado',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('un alumno NO puede renombrar ni eliminar la conversación de otro alumno', async () => {
      prismaMock.conversation.findUnique.mockResolvedValue({
        id: 'conv-b',
        studentId: 'student-b',
      });

      await expect(
        chatService.updateTitle('conv-b', 'student-a', { title: 'Nuevo título' }),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        chatService.deleteConversation('conv-b', 'student-a'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('3. Flujo Conversacional, Historial y Manejo de Fallos de IA', () => {
    it('debe persistir el mensaje del usuario y del asistente en orden cronológico', async () => {
      consentsServiceMock.hasValidConsent.mockResolvedValue(true);

      prismaMock.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        studentId: 'student-123',
      });

      prismaMock.student.findUnique.mockResolvedValue({
        id: 'student-123',
        career: { name: 'Actuaría' },
        currentSemester: 4,
      });

      // Mensaje de usuario
      prismaMock.message.create
        .mockResolvedValueOnce({ id: 'msg-u1', role: RolMensaje.USER, content: '¿Qué es RAG?' })
        .mockResolvedValueOnce({ id: 'msg-a1', role: RolMensaje.ASSISTANT, content: 'RAG es Retrieval Augmented Generation' });

      // Historial
      prismaMock.message.findMany.mockResolvedValue([
        { role: RolMensaje.USER, content: '¿Qué es RAG?' },
      ]);
      prismaMock.conversation.update.mockResolvedValue({});

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ response: 'RAG es Retrieval Augmented Generation' }),
      });

      const result = await chatService.handleMessage('student-123', 'user-123', {
        conversationId: 'conv-1',
        content: '¿Qué es RAG?',
      });

      expect(result.role).toBe(RolMensaje.ASSISTANT);
      expect(result.content).toBe('RAG es Retrieval Augmented Generation');
      expect(prismaMock.message.create).toHaveBeenCalledTimes(2);
    });

    it('debe manejar errores de conexión o HTTP del servidor de IA de forma segura (InternalServerErrorException)', async () => {
      consentsServiceMock.hasValidConsent.mockResolvedValue(true);

      prismaMock.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        studentId: 'student-123',
      });
      prismaMock.student.findUnique.mockResolvedValue({ id: 'student-123' });
      prismaMock.message.create.mockResolvedValue({ id: 'msg-u1' });
      prismaMock.message.findMany.mockResolvedValue([]);

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });

      await expect(
        chatService.handleMessage('student-123', 'user-123', {
          conversationId: 'conv-1',
          content: 'Pregunta con IA caída',
        }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('4. Retroalimentación de Mensajes (MessageFeedback)', () => {
    it('permite calificar un mensaje del asistente con UP/DOWN y comentario opcional', async () => {
      prismaMock.message.findUnique.mockResolvedValue({
        id: 'msg-ai-1',
        conversation: { studentId: 'student-123' },
      });

      prismaMock.messageFeedback.upsert.mockResolvedValue({
        messageId: 'msg-ai-1',
        value: FeedbackValue.UP,
        comment: 'Muy útil',
      });

      const res = await chatService.submitFeedback('msg-ai-1', 'student-123', {
        value: FeedbackValue.UP,
        comment: 'Muy útil',
      });

      expect(res.value).toBe(FeedbackValue.UP);
      expect(prismaMock.messageFeedback.upsert).toHaveBeenCalledWith({
        where: { messageId: 'msg-ai-1' },
        update: { value: FeedbackValue.UP, comment: 'Muy útil' },
        create: { messageId: 'msg-ai-1', value: FeedbackValue.UP, comment: 'Muy útil' },
      });
    });

    it('impide calificar mensajes de conversaciones pertenecientes a otro alumno', async () => {
      prismaMock.message.findUnique.mockResolvedValue({
        id: 'msg-ai-1',
        conversation: { studentId: 'student-b' },
      });

      await expect(
        chatService.submitFeedback('msg-ai-1', 'student-a', {
          value: FeedbackValue.DOWN,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('5. Resúmenes Psicológicos y Control del Estudiante', () => {
    it('el estudiante debe poder aprobar explícitamente un resumen en estado DRAFT', async () => {
      prismaMock.psychologicalSummary.findUnique.mockResolvedValue({
        id: 'sum-1',
        studentId: 'student-123',
        status: SummaryStatus.DRAFT,
      });

      prismaMock.psychologicalSummary.update.mockResolvedValue({
        id: 'sum-1',
        status: SummaryStatus.APPROVED,
      });

      const res = await chatService.approvePsychologicalSummary('sum-1', 'student-123', 'user-123');

      expect(res.status).toBe(SummaryStatus.APPROVED);
      expect(auditServiceMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PSYCHOLOGICAL_SUMMARY_APPROVED',
          actorId: 'user-123',
        }),
      );
    });

    it('un resumen NO puede compartirse si aún está en estado DRAFT sin aprobar (BadRequestException)', async () => {
      prismaMock.psychologicalSummary.findUnique.mockResolvedValue({
        id: 'sum-1',
        studentId: 'student-123',
        status: SummaryStatus.DRAFT,
      });

      await expect(
        chatService.sharePsychologicalSummary(
          'sum-1',
          'student-123',
          'user-123',
          'psicologo-uuid',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('el estudiante puede revocar en cualquier momento un resumen previamente compartido', async () => {
      prismaMock.psychologicalSummary.findUnique.mockResolvedValue({
        id: 'sum-1',
        studentId: 'student-123',
        status: SummaryStatus.SHARED,
      });

      prismaMock.psychologicalSummary.update.mockResolvedValue({
        id: 'sum-1',
        status: SummaryStatus.REVOKED,
      });

      const res = await chatService.revokePsychologicalSummary('sum-1', 'student-123', 'user-123');

      expect(res.status).toBe(SummaryStatus.REVOKED);
      expect(auditServiceMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PSYCHOLOGICAL_SUMMARY_REVOKED',
          actorId: 'user-123',
        }),
      );
    });

    it('un resumen REVOKED no puede volver a compartirse sin nueva aprobación y bloquea lectura al destinatario', async () => {
      prismaMock.psychologicalSummary.findUnique.mockResolvedValue({
        id: 'sum-revoked',
        studentId: 'student-123',
        recipientId: 'psicologo-uuid',
        status: SummaryStatus.REVOKED,
      });

      await expect(
        chatService.sharePsychologicalSummary(
          'sum-revoked',
          'student-123',
          'user-123',
          'psicologo-uuid',
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        chatService.getSharedPsychologicalSummaryForRecipient('sum-revoked', 'psicologo-uuid'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});

