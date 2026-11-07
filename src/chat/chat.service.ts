import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  BadGatewayException,
  ServiceUnavailableException,
  HttpException,
  HttpStatus,
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
import { buildCrisisResponse, detectCrisis, detectSensitive } from './safety';

const HISTORY_LIMIT = 20;
const RATE_LIMIT_MAX = 10; // mensajes
const RATE_LIMIT_WINDOW_MS = 60_000;
const SENSITIVE_TITLE = 'Conversación';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  // Un solo proceso. Si algún día hay varias instancias, mover a Redis.
  private readonly messageLog = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly consentsService: ConsentsService,
    private readonly auditService: AuditService,
  ) {}

  /** Se conserva por compatibilidad con otros módulos/pruebas. */
  public detectSensitiveContent(content: string): boolean {
    return detectSensitive(content);
  }

  // ------------------------------------------------------------------ conversaciones

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

  private async getOwnedConversation(id: string, studentId: string) {
    const conv = await this.prisma.conversation.findUnique({ where: { id } });
    if (!conv) throw new NotFoundException('Conversación no encontrada.');
    if (conv.studentId !== studentId) {
      throw new ForbiddenException('No tienes acceso a esta conversación.');
    }
    return conv;
  }

  async getMessages(conversationId: string, studentId: string) {
    await this.getOwnedConversation(conversationId, studentId);
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      include: { feedback: true },
    });
  }

  // ------------------------------------------------------------------ envío de mensajes

  private checkRateLimit(userId: string) {
    const now = Date.now();
    const recent = (this.messageLog.get(userId) ?? []).filter(
      (t) => now - t < RATE_LIMIT_WINDOW_MS,
    );
    if (recent.length >= RATE_LIMIT_MAX) {
      throw new HttpException(
        'Estás enviando mensajes muy rápido. Espera un momento e intenta de nuevo.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.messageLog.set(userId, recent);
  }

  /**
   * Contexto del alumno para el asistente. Se arma en el servidor con el studentId del token:
   * sin nombre, correo ni número de cuenta. Incluye SUS materias en curso con grupo, profesor y horario,
   * para que el agente no tenga que adivinarlos desde el catálogo.
   */
  private async buildAcademicContext(studentId: string): Promise<string> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: { career: { select: { name: true } } },
    });
    if (!student) return 'Perfil académico no disponible.';

    const parts = [`Carrera: ${student.career?.name || 'Licenciatura'}.`];
    if (student.currentSemester)
      parts.push(`Semestre: ${student.currentSemester}.`);
    if (student.average)
      parts.push(`Promedio general: ${Number(student.average)}.`);
    if (student.interest)
      parts.push(`Área de interés: ${student.interest.slice(0, 100)}.`);

    const current = await this.prisma.enrollment.findMany({
      where: { studentId, status: 'IN_PROGRESS' },
      include: {
        subject: { select: { subject: true, code: true, credits: true } },
        period: { select: { code: true } },
        section: {
          include: {
            professor: {
              select: { name: true, lastNameP: true, lastNameM: true },
            },
            meetings: { orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }] },
          },
        },
      },
      orderBy: { subject: { subject: 'asc' } },
    });

    if (current.length === 0) {
      parts.push(
        'MATERIAS EN CURSO DEL ALUMNO: no tiene materias en curso registradas.',
      );
      return parts.join(' ');
    }

    const days = ['', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
    const hhmm = (d: Date) => d.toISOString().substring(11, 16);

    const lines = current.map((e) => {
      const sec = e.section;
      const prof = sec?.professor
        ? [sec.professor.name, sec.professor.lastNameP, sec.professor.lastNameM]
            .filter(Boolean)
            .join(' ')
        : 'profesor no registrado';
      const sched = sec?.meetings?.length
        ? sec.meetings
            .map(
              (m) =>
                `${days[m.weekday] ?? m.weekday} ${hhmm(m.startTime)}-${hhmm(m.endTime)}`,
            )
            .join(', ')
        : 'horario no registrado';
      const group = sec ? `grupo ${sec.groupCode}` : 'grupo no registrado';
      return `- ${e.subject.subject} (${e.period?.code ?? 'periodo n/d'}): ${group}, profesor: ${prof}, horario: ${sched}.`;
    });

    parts.push(
      'MATERIAS EN CURSO DEL ALUMNO (es SU horario real; para "mi profesor", "mi horario" o "mi grupo" usa solo esto, no el catálogo general):\n' +
        lines.join('\n'),
    );
    return parts.join(' ');
  }

  async handleMessage(
    studentId: string,
    userId: string,
    dto: CreateMessageDto,
  ) {
    this.checkRateLimit(userId);

    const hasConsent = await this.consentsService.hasValidConsent(
      userId,
      ConsentKind.TERMS_AND_NOTICE,
    );
    if (!hasConsent) {
      throw new ForbiddenException(
        'Es necesario aceptar los Términos y Aviso de Privacidad vigente para interactuar con PumaIA.',
      );
    }

    const content = dto.content.trim();
    if (!content)
      throw new BadRequestException('El mensaje no puede estar vacío.');

    const crisis = detectCrisis(content);
    const messageSensitive = dto.sensitive === true || detectSensitive(content);

    // --- conversación (existente con dueño verificado, o nueva)
    let conversationId = dto.conversationId;
    let sensitive = messageSensitive;

    if (conversationId) {
      const existing = await this.getOwnedConversation(
        conversationId,
        studentId,
      );
      sensitive = existing.sensitive || messageSensitive;
      if (sensitive && !existing.sensitive) {
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
      const created = await this.prisma.conversation.create({
        data: {
          studentId,
          careerId: student?.careerId ?? null,
          semesterAtStart: student?.currentSemester ?? null,
          // El título nunca copia texto de una conversación sensible: se ve en el listado.
          title: sensitive ? SENSITIVE_TITLE : content.slice(0, 50).trim(),
          sensitive,
        },
      });
      conversationId = created.id;
    }

    const userMessage = await this.prisma.message.create({
      data: { conversationId, role: RolMensaje.USER, content },
    });

    // --- Protocolo de crisis: respuesta fija, sin proveedor externo
    if (crisis) {
      const assistantMessage = await this.prisma.message.create({
        data: {
          conversationId,
          role: RolMensaje.ASSISTANT,
          content: buildCrisisResponse(),
        },
      });
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { sensitive: true, updatedAt: new Date() },
      });
      await this.auditService.log({
        actorType: 'SYSTEM',
        actorId: userId,
        action: 'CHAT_CRISIS_PROTOCOL_TRIGGERED',
        detail: {
          conversationId,
          userMessageId: userMessage.id,
          assistantMessageId: assistantMessage.id,
        },
      });
      return { ...assistantMessage, crisis: true };
    }

    // --- Historial acotado (el mensaje recién guardado va aparte)
    const recent = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_LIMIT + 1,
    });
    const history = recent
      .filter((m) => m.id !== userMessage.id)
      .slice(0, HISTORY_LIMIT)
      .reverse()
      .map((m) => ({ role: m.role, content: m.content }));

    const aiContent = await this.callAdvisor({
      studentId,
      conversationId,
      userMessageId: userMessage.id,
      message: content,
      history,
      sensitive,
      profile: await this.buildAcademicContext(studentId),
    });

    const assistantMessage = await this.prisma.message.create({
      data: { conversationId, role: RolMensaje.ASSISTANT, content: aiContent },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        updatedAt: new Date(),
        ...(sensitive || detectSensitive(aiContent) ? { sensitive: true } : {}),
      },
    });

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
  }

  /** Llama al orientador (n8n). Devuelve solo el texto de la respuesta. */
  private async callAdvisor(p: {
    studentId: string;
    conversationId: string;
    userMessageId: string;
    message: string;
    history: { role: string; content: string }[];
    sensitive: boolean;
    profile: string;
  }): Promise<string> {
    const url = process.env.N8N_CHAT_WEBHOOK_URL;
    const secret = process.env.N8N_CHAT_SECRET;

    if (!url) {
      this.logger.error('Falta la variable de entorno N8N_CHAT_WEBHOOK_URL.');
      throw new ServiceUnavailableException(
        'El asistente no está disponible en este momento.',
      );
    }

    if (!secret && process.env.NODE_ENV === 'production') {
      this.logger.warn(
        'N8N_CHAT_SECRET no está configurado en producción (se enviará la petición sin header X-PumaIA-Secret).',
      );
    }

    const errCtx = {
      conversationId: p.conversationId,
      userMessageId: p.userMessageId,
    };
    const timeoutMs = Number(process.env.N8N_CHAT_TIMEOUT_MS) || 45_000;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(secret ? { 'X-PumaIA-Secret': secret } : {}),
        },
        body: JSON.stringify({
          id_alumno: p.studentId,
          conversationId: p.conversationId,
          sessionId: p.conversationId,
          message: p.message,
          chatInput: p.message,
          student_profile: p.profile,
          history: p.history,
          sensitive: p.sensitive, // n8n no debe guardar ni analizar esta conversación
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));

      if (!response.ok) {
        this.logger.error(`n8n respondió HTTP ${response.status}`);
        throw new BadGatewayException({
          code: 'N8N_HTTP_ERROR',
          message: 'El asistente no pudo responder.',
          ...errCtx,
        });
      }

      const raw = (await response.text()).trim();
      if (!raw) {
        this.logger.warn(
          'n8n respondió con cuerpo vacío (¿falta el nodo Respond to Webhook?).',
        );
        throw new BadGatewayException({
          code: 'N8N_EMPTY_RESPONSE',
          message: 'El asistente devolvió una respuesta vacía.',
          ...errCtx,
        });
      }

      const text = this.extractAiText(raw);
      if (!text) {
        this.logger.warn('n8n devolvió un payload sin texto utilizable.');
        throw new BadGatewayException({
          code: 'N8N_INVALID_PAYLOAD',
          message: 'El asistente no devolvió texto utilizable.',
          ...errCtx,
        });
      }
      return text;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      const timeout = error?.name === 'AbortError';
      this.logger.error(
        `n8n ${timeout ? 'timeout' : 'conexión'}: ${error?.message || error}`,
      );
      throw new BadGatewayException({
        code: timeout ? 'N8N_TIMEOUT' : 'N8N_CONNECTION_ERROR',
        message: timeout
          ? 'El asistente tardó demasiado en responder.'
          : 'No fue posible conectar con el asistente.',
        ...errCtx,
      });
    }
  }

  private extractAiText(raw: string): string {
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      return raw;
    }
    const pick = (o: any): string => {
      if (typeof o === 'string') return o.trim();
      if (!o || typeof o !== 'object') return '';
      for (const k of ['output', 'response', 'message', 'text', 'content']) {
        if (typeof o[k] === 'string' && o[k].trim()) return o[k].trim();
      }
      return '';
    };
    return Array.isArray(data) ? pick(data[0]) : pick(data);
  }

  // ------------------------------------------------------------------ gestión de conversación

  async updateConversationSensitive(
    id: string,
    studentId: string,
    userId: string,
    dto: UpdateConversationSensitiveDto,
  ) {
    await this.getOwnedConversation(id, studentId);
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

  /** Elegible solo si NO es sensible y el dueño tiene vigente el consentimiento indicado. */
  private async isEligible(
    conversationId: string,
    kind: ConsentKind,
  ): Promise<boolean> {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { student: { select: { userId: true } } },
    });
    if (!conv || conv.sensitive || !conv.student?.userId) return false;
    return this.consentsService.hasValidConsent(conv.student.userId, kind);
  }

  async isConversationEligibleForImprovement(
    conversationId: string,
  ): Promise<boolean> {
    return this.isEligible(conversationId, ConsentKind.IMPROVEMENT);
  }

  async isConversationEligibleForAnalytics(
    conversationId: string,
  ): Promise<boolean> {
    return this.isEligible(conversationId, ConsentKind.ANALYTICS);
  }

  async updateTitle(id: string, studentId: string, dto: UpdateConversationDto) {
    await this.getOwnedConversation(id, studentId);
    return this.prisma.conversation.update({
      where: { id },
      data: { title: dto.title.trim() },
    });
  }

  async deleteConversation(id: string, studentId: string, userId: string) {
    await this.getOwnedConversation(id, studentId);
    await this.prisma.conversation.delete({ where: { id } });
    await this.auditService.log({
      actorType: 'STUDENT',
      actorId: userId,
      action: 'CONVERSATION_DELETED',
      detail: { conversationId: id },
    });
    return { id, deleted: true };
  }

  async submitFeedback(
    messageId: string,
    studentId: string,
    dto: MessageFeedbackDto,
  ) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { conversation: true },
    });
    if (!message) throw new NotFoundException('Mensaje no encontrado.');
    if (message.conversation.studentId !== studentId) {
      throw new ForbiddenException(
        'No tienes autorización para retroalimentar este mensaje.',
      );
    }
    if (message.role !== RolMensaje.ASSISTANT) {
      throw new BadRequestException(
        'Solo se puede calificar una respuesta del asistente.',
      );
    }
    const comment = dto.comment?.trim() || null;
    return this.prisma.messageFeedback.upsert({
      where: { messageId },
      update: { value: dto.value, comment },
      create: { messageId, value: dto.value, comment },
    });
  }

  // ------------------------------------------------------------------ resúmenes psicológicos

  private async getOwnedSummary(summaryId: string, studentId: string) {
    const summary = await this.prisma.psychologicalSummary.findUnique({
      where: { id: summaryId },
    });
    if (!summary || summary.studentId !== studentId)
      throw new NotFoundException('Resumen no encontrado.');
    return summary;
  }

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

  async createPsychologicalSummary(
    studentId: string,
    userId: string,
    dto: CreatePsychologicalSummaryDto,
  ) {
    if (dto.conversationId) {
      await this.getOwnedConversation(dto.conversationId, studentId);
      await this.prisma.conversation.update({
        where: { id: dto.conversationId },
        data: { sensitive: true },
      });
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
      },
    });
    return created;
  }

  /** Editar un resumen aprobado o compartido lo regresa a DRAFT y corta el acceso del destinatario. */
  async updatePsychologicalSummaryContent(
    summaryId: string,
    studentId: string,
    userId: string,
    dto: UpdatePsychologicalSummaryDto,
  ) {
    const summary = await this.getOwnedSummary(summaryId, studentId);
    const updated = await this.prisma.psychologicalSummary.update({
      where: { id: summaryId },
      data: {
        content: dto.content.trim(),
        status: SummaryStatus.DRAFT,
        approvedAt: null,
        sharedAt: null,
        recipientId: null,
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

  async approvePsychologicalSummary(
    summaryId: string,
    studentId: string,
    userId: string,
  ) {
    const summary = await this.getOwnedSummary(summaryId, studentId);
    if (summary.status !== SummaryStatus.DRAFT) {
      throw new BadRequestException(
        `Solo se pueden aprobar resúmenes en estado borrador (DRAFT). Estado actual: ${summary.status}.`,
      );
    }
    const updated = await this.prisma.psychologicalSummary.update({
      where: { id: summaryId },
      data: { status: SummaryStatus.APPROVED, approvedAt: new Date() },
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
   * Hoy RoleType no tiene un rol de psicólogo/orientador. Mientras se crea (p. ej. COUNSELOR),
   * los destinatarios válidos se declaran en COUNSELOR_USER_IDS (ids de User separados por coma).
   */
  private isValidRecipient(recipientId: string): boolean {
    const allowed = (process.env.COUNSELOR_USER_IDS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return allowed.includes(recipientId);
  }

  async sharePsychologicalSummary(
    summaryId: string,
    studentId: string,
    userId: string,
    recipientId: string,
  ) {
    const summary = await this.getOwnedSummary(summaryId, studentId);
    if (summary.status !== SummaryStatus.APPROVED) {
      throw new BadRequestException(
        'El estudiante debe aprobar explícitamente el resumen (estado APPROVED) antes de poder compartirlo.',
      );
    }
    if (recipientId === userId || !this.isValidRecipient(recipientId)) {
      throw new BadRequestException(
        'El destinatario no es un orientador o especialista autorizado.',
      );
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

  async getSharedPsychologicalSummaryForRecipient(
    summaryId: string,
    recipientUserId: string,
  ) {
    const summary = await this.prisma.psychologicalSummary.findUnique({
      where: { id: summaryId },
    });
    // Misma respuesta si no existe o no es para ti: no revelar qué ids existen.
    if (
      !summary ||
      summary.recipientId !== recipientUserId ||
      summary.status !== SummaryStatus.SHARED
    ) {
      await this.auditService.log({
        actorType: 'SYSTEM',
        actorId: recipientUserId,
        action: 'PSYCHOLOGICAL_SUMMARY_ACCESS_DENIED',
        detail: { summaryId },
      });
      throw new NotFoundException('Resumen no encontrado o sin acceso.');
    }
    await this.auditService.log({
      actorType: 'SYSTEM',
      actorId: recipientUserId,
      action: 'PSYCHOLOGICAL_SUMMARY_RECIPIENT_READ',
      detail: { summaryId, studentId: summary.studentId },
    });
    return summary;
  }

  async revokePsychologicalSummary(
    summaryId: string,
    studentId: string,
    userId: string,
  ) {
    const summary = await this.getOwnedSummary(summaryId, studentId);
    if (summary.status !== SummaryStatus.SHARED) {
      throw new BadRequestException(
        'Solo se puede revocar un resumen que está compartido.',
      );
    }
    const updated = await this.prisma.psychologicalSummary.update({
      where: { id: summaryId },
      data: { status: SummaryStatus.REVOKED, revokedAt: new Date() },
    });
    await this.auditService.log({
      actorType: 'STUDENT',
      actorId: userId,
      action: 'PSYCHOLOGICAL_SUMMARY_REVOKED',
      detail: { summaryId },
    });
    return updated;
  }

  // ------------------------------------------------------------------ etiquetas

  /** Solo el dueño, solo conversaciones no sensibles y solo con consentimiento ANALYTICS. */
  async addConversationLabel(
    conversationId: string,
    studentId: string,
    userId: string,
    dto: AddConversationLabelDto,
  ) {
    const conv = await this.getOwnedConversation(conversationId, studentId);
    if (conv.sensitive) {
      throw new ForbiddenException(
        'Las conversaciones marcadas como sensibles están excluidas de clasificación temática y analítica.',
      );
    }
    const consent = await this.consentsService.hasValidConsent(
      userId,
      ConsentKind.ANALYTICS,
    );
    if (!consent) {
      throw new ForbiddenException(
        'No has otorgado consentimiento para analítica (ANALYTICS).',
      );
    }
    const topic = await this.prisma.topicCategory.findUnique({
      where: { id: dto.topicId },
    });
    if (!topic)
      throw new NotFoundException('Categoría temática no encontrada.');

    return this.prisma.conversationLabel.upsert({
      where: {
        conversationId_source_topicId: {
          conversationId,
          source: LabelSource.MANUAL,
          topicId: dto.topicId,
        },
      },
      update: {},
      create: {
        conversationId,
        topicId: dto.topicId,
        source: LabelSource.MANUAL,
      },
      include: { topic: true },
    });
  }

  async getConversationLabels(conversationId: string, studentId: string) {
    await this.getOwnedConversation(conversationId, studentId);
    return this.prisma.conversationLabel.findMany({
      where: { conversationId },
      include: { topic: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
