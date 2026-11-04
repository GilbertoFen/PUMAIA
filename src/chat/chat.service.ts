import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
  BadGatewayException,
  HttpException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConsentsService } from '../consents/consents.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateMessageDto,
  UpdateConversationDto,
  UpdateConversationSensitiveDto,
  MessageFeedbackDto,
  AddConversationLabelDto,
  CreatePsychologicalSummaryDto,
  UpdatePsychologicalSummaryDto,
} from './dto/chat.dto';
import {
  ConsentKind,
  RolMensaje,
  SummaryStatus,
  LabelSource,
} from '@prisma/client';

const SENSITIVE_PATTERNS: RegExp[] = [
  /\bsuicid/i,
  /\bautolesi/i,
  /\bquitarme\s+la\s+vida\b/i,
  /\bno\s+quiero\s+vivir\b/i,
  /\bhacerme\s+da[ñn]o\b/i,
  /\bcrisis\s+de\s+ansiedad\b/i,
  /\bdepresi[oó]n\s+severa\b/i,
  /\babuso\s+sexual\b/i,
  /\bviolencia\s+familiar\b/i,
  /\bataque\s+de\s+p[aá]nico\b/i,
  /\bapoyo\s+psicol[oó]gico\s+urgente\b/i,
];

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly consentsService: ConsentsService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Detecta si un texto contiene indicadores de conversación sensible (salud mental, crisis, violencia).
   */
  public detectSensitiveContent(content: string): boolean {
    if (!content) return false;
    return SENSITIVE_PATTERNS.some((pattern) => pattern.test(content));
  }

  /**
   * Obtiene todas las conversaciones del alumno autenticado.
   */
  async getConversations(studentId: string) {
    return this.prisma.conversation.findMany({
      where: { studentId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        studentId: true,
        careerId: true,
        semesterAtStart: true,
        title: true,
        sensitive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Obtiene los mensajes de una conversación asegurando aislamiento de propiedad.
   */
  async getMessages(conversationId: string, studentId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conv) {
      throw new NotFoundException('Conversación no encontrada.');
    }

    if (conv.studentId !== studentId) {
      throw new ForbiddenException('No tienes autorización para acceder a esta conversación.');
    }

    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      include: {
        feedback: true,
      },
    });
  }

  /**
   * Construye el contexto académico mínimo del alumno para el asistente,
   * sin exponer información personal innecesaria (PII) al proveedor externo.
   */
  private async buildAcademicContext(studentId: string): Promise<string> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: { select: { name: true } },
        career: { select: { name: true } },
      },
    });

    if (!student) return 'Perfil académico no disponible.';

    const carrera = student.career?.name || 'Licenciatura';
    const semestre = student.currentSemester || 1;
    const promedio = student.average ? Number(student.average) : 'En cálculo';
    const interes = student.interest || 'Orientación académica general';

    return `Carrera: ${carrera}. Semestre: ${semestre}. Promedio general: ${promedio}. Área de interés: ${interes}.`;
  }

  /**
   * Procesa el envío de mensajes a través del servicio FastAPI (GenAI).
   */
  async handleMessage(studentId: string, userId: string, dto: CreateMessageDto) {
    // 1. Verificación obligatoria de consentimiento TERMS_AND_NOTICE
    const hasConsent = await this.consentsService.hasValidConsent(
      userId,
      ConsentKind.TERMS_AND_NOTICE,
    );

    if (!hasConsent) {
      throw new ForbiddenException(
        'Es necesario aceptar los Términos y Aviso de Privacidad vigente para interactuar con PumaIA.',
      );
    }

    const isMessageSensitive =
      dto.sensitive === true || this.detectSensitiveContent(dto.content);

    let conversationId = dto.conversationId;
    let currentSensitiveState = isMessageSensitive;

    // 2. Validación de propiedad si la conversación ya existe, o creación de nueva
    if (conversationId) {
      const existingConv = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
      });

      if (!existingConv) {
        throw new NotFoundException('Conversación no encontrada.');
      }

      if (existingConv.studentId !== studentId) {
        throw new ForbiddenException('No tienes acceso a esta conversación.');
      }

      currentSensitiveState = Boolean(existingConv.sensitive) || isMessageSensitive;
      if (isMessageSensitive && !existingConv.sensitive) {
        await this.prisma.conversation.update({
          where: { id: conversationId },
          data: { sensitive: true },
        });
      }
    } else {
      const student = await this.prisma.student.findUnique({
        where: { id: studentId },
        select: { careerId: true, currentSemester: true },
      });

      const newConv = await this.prisma.conversation.create({
        data: {
          studentId,
          careerId: student?.careerId ?? null,
          semesterAtStart: student?.currentSemester ?? null,
          title: dto.content.substring(0, 50).trim(),
          ...(isMessageSensitive ? { sensitive: true } : {}),
        },
      });
      conversationId = newConv.id;
    }

    // 3. Persistir mensaje del usuario en la base de datos
    const userMessage = await this.prisma.message.create({
      data: {
        conversationId,
        role: RolMensaje.USER,
        content: dto.content.trim(),
      },
    });

    // 4. Recuperar historial en orden cronológico (excluyendo el mensaje recién insertado)
    const allMessages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });

    const historyForAI = allMessages.slice(0, -1).map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // 5. Contexto académico controlado
    const academicProfile = await this.buildAcademicContext(studentId);

    // 6. Llamada a servicio de IA con URL configurable y timeout seguro
    const fastApiUrl =
      process.env.FASTAPI_CHAT_URL ||
      process.env.FASTAPI_URL ||
      'https://server-genai.onrender.com/chat';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      const response = await fetch(fastApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: dto.content.trim(),
          student_profile: academicProfile,
          history: historyForAI,
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      if (!response.ok) {
        this.logger.error(`Error en respuesta de FastAPI: HTTP ${response.status}`);
        throw new Error(`FastAPI devolvió código ${response.status}`);
      }

      const data = await response.json();
      const aiContent = (data.response || data.output || data.message || '').trim();

      if (!aiContent) {
        throw new Error('La respuesta de la IA llegó vacía.');
      }

      if (this.detectSensitiveContent(aiContent)) {
        currentSensitiveState = true;
      }

      // 7. Persistir respuesta del asistente en la base de datos
      const assistantMessage = await this.prisma.message.create({
        data: {
          conversationId,
          role: RolMensaje.ASSISTANT,
          content: aiContent,
        },
      });

      // Actualizar timestamp y estado sensible si fue detectado
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          updatedAt: new Date(),
          ...(currentSensitiveState ? { sensitive: true } : {}),
        },
      });

      // Registrar auditoría de la interacción (sin exponer el contenido del mensaje)
      await this.auditService.log({
        actorType: 'STUDENT',
        actorId: userId,
        action: 'CHAT_MESSAGE_SENT',
        detail: {
          conversationId,
          userMessageId: userMessage.id,
          assistantMessageId: assistantMessage.id,
        },
      });

      return assistantMessage;
    } catch (error: any) {
      this.logger.error(`Error en comunicación con proveedor de IA: ${error?.message || error}`);
      throw new InternalServerErrorException(
        'El asistente de IA no pudo procesar tu mensaje en este momento. Por favor, intenta de nuevo.',
      );
    }
  }

  /**
   * Procesa el envío de mensajes a través del webhook n8n (RAG con pgvector).
   */
  async chatN8nWebhook(studentId: string, userId: string, dto: CreateMessageDto) {
    // 1. Verificación obligatoria de consentimiento
    const hasConsent = await this.consentsService.hasValidConsent(
      userId,
      ConsentKind.TERMS_AND_NOTICE,
    );

    if (!hasConsent) {
      throw new ForbiddenException(
        'Es necesario aceptar los Términos y Aviso de Privacidad vigente para interactuar con PumaIA.',
      );
    }

    const isMessageSensitive =
      dto.sensitive === true || this.detectSensitiveContent(dto.content);

    let conversationId = dto.conversationId;
    let currentSensitiveState = isMessageSensitive;

    // 2. Validación de propiedad de la conversación
    if (conversationId) {
      const existingConv = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
      });

      if (!existingConv) {
        throw new NotFoundException('Conversación no encontrada.');
      }

      if (existingConv.studentId !== studentId) {
        throw new ForbiddenException('No tienes acceso a esta conversación.');
      }

      currentSensitiveState = Boolean(existingConv.sensitive) || isMessageSensitive;
      if (isMessageSensitive && !existingConv.sensitive) {
        await this.prisma.conversation.update({
          where: { id: conversationId },
          data: { sensitive: true },
        });
      }
    } else {
      const student = await this.prisma.student.findUnique({
        where: { id: studentId },
        select: { careerId: true, currentSemester: true },
      });

      const newConv = await this.prisma.conversation.create({
        data: {
          studentId,
          careerId: student?.careerId ?? null,
          semesterAtStart: student?.currentSemester ?? null,
          title: dto.content.substring(0, 50).trim(),
          ...(isMessageSensitive ? { sensitive: true } : {}),
        },
      });
      conversationId = newConv.id;
    }

    // 3. Persistir mensaje del usuario
    const userMessage = await this.prisma.message.create({
      data: {
        conversationId,
        role: RolMensaje.USER,
        content: dto.content.trim(),
      },
    });

    // 4. Historial previo para n8n
    const allMessages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });

    const historyForAI = allMessages.slice(0, -1).map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // 5. Contexto académico seguro
    const academicProfile = await this.buildAcademicContext(studentId);

    // 6. Invocación segura del webhook de n8n
    const n8nWebhookUrl =
      process.env.N8N_CHAT_WEBHOOK_URL ||
      'https://n8n-it2v.srv1803922.hstgr.cloud/webhook/v1/pumaIA/chat';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      const response = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          id_alumno: studentId,
          conversationId,
          sessionId: conversationId,
          message: dto.content.trim(),
          chatInput: dto.content.trim(),
          student_profile: academicProfile,
          history: historyForAI,
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      if (!response.ok) {
        this.logger.error(`Error en webhook de n8n: HTTP ${response.status}`);
        throw new BadGatewayException({
          statusCode: 502,
          error: 'Bad Gateway',
          code: 'N8N_HTTP_ERROR',
          message: `El servicio conversacional de n8n devolvió un estado no exitoso (HTTP ${response.status}).`,
          conversationId,
          userMessageId: userMessage.id,
        });
      }

      const rawText = await response.text();
      const trimmedText = (rawText || '').trim();

      if (!trimmedText) {
        this.logger.warn(`El webhook de n8n respondió con cuerpo vacío (0 bytes, HTTP ${response.status}).`);
        throw new BadGatewayException({
          statusCode: 502,
          error: 'Bad Gateway',
          code: 'N8N_EMPTY_RESPONSE',
          message: 'El asistente conversacional devolvió una respuesta vacía.',
          conversationId,
          userMessageId: userMessage.id,
        });
      }

      let data: any;
      try {
        data = JSON.parse(trimmedText);
      } catch {
        // En caso de que el webhook devuelva texto plano estructurado
        data = { text: trimmedText };
      }

      let aiContent = '';
      if (typeof data === 'string') {
        aiContent = data.trim();
      } else if (Array.isArray(data) && data.length > 0) {
        const first = data[0];
        aiContent = (
          first?.output ||
          first?.response ||
          first?.message ||
          first?.text ||
          first?.content ||
          (typeof first === 'string' ? first : '')
        ).trim();
      } else if (typeof data === 'object' && data !== null) {
        aiContent = (
          data.output ||
          data.response ||
          data.message ||
          data.text ||
          data.content ||
          ''
        ).trim();
      }

      if (!aiContent) {
        this.logger.warn(`El payload de n8n no contiene texto utilizable: ${trimmedText.slice(0, 100)}`);
        throw new BadGatewayException({
          statusCode: 502,
          error: 'Bad Gateway',
          code: 'N8N_INVALID_PAYLOAD',
          message: 'El asistente conversacional no devolvió texto utilizable en la respuesta.',
          conversationId,
          userMessageId: userMessage.id,
        });
      }

      if (this.detectSensitiveContent(aiContent)) {
        currentSensitiveState = true;
      }

      // 7. Persistir respuesta del asistente
      const assistantMessage = await this.prisma.message.create({
        data: {
          conversationId,
          role: RolMensaje.ASSISTANT,
          content: aiContent,
        },
      });

      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          updatedAt: new Date(),
          ...(currentSensitiveState ? { sensitive: true } : {}),
        },
      });

      await this.auditService.log({
        actorType: 'STUDENT',
        actorId: userId,
        action: 'CHAT_MESSAGE_SENT_N8N',
        detail: {
          conversationId,
          userMessageId: userMessage.id,
          assistantMessageId: assistantMessage.id,
        },
      });

      return assistantMessage;
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      const isTimeout =
        error?.name === 'AbortError' || error?.message?.includes('aborted');
      const errorCode = isTimeout ? 'N8N_TIMEOUT' : 'N8N_CONNECTION_ERROR';
      const errorMsg = isTimeout
        ? 'El asistente conversacional tardó demasiado en responder (tiempo de espera agotado).'
        : 'No fue posible establecer conexión con el servicio conversacional externo.';

      this.logger.error(`Error en webhook n8n [${errorCode}]: ${error?.message || error}`);
      throw new BadGatewayException({
        statusCode: 502,
        error: 'Bad Gateway',
        code: errorCode,
        message: errorMsg,
        conversationId,
        userMessageId: userMessage.id,
      });
    }
  }

  /**
   * Permite marcar o desmarcar explícitamente una conversación como sensible (`sensitive: true`).
   * Al marcarse como sensible, queda excluida de analítica y mejora del asistente.
   */
  async updateConversationSensitive(
    id: string,
    studentId: string,
    userId: string,
    dto: UpdateConversationSensitiveDto,
  ) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id },
    });

    if (!conv) {
      throw new NotFoundException('Conversación no encontrada.');
    }

    if (conv.studentId !== studentId) {
      throw new ForbiddenException('No tienes acceso a esta conversación.');
    }

    const updated = await this.prisma.conversation.update({
      where: { id },
      data: { sensitive: dto.sensitive },
    });

    await this.auditService.log({
      actorType: 'STUDENT',
      actorId: userId,
      action: dto.sensitive
        ? 'CONVERSATION_MARKED_SENSITIVE'
        : 'CONVERSATION_UNMARKED_SENSITIVE',
      detail: { conversationId: id, sensitive: dto.sensitive },
    });

    return updated;
  }

  /**
   * Verifica si una conversación puede emplearse para mejora del asistente (`ConsentKind.IMPROVEMENT`).
   * Exige simultáneamente que la conversación NO sea sensible y que el alumno tenga vigente IMPROVEMENT.
   */
  async isConversationEligibleForImprovement(
    conversationId: string,
    ownerUserId?: string,
  ): Promise<boolean> {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conv || conv.sensitive) {
      return false;
    }

    let resolvedUserId = ownerUserId;
    if (!resolvedUserId && this.prisma.student?.findUnique) {
      const student = await this.prisma.student.findUnique({
        where: { id: conv.studentId },
        select: { userId: true },
      });
      resolvedUserId = student?.userId;
    }

    if (!resolvedUserId) {
      return false;
    }

    return this.consentsService.hasValidConsent(
      resolvedUserId,
      ConsentKind.IMPROVEMENT,
    );
  }

  /**
   * Actualiza el título de una conversación validando pertenencia.
   */
  async updateTitle(id: string, studentId: string, dto: UpdateConversationDto) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id },
    });

    if (!conv) {
      throw new NotFoundException('Conversación no encontrada.');
    }

    if (conv.studentId !== studentId) {
      throw new ForbiddenException('No tienes acceso a esta conversación.');
    }

    return this.prisma.conversation.update({
      where: { id },
      data: { title: dto.title.trim() },
    });
  }

  /**
   * Elimina una conversación y sus mensajes en cascada.
   */
  async deleteConversation(id: string, studentId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id },
    });

    if (!conv) {
      throw new NotFoundException('Conversación no encontrada.');
    }

    if (conv.studentId !== studentId) {
      throw new ForbiddenException('No tienes acceso a esta conversación.');
    }

    return this.prisma.conversation.delete({
      where: { id },
    });
  }

  /**
   * Registra retroalimentación (pulgar arriba/abajo) para un mensaje del asistente.
   */
  async submitFeedback(messageId: string, studentId: string, dto: MessageFeedbackDto) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { conversation: true },
    });

    if (!message) {
      throw new NotFoundException('Mensaje no encontrado.');
    }

    if (message.conversation.studentId !== studentId) {
      throw new ForbiddenException('No tienes autorización para retroalimentar este mensaje.');
    }

    return this.prisma.messageFeedback.upsert({
      where: { messageId },
      update: {
        value: dto.value,
        comment: dto.comment?.trim() ?? null,
      },
      create: {
        messageId,
        value: dto.value,
        comment: dto.comment?.trim() ?? null,
      },
    });
  }

  /**
   * Gestión de Resúmenes Psicológicos bajo control explícito del estudiante.
   */
  async getMyPsychologicalSummaries(studentId: string, userId: string) {
    await this.auditService.log({
      actorType: 'STUDENT',
      actorId: userId,
      action: 'PSYCHOLOGICAL_SUMMARY_ACCESSED',
      detail: { studentId },
    });

    return this.prisma.psychologicalSummary.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Crea un resumen psicológico inicialmente en estado DRAFT.
   * Si se vincula a una conversación, valida propiedad y la marca automáticamente como sensible.
   */
  async createPsychologicalSummary(
    studentId: string,
    userId: string,
    dto: CreatePsychologicalSummaryDto,
  ) {
    if (dto.conversationId) {
      const conv = await this.prisma.conversation.findUnique({
        where: { id: dto.conversationId },
      });

      if (!conv) {
        throw new NotFoundException('La conversación vinculada no existe.');
      }

      if (conv.studentId !== studentId) {
        throw new ForbiddenException('No tienes acceso a la conversación indicada.');
      }

      if (typeof (this.prisma.conversation as any)?.update === 'function') {
        await this.prisma.conversation.update({
          where: { id: dto.conversationId },
          data: { sensitive: true },
        });
      }
    }

    const created = await this.prisma.psychologicalSummary.create({
      data: {
        studentId,
        content: dto.content.trim(),
        status: SummaryStatus.DRAFT,
      },
    });

    await this.auditService.log({
      actorType: 'STUDENT',
      actorId: userId,
      action: 'PSYCHOLOGICAL_SUMMARY_CREATED_DRAFT',
      detail: {
        summaryId: created.id,
        conversationId: dto.conversationId ?? null,
        status: SummaryStatus.DRAFT,
      },
    });

    return created;
  }

  /**
   * Permite al estudiante editar el contenido de su resumen psicológico.
   * Si el resumen ya había sido aprobado o compartido, regresa a estado DRAFT para exigir nueva aprobación explícita.
   */
  async updatePsychologicalSummaryContent(
    summaryId: string,
    studentId: string,
    userId: string,
    dto: UpdatePsychologicalSummaryDto,
  ) {
    const summary = await this.prisma.psychologicalSummary.findUnique({
      where: { id: summaryId },
    });

    if (!summary || summary.studentId !== studentId) {
      throw new NotFoundException('Resumen no encontrado.');
    }

    const updated = await this.prisma.psychologicalSummary.update({
      where: { id: summaryId },
      data: {
        content: dto.content.trim(),
        status: SummaryStatus.DRAFT,
        approvedAt: null,
        sharedAt: null,
      },
    });

    await this.auditService.log({
      actorType: 'STUDENT',
      actorId: userId,
      action: 'PSYCHOLOGICAL_SUMMARY_EDITED',
      detail: {
        summaryId,
        previousStatus: summary.status,
        newStatus: SummaryStatus.DRAFT,
      },
    });

    return updated;
  }

  /**
   * Aprueba explícitamente un resumen psicológico.
   * Solo se permite la transición desde el estado DRAFT.
   */
  async approvePsychologicalSummary(summaryId: string, studentId: string, userId: string) {
    const summary = await this.prisma.psychologicalSummary.findUnique({
      where: { id: summaryId },
    });

    if (!summary || summary.studentId !== studentId) {
      throw new NotFoundException('Resumen no encontrado.');
    }

    if (summary.status !== SummaryStatus.DRAFT) {
      throw new BadRequestException(
        `Solo se pueden aprobar resúmenes en estado borrador (DRAFT). Estado actual: ${summary.status}.`,
      );
    }

    const updated = await this.prisma.psychologicalSummary.update({
      where: { id: summaryId },
      data: {
        status: SummaryStatus.APPROVED,
        approvedAt: new Date(),
      },
    });

    await this.auditService.log({
      actorType: 'STUDENT',
      actorId: userId,
      action: 'PSYCHOLOGICAL_SUMMARY_APPROVED',
      detail: { summaryId },
    });

    return updated;
  }

  /**
   * Comparte un resumen psicológico exclusivamente cuando está en estado APPROVED
   * y tras validar que el destinatario (recipientId) exista y sea un usuario válido.
   */
  async sharePsychologicalSummary(
    summaryId: string,
    studentId: string,
    userId: string,
    recipientId: string,
  ) {
    const summary = await this.prisma.psychologicalSummary.findUnique({
      where: { id: summaryId },
    });

    if (!summary || summary.studentId !== studentId) {
      throw new NotFoundException('Resumen no encontrado.');
    }

    if (summary.status !== SummaryStatus.APPROVED) {
      throw new BadRequestException(
        'El estudiante debe aprobar explícitamente el resumen (estado APPROVED) antes de poder compartirlo.',
      );
    }

    if (recipientId === userId) {
      throw new BadRequestException(
        'El destinatario del resumen psicológico debe ser un orientador o especialista distinto al propio estudiante.',
      );
    }

    if (typeof (this.prisma as any).user?.findUnique === 'function') {
      const recipientUser = await (this.prisma as any).user.findUnique({
        where: { id: recipientId },
      });

      if (!recipientUser || recipientUser.status === 'DELETED') {
        throw new NotFoundException(
          'El usuario destinatario especificado no existe o no se encuentra activo.',
        );
      }
    }

    const updated = await this.prisma.psychologicalSummary.update({
      where: { id: summaryId },
      data: {
        recipientId,
        status: SummaryStatus.SHARED,
        sharedAt: new Date(),
        revokedAt: null,
      },
    });

    await this.auditService.log({
      actorType: 'STUDENT',
      actorId: userId,
      action: 'PSYCHOLOGICAL_SUMMARY_SHARED',
      detail: { summaryId, recipientId },
    });

    return updated;
  }

  /**
   * Permite que exclusivamente el destinatario autorizado (psicólogo/orientador) consulte un resumen en estado SHARED.
   * Si fue revocado (REVOKED) o está en DRAFT/APPROVED o el usuario no es recipientId, deniega el acceso.
   */
  async getSharedPsychologicalSummaryForRecipient(summaryId: string, recipientUserId: string) {
    const summary = await this.prisma.psychologicalSummary.findUnique({
      where: { id: summaryId },
    });

    if (!summary) {
      throw new NotFoundException('Resumen no encontrado.');
    }

    if (summary.recipientId !== recipientUserId || summary.status !== SummaryStatus.SHARED) {
      await this.auditService.log({
        actorType: 'SYSTEM',
        actorId: recipientUserId,
        action: 'PSYCHOLOGICAL_SUMMARY_ACCESS_DENIED',
        detail: { summaryId, status: summary.status },
      });
      throw new ForbiddenException(
        'Acceso denegado: este resumen psicológico no ha sido compartido contigo o su acceso fue revocado por el estudiante.',
      );
    }

    await this.auditService.log({
      actorType: 'SYSTEM',
      actorId: recipientUserId,
      action: 'PSYCHOLOGICAL_SUMMARY_RECIPIENT_READ',
      detail: { summaryId, studentId: summary.studentId },
    });

    return summary;
  }

  async revokePsychologicalSummary(summaryId: string, studentId: string, userId: string) {
    const summary = await this.prisma.psychologicalSummary.findUnique({
      where: { id: summaryId },
    });

    if (!summary || summary.studentId !== studentId) {
      throw new NotFoundException('Resumen no encontrado.');
    }

    const updated = await this.prisma.psychologicalSummary.update({
      where: { id: summaryId },
      data: {
        status: SummaryStatus.REVOKED,
        revokedAt: new Date(),
      },
    });

    await this.auditService.log({
      actorType: 'STUDENT',
      actorId: userId,
      action: 'PSYCHOLOGICAL_SUMMARY_REVOKED',
      detail: { summaryId },
    });

    return updated;
  }

  /**
   * Clasifica una conversación vinculándole una etiqueta temática (ConversationLabel).
   * Exige que la conversación NO esté marcada como sensible (`sensitive: false`)
   * y que el alumno propietario cuente con consentimiento vigente `ConsentKind.ANALYTICS`.
   */
  async addConversationLabel(
    conversationId: string,
    studentId: string,
    dto: AddConversationLabelDto,
    isAdmin: boolean = false,
    actorUserId?: string,
  ) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conv) {
      throw new NotFoundException('Conversación no encontrada.');
    }

    if (!isAdmin && conv.studentId !== studentId) {
      throw new ForbiddenException('No tienes acceso a esta conversación.');
    }

    // Exclusión obligatoria de conversaciones sensibles
    if (conv.sensitive) {
      throw new ForbiddenException(
        'Las conversaciones marcadas como sensibles están excluidas de clasificación temática y analítica institucional.',
      );
    }

    // Verificación obligatoria de consentimiento ANALYTICS del estudiante titular
    let ownerUserId = !isAdmin ? actorUserId : undefined;
    if (!ownerUserId && typeof (this.prisma.student as any)?.findUnique === 'function') {
      const ownerStudent = await this.prisma.student.findUnique({
        where: { id: conv.studentId },
        select: { userId: true },
      });
      ownerUserId = ownerStudent?.userId;
    }

    // Si se conoce el userId o el servicio de consentimiento está activo, validar ConsentKind.ANALYTICS
    const hasAnalyticsConsent = await this.consentsService.hasValidConsent(
      ownerUserId || conv.studentId,
      ConsentKind.ANALYTICS,
    );

    if (!hasAnalyticsConsent) {
      throw new ForbiddenException(
        'El estudiante no ha otorgado consentimiento para analítica (ANALYTICS); no se permite clasificar temáticamente la conversación.',
      );
    }

    const topic = await this.prisma.topicCategory.findUnique({
      where: { id: dto.topicId },
    });

    if (!topic) {
      throw new NotFoundException('Categoría temática no encontrada.');
    }

    const source = dto.source || LabelSource.MANUAL;

    return this.prisma.conversationLabel.upsert({
      where: {
        conversationId_source_topicId: {
          conversationId,
          source,
          topicId: dto.topicId,
        },
      },
      update: {
        confidence: dto.confidence !== undefined ? dto.confidence : undefined,
        modelVersion: dto.modelVersion || undefined,
      },
      create: {
        conversationId,
        topicId: dto.topicId,
        source,
        confidence: dto.confidence !== undefined ? dto.confidence : null,
        modelVersion: dto.modelVersion || null,
      },
      include: {
        topic: true,
      },
    });
  }

  /**
   * Obtiene las etiquetas asociadas a una conversación.
   */
  async getConversationLabels(
    conversationId: string,
    studentId: string,
    isAdmin: boolean = false,
  ) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conv) {
      throw new NotFoundException('Conversación no encontrada.');
    }

    if (!isAdmin && conv.studentId !== studentId) {
      throw new ForbiddenException('No tienes acceso a esta conversación.');
    }

    return this.prisma.conversationLabel.findMany({
      where: { conversationId },
      include: { topic: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
