import { Injectable, NotFoundException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto, UpdateConversationDto } from './dto/chat.dto';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) { }

  async getConversations(studentId: string) {
    return this.prisma.conversation.findMany({
      where: { studentId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getMessages(conversationId: string, studentId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conv) throw new NotFoundException('Conversación no encontrada');
    if (conv.studentId !== studentId) throw new ForbiddenException('No tienes acceso');

    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async handleMessage(studentId: string, dto: CreateMessageDto) { // Asumiendo que dto tiene { conversationId?, content }
    let conversationId = dto.conversationId;

    // 1. Lógica de Conversación (Nueva o Existente)
    if (!conversationId) {
      const newConv = await this.prisma.conversation.create({
        data: {
          studentId,
          title: dto.content.substring(0, 40),
        },
      });
      conversationId = newConv.id;
    }

    // 2. Guardar mensaje del usuario en la Base de Datos
    await this.prisma.message.create({
      data: {
        conversationId,
        role: 'USER',
        content: dto.content,
      },
    });

    // 3. RECUPERAR EL HISTORIAL DE LA CONVERSACIÓN (Para la memoria de la IA)
    // Traemos los mensajes ordenados por fecha. Excluimos el que acabamos de guardar porque ese va en 'message'.
    const allMessages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' }
    });

    const historyForAI = allMessages.slice(0, -1).map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // 4. RECUPERAR EL PERFIL DEL ALUMNO (Para el contexto de la IA)
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        experiences: { include: { areaExpertise: true } },
        answers: true // Traemos el cuestionario
      }
    });

    // Extraemos un par de datos clave del cuestionario (Ajusta los IDs si es necesario)
    const modalidad = student?.answers.find(a => a.questionId === 'p4_modalidad_trabajo')?.answer || 'No especificada';
    const experiencia = student?.experiences.map(e => e.areaExpertise.name).join(', ') || 'Sin experiencia registrada';

    // Armamos el "Prompt de Sistema" con el perfil
    const studentProfileStr = `
      Nombre: ${student?.name} ${student?.lastNameP}.
      Semestre actual: ${student?.currentSemester}.
      Promedio: ${student?.average || 0}.
      Modalidad preferida: ${modalidad}.
      Experiencia previa: ${experiencia}.
    `;

    try {
      // 5. LLAMADA CON FETCH A RENDER (Mandando el paquete completo)
      const response = await fetch('https://server-genai.onrender.com/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: dto.content,
          student_profile: studentProfileStr,
          history: historyForAI
        }),
      });

      if (!response.ok) {
        throw new Error(`Error en el servidor de IA: ${response.statusText}`);
      }

      const data = await response.json();
      const aiResponse = data.response;

      // 6. Guardar respuesta de la IA en la Base de Datos
      return await this.prisma.message.create({
        data: {
          conversationId,
          role: 'ASSISTANT',
          content: aiResponse,
        },
      });

    } catch (error) {
      console.error('Error con fetch hacia Render:', error);
      throw new InternalServerErrorException('No se pudo obtener respuesta de la IA.');
    }
  }

  async updateTitle(id: string, studentId: string, dto: UpdateConversationDto) {
    // Validamos propiedad antes de editar
    const conv = await this.prisma.conversation.findFirst({
      where: { id, studentId }
    });

    if (!conv) throw new NotFoundException('Conversación no encontrada');

    return this.prisma.conversation.update({
      where: { id },
      data: { title: dto.title },
    });
  }

  async deleteConversation(id: string, studentId: string) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id, studentId }
    });

    if (!conv) throw new NotFoundException('Conversación no encontrada');

    return this.prisma.conversation.delete({ where: { id } });
  }
}