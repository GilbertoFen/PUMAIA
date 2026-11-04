import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { KnowledgeDocumentsService } from './knowledge-documents.service';
import { CreateKnowledgeDocumentDto } from './dto/create-knowledge-document.dto';
import { UpdateKnowledgeDocumentDto } from './dto/update-knowledge-document.dto';
import { JwtAuthGuard } from '../autenticacion/guards/jwt-auth.guard';
import { RolesGuard } from '../autenticacion/guards/roles.guard';
import { Roles } from '../autenticacion/decorators/roles.decorator';
import { CurrentUser } from '../autenticacion/decorators/current-user.decorator';
import type { AuthUser } from '../autenticacion/interfaces/auth-user.interface';
import { RoleType, DocumentStatus } from '@prisma/client';

@Controller('knowledge-documents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class KnowledgeDocumentsController {
  constructor(private readonly service: KnowledgeDocumentsService) {}

  @Post()
  @Roles(RoleType.INSTITUTION_ADMIN)
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateKnowledgeDocumentDto,
  ) {
    return this.service.create(dto, user.userId);
  }

  @Get()
  @Roles(RoleType.INSTITUTION_ADMIN, RoleType.ANALYST)
  async findAll(
    @Query('status') status?: DocumentStatus,
    @Query('institutionId') institutionId?: string,
  ) {
    return this.service.findAll(status, institutionId);
  }

  @Get(':id')
  @Roles(RoleType.INSTITUTION_ADMIN, RoleType.ANALYST)
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Roles(RoleType.INSTITUTION_ADMIN)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateKnowledgeDocumentDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(RoleType.INSTITUTION_ADMIN)
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

