import {
  Controller,
  Body,
  Get,
  Post,
  Param,
  UseGuards,
  Delete,
  Patch,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ContestService } from './contest.service';
import { CreateContestDto } from './dto/create-contest.dto';
import { EnrollStudentDto } from './dto/enroll-student.dto';
import { JwtAuthGuard } from '../autenticacion/guards/jwt-auth.guard';
import { RolesGuard } from '../autenticacion/guards/roles.guard';
import { Roles } from '../autenticacion/decorators/roles.decorator';
import { CurrentUser } from '../autenticacion/decorators/current-user.decorator';
import type { AuthUser } from '../autenticacion/interfaces/auth-user.interface';
import { RoleType } from '@prisma/client';

@Controller('contests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContestController {
  constructor(private readonly service: ContestService) {}

  @Get()
  async findAll() {
    return this.service.findAll();
  }

  @Post()
  @Roles(RoleType.INSTITUTION_ADMIN)
  async create(@Body() dto: CreateContestDto) {
    return this.service.create(dto);
  }

  @Post('enroll')
  async enroll(
    @CurrentUser() user: AuthUser,
    @Body() dto: EnrollStudentDto,
  ) {
    const isStudent = user.roles.includes(RoleType.STUDENT);
    const targetStudentId = isStudent ? user.studentId : (dto.studentId || user.studentId);

    if (!targetStudentId) {
      throw new BadRequestException('El estudiante no cuenta con un perfil vinculado.');
    }

    const registration = await this.service.enroll({
      studentId: targetStudentId,
      contestId: dto.contestId,
    });

    const studentName = registration?.student?.user
      ? `${registration.student.user.name} ${registration.student.user.lastNameP}`.trim()
      : registration?.student?.accountNumber?.toString() || 'Alumno';

    return {
      message: 'Inscripción exitosa',
      details: {
        alumno: studentName,
        concurso_asignado: registration?.contest?.name,
        fecha_registro: new Date().toISOString(),
      },
    };
  }

  @Get('student/:id')
  async getStudentContests(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    const isStudent = user.roles.includes(RoleType.STUDENT);
    const isAdmin = user.roles.includes(RoleType.INSTITUTION_ADMIN);

    if (isStudent && !isAdmin && user.studentId !== id) {
      throw new ForbiddenException('No tienes autorización para consultar los concursos de otro estudiante.');
    }

    const list = await this.service.findByStudent(id);

    return {
      count: list.length,
      participations: list.map((item) => ({
        id_registro: item.id,
        nombre_concurso: item.contest.name.toUpperCase(),
      })),
    };
  }

  @Patch('enrollment/:id')
  async updateEnrollment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body('contestId') contestId: string,
  ) {
    const isAdmin = user.roles.includes(RoleType.INSTITUTION_ADMIN);
    const studentIdFilter = isAdmin ? undefined : user.studentId || undefined;

    return this.service.updateEnrollment(id, { contestId }, studentIdFilter);
  }

  @Delete('enrollment/:id')
  async removeEnrollment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    const isAdmin = user.roles.includes(RoleType.INSTITUTION_ADMIN);
    const studentIdFilter = isAdmin ? undefined : user.studentId || undefined;

    return this.service.removeEnrollment(id, studentIdFilter);
  }
}
