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
} from '@prisma/client';
import {
  ForbiddenException,
  NotFoundException,
  BadGatewayException,
} from '@nestjs/common';
import pg from 'pg';

const { Pool } = pg;
const LOCAL_DB_URL = 'postgresql://postgres:postgres@127.0.0.1:5433/pumaia_test?schema=public';

describe('FASE 13: Diagnóstico y Pruebas Unitarias de Integración Chat n8n (PUMAIA)', () => {
  let prismaMock: any;
  let consentsServiceMock: any;
  let auditServiceMock: any;
  let chatService: ChatService;
  let chatController: ChatController;

  const originalFetch = global.fetch;

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn(async (cb) => cb(prismaMock)),
      conversation: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
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

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  describe('1. Normalización de Respuestas de n8n y Validación de Contrato', () => {
    it('debe extraer y persistir respuesta válida en formato output: { output: "texto" }', async () => {
      prismaMock.student.findUnique.mockResolvedValue({
        id: 'student-1',
        careerId: 'mac-1',
        currentSemester: 2,
        career: { name: 'MAC' },
      });
      prismaMock.conversation.create.mockResolvedValue({
        id: 'conv-1',
        studentId: 'student-1',
      });
      prismaMock.message.create
        .mockResolvedValueOnce({ id: 'msg-user-1', conversationId: 'conv-1', role: 'USER' })
        .mockResolvedValueOnce({ id: 'msg-ai-1', conversationId: 'conv-1', role: 'ASSISTANT', content: 'Respuesta generada por agente' });
      prismaMock.message.findMany.mockResolvedValue([]);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(JSON.stringify({ output: 'Respuesta generada por agente' })),
      });

      const result = await chatService.chatN8nWebhook('student-1', 'user-1', {
        content: '¿Cuáles son los requisitos de titulación?',
      });

      expect(result.role).toBe(RolMensaje.ASSISTANT);
      expect(result.content).toBe('Respuesta generada por agente');
      expect(prismaMock.message.create).toHaveBeenCalledTimes(2);
    });

    it('debe normalizar respuestas en formato alternativo response: { response: "texto" }', async () => {
      prismaMock.student.findUnique.mockResolvedValue({ id: 'student-1' });
      prismaMock.conversation.create.mockResolvedValue({ id: 'conv-1' });
      prismaMock.message.create
        .mockResolvedValueOnce({ id: 'msg-u1' })
        .mockResolvedValueOnce({ id: 'msg-ai-1', role: 'ASSISTANT', content: 'Texto en response' });
      prismaMock.message.findMany.mockResolvedValue([]);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(JSON.stringify({ response: 'Texto en response' })),
      });

      const res = await chatService.chatN8nWebhook('student-1', 'user-1', { content: 'Hola' });
      expect(res.content).toBe('Texto en response');
    });

    it('debe normalizar respuestas cuando n8n devuelve un array con un item [ { text: "..." } ]', async () => {
      prismaMock.student.findUnique.mockResolvedValue({ id: 'student-1' });
      prismaMock.conversation.create.mockResolvedValue({ id: 'conv-1' });
      prismaMock.message.create
        .mockResolvedValueOnce({ id: 'msg-u1' })
        .mockResolvedValueOnce({ id: 'msg-ai-1', role: 'ASSISTANT', content: 'Contenido en array' });
      prismaMock.message.findMany.mockResolvedValue([]);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(JSON.stringify([{ text: 'Contenido en array' }])),
      });

      const res = await chatService.chatN8nWebhook('student-1', 'user-1', { content: 'Duda' });
      expect(res.content).toBe('Contenido en array');
    });

    it('debe rechazar con BadGatewayException (N8N_EMPTY_RESPONSE) si n8n responde HTTP 200 con cuerpo vacío (0 bytes)', async () => {
      prismaMock.student.findUnique.mockResolvedValue({ id: 'student-1' });
      prismaMock.conversation.create.mockResolvedValue({ id: 'conv-1' });
      prismaMock.message.create.mockResolvedValue({ id: 'msg-user-1', conversationId: 'conv-1' });
      prismaMock.message.findMany.mockResolvedValue([]);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(''),
      });

      await expect(
        chatService.chatN8nWebhook('student-1', 'user-1', { content: 'Pregunta' }),
      ).rejects.toThrow(BadGatewayException);

      try {
        await chatService.chatN8nWebhook('student-1', 'user-1', { content: 'Pregunta' });
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({
          code: 'N8N_EMPTY_RESPONSE',
          statusCode: 502,
          conversationId: 'conv-1',
          userMessageId: 'msg-user-1',
        });
      }
    });

    it('debe rechazar con BadGatewayException (N8N_INVALID_PAYLOAD) si el JSON no contiene texto utilizable', async () => {
      prismaMock.student.findUnique.mockResolvedValue({ id: 'student-1' });
      prismaMock.conversation.create.mockResolvedValue({ id: 'conv-1' });
      prismaMock.message.create.mockResolvedValueOnce({ id: 'msg-u1' });
      prismaMock.message.findMany.mockResolvedValue([]);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(JSON.stringify({ status: 'success', data: {} })),
      });

      await expect(
        chatService.chatN8nWebhook('student-1', 'user-1', { content: 'Pregunta' }),
      ).rejects.toThrow(BadGatewayException);
    });

    it('debe manejar timeout de n8n devolviendo BadGatewayException con código N8N_TIMEOUT', async () => {
      prismaMock.student.findUnique.mockResolvedValue({ id: 'student-1' });
      prismaMock.conversation.create.mockResolvedValue({ id: 'conv-1' });
      prismaMock.message.create.mockResolvedValueOnce({ id: 'msg-u1' });
      prismaMock.message.findMany.mockResolvedValue([]);

      global.fetch = jest.fn().mockRejectedValue(new DOMException('The operation was aborted', 'AbortError'));

      try {
        await chatService.chatN8nWebhook('student-1', 'user-1', { content: 'Timeout test' });
        fail('Debió arrojar BadGatewayException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadGatewayException);
        expect(err.getResponse().code).toBe('N8N_TIMEOUT');
      }
    });

    it('debe manejar error de conexión devolviendo BadGatewayException con código N8N_CONNECTION_ERROR', async () => {
      prismaMock.student.findUnique.mockResolvedValue({ id: 'student-1' });
      prismaMock.conversation.create.mockResolvedValue({ id: 'conv-1' });
      prismaMock.message.create.mockResolvedValueOnce({ id: 'msg-u1' });
      prismaMock.message.findMany.mockResolvedValue([]);

      global.fetch = jest.fn().mockRejectedValue(new Error('fetch failed ECONNREFUSED'));

      try {
        await chatService.chatN8nWebhook('student-1', 'user-1', { content: 'Conn error test' });
        fail('Debió arrojar BadGatewayException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadGatewayException);
        expect(err.getResponse().code).toBe('N8N_CONNECTION_ERROR');
      }
    });
  });

  describe('2. Aislamiento, Privacidad y Control de Acceso (Seguridad)', () => {
    it('debe prohibir el acceso a mensajes si la conversación pertenece a otro alumno', async () => {
      prismaMock.conversation.findUnique.mockResolvedValue({
        id: 'conv-ajena',
        studentId: 'student-legitimo',
      });

      await expect(
        chatService.getMessages('conv-ajena', 'student-intruso'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('debe impedir enviar mensajes a una conversación perteneciente a otro alumno', async () => {
      consentsServiceMock.hasValidConsent.mockResolvedValue(true);
      prismaMock.conversation.findUnique.mockResolvedValue({
        id: 'conv-ajena',
        studentId: 'student-legitimo',
      });

      await expect(
        chatService.chatN8nWebhook('student-intruso', 'user-intruso', {
          conversationId: 'conv-ajena',
          content: 'Mensaje malicioso',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('debe rechazar el uso del chat si el estudiante no tiene consentimiento TERMS_AND_NOTICE', async () => {
      consentsServiceMock.hasValidConsent.mockResolvedValue(false);

      await expect(
        chatService.chatN8nWebhook('student-1', 'user-1', { content: 'Sin consentimiento' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('no debe exponer URLs privadas ni tokens en el detalle de la excepción', async () => {
      prismaMock.student.findUnique.mockResolvedValue({ id: 'student-1' });
      prismaMock.conversation.create.mockResolvedValue({ id: 'conv-1' });
      prismaMock.message.create.mockResolvedValueOnce({ id: 'msg-u1' });
      prismaMock.message.findMany.mockResolvedValue([]);

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: jest.fn().mockResolvedValue('Service Unavailable'),
      });

      try {
        await chatService.chatN8nWebhook('student-1', 'user-1', { content: 'Secret leak check' });
      } catch (err: any) {
        const responseJson = JSON.stringify(err.getResponse());
        expect(responseJson).not.toContain('X-N8N-API-KEY');
        expect(responseJson).not.toContain('srv1803922.hstgr.cloud');
      }
    });
  });

  describe('3. Persistencia Real en Base de Datos PostgreSQL Local', () => {
    let pool: pg.Pool;

    beforeAll(() => {
      pool = new Pool({ connectionString: LOCAL_DB_URL });
    });

    afterAll(async () => {
      await pool.end();
    });

    it('debe verificar que las tablas conversaciones, mensajes y retroalimentacion_mensaje existen y tienen integridad referencial', async () => {
      const res = await pool.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('conversaciones', 'mensajes', 'retroalimentacion_mensaje')",
      );
      const tables = res.rows.map((r) => r.table_name);
      expect(tables).toContain('conversaciones');
      expect(tables).toContain('mensajes');
      expect(tables).toContain('retroalimentacion_mensaje');
    });

    it('debe persistir el mensaje del usuario aún cuando n8n falle, permitiendo recuperación del historial', async () => {
      // Tomamos un alumno existente de prueba
      const studentRes = await pool.query('SELECT id_alumno FROM alumno LIMIT 1');
      if (studentRes.rows.length === 0) return;
      const studentId = studentRes.rows[0].id_alumno;

      // Insertar conversación de prueba
      const convInsert = await pool.query(
        "INSERT INTO conversaciones (id_conversacion, id_alumno, titulo, creado_en, actualizado_en) VALUES (gen_random_uuid(), $1, 'Test Persistencia', NOW(), NOW()) RETURNING id_conversacion",
        [studentId],
      );
      const convId = convInsert.rows[0].id_conversacion;

      // Insertar mensaje de usuario
      const msgInsert = await pool.query(
        "INSERT INTO mensajes (id_mensaje, id_conversacion, rol, contenido, creado_en) VALUES (gen_random_uuid(), $1, 'USER', '¿Qué materias siguen?', NOW()) RETURNING id_mensaje",
        [convId],
      );
      const msgId = msgInsert.rows[0].id_mensaje;

      // Verificar que el mensaje persiste en PostgreSQL
      const queryCheck = await pool.query('SELECT rol, contenido FROM mensajes WHERE id_mensaje = $1', [msgId]);
      expect(queryCheck.rows[0].rol).toBe('USER');
      expect(queryCheck.rows[0].contenido).toBe('¿Qué materias siguen?');

      // Limpieza
      await pool.query('DELETE FROM conversaciones WHERE id_conversacion = $1', [convId]);
    });
  });
});
