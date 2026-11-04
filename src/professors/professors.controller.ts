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
import { ProfessorsService } from './professors.service';
import { CreateProfessorDto } from './dto/create-professor.dto';
import { UpdateProfessorDto } from './dto/update-professor.dto';
import { CreateStudyDto } from './dto/create-study.dto';
import { CreatePublicationDto } from './dto/create-publication.dto';
import { JwtAuthGuard } from '../autenticacion/guards/jwt-auth.guard';
import { RolesGuard } from '../autenticacion/guards/roles.guard';
import { Roles } from '../autenticacion/decorators/roles.decorator';
import { RoleType } from '@prisma/client';

@Controller('professors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProfessorsController {
  constructor(private readonly service: ProfessorsService) {}

  @Get()
  async findAll(
    @Query('active') active?: string,
    @Query('search') search?: string,
  ) {
    const isActive = active !== undefined ? active === 'true' : undefined;
    return this.service.findAll(isActive, search);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(RoleType.INSTITUTION_ADMIN)
  async create(@Body() dto: CreateProfessorDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles(RoleType.INSTITUTION_ADMIN)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProfessorDto,
  ) {
    return this.service.update(id, dto);
  }

  @Post(':id/studies')
  @Roles(RoleType.INSTITUTION_ADMIN)
  async addStudy(
    @Param('id') id: string,
    @Body() dto: CreateStudyDto,
  ) {
    return this.service.addStudy(id, dto);
  }

  @Post(':id/publications')
  @Roles(RoleType.INSTITUTION_ADMIN)
  async addPublication(
    @Param('id') id: string,
    @Body() dto: CreatePublicationDto,
  ) {
    return this.service.addPublication(id, dto);
  }

  @Post(':id/subjects/:subjectId')
  @Roles(RoleType.INSTITUTION_ADMIN)
  async assignSubject(
    @Param('id') id: string,
    @Param('subjectId') subjectId: string,
  ) {
    return this.service.assignSubject(id, subjectId);
  }

  @Delete(':id')
  @Roles(RoleType.INSTITUTION_ADMIN)
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
