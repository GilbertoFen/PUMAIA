import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ChatService } from './chat.service';
import { CreateMessageDto, UpdateConversationDto } from './dto/chat.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('chat')
@UseGuards(AuthGuard('jwt'))
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  async getConversations(@Req() req) {
    return this.chatService.getConversations(req.user.userId);
  }

  @Get('conversations/:id/messages')
  async getMessages(@Req() req, @Param('id') id: string) {
    return this.chatService.getMessages(id, req.user.userId);
  }

  @Post('message')
  async sendMessage(@Req() req, @Body() dto: CreateMessageDto) {
    return this.chatService.handleMessage(req.user.userId, dto);
  }

  @Patch('conversations/:id')
  async updateTitle(
    @Req() req, 
    @Param('id') id: string, 
    @Body() dto: UpdateConversationDto
  ) {
    return this.chatService.updateTitle(id, req.user.userId, dto);
  }

  @Delete('conversations/:id')
  async delete(@Req() req, @Param('id') id: string) {
    return this.chatService.deleteConversation(id, req.user.userId);
  }
}