import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Patch,
  UseGuards,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ProfessionalExperienceService } from './professional-experience.service';
import { CreateProfessionalExperienceDto } from './dto/create-professional-experience.dto';
import { JwtAuthGuard } from '../autenticacion/guards/jwt-auth.guard';
import { RolesGuard } from '../autenticacion/guards/roles.guard';
import { CurrentUser } from '../autenticacion/decorators/current-user.decorator';
import type { AuthUser } from '../autenticacion/interfaces/auth-user.interface';
import { RoleType } from '@prisma/client';

@Controller('professional-experience')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProfessionalExperienceController {
  constructor(private readonly service: ProfessionalExperienceService) {}

  @Post()
  async assign(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateProfessionalExperienceDto,
  ) {
    const isStudent = user.roles.includes(RoleType.STUDENT);
    const targetStudentId = isStudent ? user.studentId : (dto.studentId || user.studentId);

    if (!targetStudentId) {
      throw new BadRequestException('El usuario no cuenta con un perfil de estudiante vinculado.');
    }

    const record = await this.service.assign({
      ...dto,
      studentId: targetStudentId,
    });

    const studentName = record.student?.user
      ? `${record.student.user.name} ${record.student.user.lastNameP}`.trim()
      : record.student?.accountNumber?.toString() || 'Alumno';

    return {
      message: 'Experiencia asignada correctamente',
      assignment: {
        student: studentName,
        expertise: record.areaExpertise.name,
        category_id: record.categoryId,
      },
    };
  }

  @Get('student/:id')
  async getStudentExperience(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    const isStudent = user.roles.includes(RoleType.STUDENT);
    const isAdmin = user.roles.includes(RoleType.INSTITUTION_ADMIN);

    if (isStudent && !isAdmin && user.studentId !== id) {
      throw new ForbiddenException('No tienes autorización para consultar la experiencia de otro estudiante.');
    }

    const experiences = await this.service.findByStudent(id);

    return {
      total: experiences.length,
      skills: experiences.map((exp) => ({
        id_relacion: exp.id,
        area: exp.areaExpertise.name,
        categoria: exp.categoryId,
      })),
    };
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: { areaExpertiseId?: string; categoryId?: string },
  ) {
    const isAdmin = user.roles.includes(RoleType.INSTITUTION_ADMIN);
    const studentIdFilter = isAdmin ? undefined : user.studentId || undefined;

    return this.service.update(id, dto, studentIdFilter);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    const isAdmin = user.roles.includes(RoleType.INSTITUTION_ADMIN);
    const studentIdFilter = isAdmin ? undefined : user.studentId || undefined;

    return this.service.remove(id, studentIdFilter);
  }

  @Post('analyze')
  async analyzeExperience(
    @CurrentUser() user: AuthUser,
    @Body('text') text: string,
  ) {
    if (!user || !user.studentId) {
      throw new BadRequestException('El usuario no cuenta con un perfil de estudiante vinculado.');
    }

    return this.service.parseAndSaveExperience(user.studentId, text);
  }
}
