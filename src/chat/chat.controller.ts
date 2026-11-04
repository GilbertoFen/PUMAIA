import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import {
  CreateMessageDto,
  UpdateConversationDto,
  UpdateConversationSensitiveDto,
  MessageFeedbackDto,
  CreatePsychologicalSummaryDto,
  UpdatePsychologicalSummaryDto,
  SharePsychologicalSummaryDto,
  AddConversationLabelDto,
} from './dto/chat.dto';
import { JwtAuthGuard } from '../autenticacion/guards/jwt-auth.guard';
import { RolesGuard } from '../autenticacion/guards/roles.guard';
import { CurrentUser } from '../autenticacion/decorators/current-user.decorator';
import type { AuthUser } from '../autenticacion/interfaces/auth-user.interface';
import { RoleType } from '@prisma/client';

@Controller('chat')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  async getConversations(@CurrentUser() user: AuthUser) {
    if (!user || !user.studentId) {
      throw new BadRequestException('El usuario no cuenta con un perfil de estudiante vinculado.');
    }
    return this.chatService.getConversations(user.studentId);
  }

  @Get('conversations/:id/messages')
  async getMessages(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    if (!user || !user.studentId) {
      throw new BadRequestException('El usuario no cuenta con un perfil de estudiante vinculado.');
    }
    return this.chatService.getMessages(id, user.studentId);
  }

  @Post('message')
  async sendMessage(@CurrentUser() user: AuthUser, @Body() dto: CreateMessageDto) {
    if (!user || !user.studentId) {
      throw new BadRequestException('El usuario no cuenta con un perfil de estudiante vinculado.');
    }
    return this.chatService.handleMessage(user.studentId, user.userId, dto);
  }

  @Post('message/n8n')
  async chatN8nWebhook(@CurrentUser() user: AuthUser, @Body() dto: CreateMessageDto) {
    if (!user || !user.studentId) {
      throw new BadRequestException('El usuario no cuenta con un perfil de estudiante vinculado.');
    }
    return this.chatService.chatN8nWebhook(user.studentId, user.userId, dto);
  }

  @Patch('conversations/:id')
  async updateTitle(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateConversationDto,
  ) {
    if (!user || !user.studentId) {
      throw new BadRequestException('El usuario no cuenta con un perfil de estudiante vinculado.');
    }
    return this.chatService.updateTitle(id, user.studentId, dto);
  }

  @Patch('conversations/:id/sensitive')
  async updateSensitive(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateConversationSensitiveDto,
  ) {
    if (!user || !user.studentId) {
      throw new BadRequestException('El usuario no cuenta con un perfil de estudiante vinculado.');
    }
    return this.chatService.updateConversationSensitive(
      id,
      user.studentId,
      user.userId,
      dto,
    );
  }

  @Delete('conversations/:id')
  async delete(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    if (!user || !user.studentId) {
      throw new BadRequestException('El usuario no cuenta con un perfil de estudiante vinculado.');
    }
    return this.chatService.deleteConversation(id, user.studentId);
  }

  @Post('messages/:id/feedback')
  async submitFeedback(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: MessageFeedbackDto,
  ) {
    if (!user || !user.studentId) {
      throw new BadRequestException('El usuario no cuenta con un perfil de estudiante vinculado.');
    }
    return this.chatService.submitFeedback(id, user.studentId, dto);
  }

  @Get('psychological-summaries')
  async getMySummaries(@CurrentUser() user: AuthUser) {
    if (!user || !user.studentId) {
      throw new BadRequestException('El usuario no cuenta con un perfil de estudiante vinculado.');
    }
    return this.chatService.getMyPsychologicalSummaries(user.studentId, user.userId);
  }

  @Post('psychological-summaries')
  async createSummary(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePsychologicalSummaryDto,
  ) {
    if (!user || !user.studentId) {
      throw new BadRequestException('El usuario no cuenta con un perfil de estudiante vinculado.');
    }
    return this.chatService.createPsychologicalSummary(
      user.studentId,
      user.userId,
      dto,
    );
  }

  @Patch('psychological-summaries/:id')
  async updateSummaryContent(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdatePsychologicalSummaryDto,
  ) {
    if (!user || !user.studentId) {
      throw new BadRequestException('El usuario no cuenta con un perfil de estudiante vinculado.');
    }
    return this.chatService.updatePsychologicalSummaryContent(
      id,
      user.studentId,
      user.userId,
      dto,
    );
  }

  @Post('psychological-summaries/:id/approve')
  async approveSummary(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    if (!user || !user.studentId) {
      throw new BadRequestException('El usuario no cuenta con un perfil de estudiante vinculado.');
    }
    return this.chatService.approvePsychologicalSummary(id, user.studentId, user.userId);
  }

  @Post('psychological-summaries/:id/share')
  async shareSummary(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SharePsychologicalSummaryDto,
  ) {
    if (!user || !user.studentId) {
      throw new BadRequestException('El usuario no cuenta con un perfil de estudiante vinculado.');
    }
    return this.chatService.sharePsychologicalSummary(
      id,
      user.studentId,
      user.userId,
      dto.recipientId,
    );
  }

  @Post('psychological-summaries/:id/revoke')
  async revokeSummary(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    if (!user || !user.studentId) {
      throw new BadRequestException('El usuario no cuenta con un perfil de estudiante vinculado.');
    }
    return this.chatService.revokePsychologicalSummary(id, user.studentId, user.userId);
  }

  @Get('psychological-summaries/shared/:id')
  async getSharedSummaryForRecipient(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.chatService.getSharedPsychologicalSummaryForRecipient(id, user.userId);
  }

  @Post('conversations/:id/labels')
  async addConversationLabel(
    @CurrentUser() user: AuthUser,
    @Param('id') conversationId: string,
    @Body() dto: AddConversationLabelDto,
  ) {
    const isAdmin = user.roles.includes(RoleType.INSTITUTION_ADMIN);
    const studentId = user.studentId || '';
    return this.chatService.addConversationLabel(
      conversationId,
      studentId,
      dto,
      isAdmin,
      user.userId,
    );
  }

  @Get('conversations/:id/labels')
  async getConversationLabels(
    @CurrentUser() user: AuthUser,
    @Param('id') conversationId: string,
  ) {
    const isAdmin = user.roles.includes(RoleType.INSTITUTION_ADMIN);
    const studentId = user.studentId || '';
    return this.chatService.getConversationLabels(conversationId, studentId, isAdmin);
  }
}
