import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { LabelingService } from './labeling.service';
import { AddLabelsDto, LabelingQueueQueryDto } from './labeling.dto';
import { JwtAuthGuard } from '../../autenticacion/guards/jwt-auth.guard';
import { RolesGuard } from '../../autenticacion/guards/roles.guard';
import { Roles } from '../../autenticacion/decorators/roles.decorator';
import { CurrentUser } from '../../autenticacion/decorators/current-user.decorator';
import type { AuthUser } from '../../autenticacion/interfaces/auth-user.interface';

/**
 * Etiquetado manual de temas del chat. Solo ANALYST (el equipo que etiqueta),
 * porque implica leer el contenido de conversaciones.
 */
@Controller('metrics/labeling')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.ANALYST)
export class LabelingController {
  constructor(private readonly labeling: LabelingService) {}

  @Get('topics')
  topics() {
    return this.labeling.topics();
  }

  @Get('queue')
  queue(@Query() q: LabelingQueueQueryDto, @CurrentUser() user: AuthUser) {
    return this.labeling.queue(user.userId, q.limit);
  }

  @Post(':conversationId/skip')
  skip(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.labeling.skip(user.userId, conversationId);
  }

  @Post(':conversationId')
  addLabels(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() dto: AddLabelsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.labeling.addLabels(user.userId, conversationId, dto.topicIds);
  }

  @Delete(':conversationId/:topicId')
  removeLabel(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Param('topicId', ParseUUIDPipe) topicId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.labeling.removeLabel(user.userId, conversationId, topicId);
  }
}
