import { Injectable, NotFoundException, ForbiddenException,InternalServerErrorException } from '@nestjs/common';
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

  async handleMessage(studentId: string, dto: CreateMessageDto) {
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

    // 2. Guardar mensaje del usuario en Supabase
    await this.prisma.message.create({
      data: {
        conversationId,
        role: 'USER',
        content: dto.content,
      },
    });

    try {
      // 3. LLAMADA CON FETCH A RENDER
      const response = await fetch('https://server-genai.onrender.com/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: dto.content }),
      });

      // Fetch no lanza error en 4xx o 5xx, hay que validarlo manualmente
      if (!response.ok) {
        throw new Error(`Error en el servidor de IA: ${response.statusText}`);
      }

      const data = await response.json();
      const aiResponse = data.response;

      // 4. Guardar respuesta de la IA en Supabase
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