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
  ParseUUIDPipe,
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

function requireStudent(user: AuthUser): string {
  if (!user?.studentId) {
    throw new BadRequestException(
      'El usuario no cuenta con un perfil de estudiante vinculado.',
    );
  }
  return user.studentId;
}

@Controller('chat')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  getConversations(@CurrentUser() user: AuthUser) {
    return this.chatService.getConversations(requireStudent(user));
  }

  @Get('conversations/:id/messages')
  getMessages(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.chatService.getMessages(id, requireStudent(user));
  }

  /** Único punto de entrada al asistente (n8n). */
  @Post('message')
  sendMessage(@CurrentUser() user: AuthUser, @Body() dto: CreateMessageDto) {
    return this.chatService.handleMessage(
      requireStudent(user),
      user.userId,
      dto,
    );
  }

  /** Alias antiguo para no romper el front; se puede borrar cuando el front use /chat/message. */
  @Post('message/n8n')
  sendMessageLegacy(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateMessageDto,
  ) {
    return this.chatService.handleMessage(
      requireStudent(user),
      user.userId,
      dto,
    );
  }

  @Patch('conversations/:id')
  updateTitle(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConversationDto,
  ) {
    return this.chatService.updateTitle(id, requireStudent(user), dto);
  }

  @Patch('conversations/:id/sensitive')
  updateSensitive(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConversationSensitiveDto,
  ) {
    return this.chatService.updateConversationSensitive(
      id,
      requireStudent(user),
      user.userId,
      dto,
    );
  }

  @Delete('conversations/:id')
  delete(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.chatService.deleteConversation(
      id,
      requireStudent(user),
      user.userId,
    );
  }

  @Post('messages/:id/feedback')
  submitFeedback(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MessageFeedbackDto,
  ) {
    return this.chatService.submitFeedback(id, requireStudent(user), dto);
  }

  // ---------- Resúmenes psicológicos ----------

  @Get('psychological-summaries')
  getMySummaries(@CurrentUser() user: AuthUser) {
    return this.chatService.getMyPsychologicalSummaries(
      requireStudent(user),
      user.userId,
    );
  }

  // Ruta fija antes de las rutas con :id
  @Get('psychological-summaries/shared/:id')
  getSharedSummaryForRecipient(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.chatService.getSharedPsychologicalSummaryForRecipient(
      id,
      user.userId,
    );
  }

  @Post('psychological-summaries')
  createSummary(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePsychologicalSummaryDto,
  ) {
    return this.chatService.createPsychologicalSummary(
      requireStudent(user),
      user.userId,
      dto,
    );
  }

  @Patch('psychological-summaries/:id')
  updateSummaryContent(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePsychologicalSummaryDto,
  ) {
    return this.chatService.updatePsychologicalSummaryContent(
      id,
      requireStudent(user),
      user.userId,
      dto,
    );
  }

  @Post('psychological-summaries/:id/approve')
  approveSummary(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.chatService.approvePsychologicalSummary(
      id,
      requireStudent(user),
      user.userId,
    );
  }

  @Post('psychological-summaries/:id/share')
  shareSummary(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SharePsychologicalSummaryDto,
  ) {
    return this.chatService.sharePsychologicalSummary(
      id,
      requireStudent(user),
      user.userId,
      dto.recipientId,
    );
  }

  @Post('psychological-summaries/:id/revoke')
  revokeSummary(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.chatService.revokePsychologicalSummary(
      id,
      requireStudent(user),
      user.userId,
    );
  }

  // ---------- Etiquetas (solo el dueño de la conversación) ----------

  @Post('conversations/:id/labels')
  addConversationLabel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Body() dto: AddConversationLabelDto,
  ) {
    return this.chatService.addConversationLabel(
      conversationId,
      requireStudent(user),
      user.userId,
      dto,
    );
  }

  @Get('conversations/:id/labels')
  getConversationLabels(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) conversationId: string,
  ) {
    return this.chatService.getConversationLabels(
      conversationId,
      requireStudent(user),
    );
  }
}
