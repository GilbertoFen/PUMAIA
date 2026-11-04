import {
  Controller,
  Body,
  Get,
  Post,
  Param,
  Patch,
  UseGuards,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import 'multer';
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { JwtAuthGuard } from '../autenticacion/guards/jwt-auth.guard';
import { RolesGuard } from '../autenticacion/guards/roles.guard';
import { Roles } from '../autenticacion/decorators/roles.decorator';
import { CurrentUser } from '../autenticacion/decorators/current-user.decorator';
import type { AuthUser } from '../autenticacion/interfaces/auth-user.interface';
import { RoleType } from '@prisma/client';

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentsController {
  constructor(private readonly service: StudentsService) {}

  /**
   * Lista todos los estudiantes (exclusivamente accesible para administradores institucionales).
   * Los analistas únicamente tienen acceso a métricas agregadas anonimizadas en /api/metrics/*.
   */
  @Get()
  @Roles(RoleType.INSTITUTION_ADMIN)
  async findAll() {
    const students = await this.service.findAll();
    return students.map((student) => ({
      id: student.id,
      accountNumber: student.accountNumber,
      fullName: `${student.user.name} ${student.user.lastNameP} ${student.user.lastNameM || ''}`.trim().toUpperCase(),
      academicInfo: {
        semester: student.currentSemester,
        average: student.average,
        career: student.career?.name || 'No asignada',
      },
      interest: student.interest,
    }));
  }

  /**
   * Obtiene el expediente académico y personal del alumno autenticado.
   */
  @Get('profile-summary')
  async getProfile(@CurrentUser() user: AuthUser) {
    if (!user.studentId) {
      throw new BadRequestException('El usuario autenticado no posee un perfil de alumno asociado.');
    }
    return this.service.getFullProfileSummary(user.studentId);
  }

  /**
   * Consulta por número de cuenta (alumnos solo pueden consultar su propia cuenta).
   */
  @Get('account/:accountNumber')
  async findOne(
    @Param('accountNumber') accountNumber: string,
    @CurrentUser() user: AuthUser,
  ) {
    const parsedAccount = parseInt(accountNumber, 10);
    if (isNaN(parsedAccount)) {
      throw new BadRequestException('El número de cuenta debe ser numérico.');
    }

    // Regla de aislamiento: un alumno solo puede consultar su propia información
    const isStudent = user.roles.includes(RoleType.STUDENT);
    const isAdmin = user.roles.includes(RoleType.INSTITUTION_ADMIN);

    if (isStudent && !isAdmin && user.accountNumber !== parsedAccount) {
      throw new ForbiddenException('No tienes autorización para consultar la información de otro alumno.');
    }

    const student = await this.service.findByAccountNumber(parsedAccount);

    if (!student) {
      throw new NotFoundException('Alumno no encontrado');
    }

    const career = student.career?.name || 'Carrera no asignada';

    return {
      id: student.id,
      accountNumber: student.accountNumber,
      fullName: `${student.user.name} ${student.user.lastNameP} ${student.user.lastNameM || ''}`.trim().toUpperCase(),
      academicInfo: {
        semester: student.currentSemester,
        average: student.average,
        career,
      },
      interest: student.interest,
    };
  }

  /**
   * Consulta por email (administradores).
   */
  @Get('by-email/:email')
  @Roles(RoleType.INSTITUTION_ADMIN)
  async findByEmail(@Param('email') email: string) {
    const student = await this.service.findByEmail(email);
    if (!student) throw new NotFoundException('Alumno no encontrado');

    return student;
  }

  /**
   * Creación administrativa de alumnos.
   */
  @Post()
  @Roles(RoleType.INSTITUTION_ADMIN)
  async create(@Body() dto: CreateStudentDto) {
    return this.service.create(dto);
  }

  /**
   * Asignación de concursos.
   */
  @Post('assign-contest')
  async assignContest(
    @CurrentUser() user: AuthUser,
    @Body() data: { studentId?: string; contestId: string },
  ) {
    if (!data.contestId) {
      throw new BadRequestException('El contestId es obligatorio.');
    }

    // Usar studentId autenticado a menos que sea admin
    const targetStudentId =
      user.roles.includes(RoleType.INSTITUTION_ADMIN) && data.studentId
        ? data.studentId
        : user.studentId;

    if (!targetStudentId) {
      throw new BadRequestException('No se pudo resolver el perfil del estudiante.');
    }

    return this.service.assignContest(targetStudentId, data.contestId);
  }

  /**
   * Actualización de intereses del alumno autenticado.
   */
  @Patch('interests')
  async updateInterests(
    @CurrentUser() user: AuthUser,
    @Body('interest') interest: string,
  ) {
    if (!user.studentId) {
      throw new BadRequestException('Solo alumnos pueden actualizar sus intereses.');
    }

    if (typeof interest !== 'string') {
      throw new BadRequestException('La propiedad "interest" debe ser una cadena de texto válida.');
    }

    return this.service.updateInterests(user.studentId, interest);
  }

  /**
   * Carga de avatar a Cloudinary.
   */
  @Post('avatar')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No se recibió ningún archivo de imagen.');
    }

    if (!user.studentId) {
      throw new BadRequestException('Solo los alumnos pueden cargar avatar mediante este endpoint.');
    }

    return this.service.uploadAvatar(user.studentId, file);
  }
}
