import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { GradeService } from './grade.service';
import { CreateGradeDto } from './dto/createGrade.dto';
import { UpdateGradeDto, ConfirmGradesDto } from './dto/updateGrade.dto';
import { JwtAuthGuard } from '../autenticacion/guards/jwt-auth.guard';
import { RolesGuard } from '../autenticacion/guards/roles.guard';
import { Roles } from '../autenticacion/decorators/roles.decorator';
import { CurrentUser } from '../autenticacion/decorators/current-user.decorator';
import type { AuthUser } from '../autenticacion/interfaces/auth-user.interface';
import { RoleType } from '@prisma/client';

@Controller('grade')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GradeController {
  constructor(private readonly gradeService: GradeService) {}

  /**
   * Consulta el historial académico del alumno autenticado.
   */
  @Get('my-grades')
  async getMyGrades(@CurrentUser() user: AuthUser) {
    if (!user.studentId) {
      throw new UnauthorizedException('No se pudo identificar el perfil de alumno asociado.');
    }
    return this.gradeService.getMyGrades(user.studentId);
  }

  /**
   * Confirma y registra las materias validadas tras la importación del PDF o edición del alumno.
   */
  @Post('confirm-import')
  async confirmImport(
    @CurrentUser() user: AuthUser,
    @Body() dto: ConfirmGradesDto,
  ) {
    if (!user.studentId) {
      throw new UnauthorizedException('No se pudo identificar el perfil de alumno asociado.');
    }
    return this.gradeService.saveConfirmedGrades(user.studentId, dto);
  }

  /**
   * Consulta general de inscripciones (restringido exclusivamente a administradores institucionales).
   * Los analistas consultan el rendimiento académico agregado en /api/metrics/academic-performance.
   */
  @Get('')
  @Roles(RoleType.INSTITUTION_ADMIN)
  async getAllGrades() {
    return this.gradeService.getAllGrades();
  }

  /**
   * Consulta una inscripción por ID.
   */
  @Get(':id')
  @Roles(RoleType.INSTITUTION_ADMIN)
  async getGradeById(@Param('id') id: string) {
    return this.gradeService.getGradeById(id);
  }

  /**
   * Crea una inscripción manualmente (administrador).
   */
  @Post('')
  @Roles(RoleType.INSTITUTION_ADMIN)
  async createGrade(@Body() dto: CreateGradeDto) {
    return this.gradeService.createGrade(dto);
  }

  /**
   * Actualiza una inscripción existente mediante PUT o PATCH (administrador).
   */
  @Put(':id')
  @Roles(RoleType.INSTITUTION_ADMIN)
  async updateGrade(@Body() dto: UpdateGradeDto, @Param('id') id: string) {
    return this.gradeService.updateGrade(id, dto);
  }

  @Patch(':id')
  @Roles(RoleType.INSTITUTION_ADMIN)
  async patchGrade(@Body() dto: UpdateGradeDto, @Param('id') id: string) {
    return this.gradeService.updateGrade(id, dto);
  }

  /**
   * Elimina una inscripción (administrador).
   */
  @Delete(':id')
  @Roles(RoleType.INSTITUTION_ADMIN)
  async deleteGrade(@Param('id') id: string) {
    return this.gradeService.deleteGrade(id);
  }
}
