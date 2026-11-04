import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { KnowledgeAreaService } from './knowledgeArea.service';
import { CreateKnowledgeAreaDto } from './dto/createKnowledgeArea.dto';
import { UpdateKnowledgeAreaDto } from './dto/update-studentKnowledgeArea.dto';
import { JwtAuthGuard } from '../autenticacion/guards/jwt-auth.guard';
import { RolesGuard } from '../autenticacion/guards/roles.guard';
import { Roles } from '../autenticacion/decorators/roles.decorator';
import { RoleType } from '@prisma/client';

@Controller('knowledge-area')
export class KnowledgeAreaController {
  constructor(private readonly knowledgeAreaService: KnowledgeAreaService) {}

  @Get('')
  async getAllKnowledgeAreas() {
    try {
      return await this.knowledgeAreaService.getAllKnowledgeAreas();
    } catch (error) {
      console.error('ERROR EN GET ALL KNOWLEDGE AREAS:', error);
      throw error;
    }
  }

  @Get(':id')
  async getKnowledgeAreaById(@Param('id') id: string) {
    try {
      return await this.knowledgeAreaService.getKnowledgeAreaById(id);
    } catch (error) {
      console.error('ERROR EN GET KNOWLEDGE AREA BY ID:', error);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.INSTITUTION_ADMIN)
  @Post('')
  async createKnowledgeArea(@Body() dto: CreateKnowledgeAreaDto) {
    try {
      return await this.knowledgeAreaService.createKnowledgeArea(dto);
    } catch (error) {
      console.error('ERROR EN POST KNOWLEDGE AREA:', error);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.INSTITUTION_ADMIN)
  @Put(':id')
  async updateKnowledgeArea(@Body() dto: UpdateKnowledgeAreaDto, @Param('id') id: string) {
    try {
      return await this.knowledgeAreaService.updateKnowledgeArea(id, dto);
    } catch (error) {
      console.error('ERROR EN UPDATE KNOWLEDGE AREA:', error);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.INSTITUTION_ADMIN)
  @Delete(':id')
  async deleteKnowledgeArea(@Param('id') id: string) {
    try {
      return await this.knowledgeAreaService.deleteKnowledgeArea(id);
    } catch (error) {
      console.error('ERROR EN DELETE KNOWLEDGE AREA:', error);
      throw error;
    }
  }
}
