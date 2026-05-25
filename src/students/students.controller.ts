import {
  Controller,
  Body, Get, Post, Delete, Request, Param, Req, Patch, UseGuards, BadRequestException, UseInterceptors, UploadedFile
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import 'multer';
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { NotFoundException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Controller('students')
@UseGuards(AuthGuard('jwt'))
export class StudentsController {
  constructor(private service: StudentsService) { }

  @Get()
  async findAll() {
    const students = await this.service.findAll();
    return students.map(student => ({
      accountNumber: student.accountNumber,
      fullName: `${student.name} ${student.lastNameP} ${student.lastNameM}`.toUpperCase(),
      academicInfo: {
        semester: student.currentSemester,
        average: student.average
      },
      interest: student.interest
    }));
  }
  @Get('profile-summary')
  async getProfile(@Req() req) {
    // req.user.id viene del token JWT mapeado por tu Guard
    return this.service.getFullProfileSummary(req.user.userId);
  }
  @Get(':email')
  async findByEmail(@Param('email') email: string) {
    const student = await this.service.findByEmail(email);
    if (!student) throw new NotFoundException('Alumno no encontrado');
    return {
      accountNumber: student.accountNumber,
      fullName: `${student.name} ${student.lastNameP} ${student.lastNameM}`.toUpperCase(),
      academicInfo: {
        semester: student.currentSemester,
        average: student.average
      },
      interest: student.interest
    };
  }

  @Get('account/:accountNumber')
  async findOne(@Param('accountNumber') accountNumber: string) {
    const student = await this.service.findByAccountNumber(parseInt(accountNumber));

    if (!student) throw new NotFoundException('Alumno no encontrado');
    const career = student.careers?.[0]?.career?.name || 'Carrera no asignada';

    return {
      accountNumber: student.accountNumber,
      fullName: `${student.name} ${student.lastNameP} ${student.lastNameM}`.toUpperCase(),
      academicInfo: {
        semester: student.currentSemester,
        average: student.average,
        career: career
      },
      interest: student.interest
    };
  }


  @Post()
  async create(@Body() dto: CreateStudentDto) {
    return await this.service.create(dto);
  }

  @Post('assign-contest')
  async asignContest(
    @Body() data: { studentId: string; contestId: string }
  ) {
    console.log(`Asignando concurso ${data.contestId} al alumno ${data.studentId}`);
    return await this.service.assignContest(data.studentId, data.contestId);
  }

  @Patch('interests')
  async updateInterests(@Req() req, @Body('interest') interest: string) {
    // Validación rápida: si no envían nada o no es texto, arrojamos un error limpio
    if (typeof interest !== 'string') {
      throw new BadRequestException('La propiedad "interest" debe ser una cadena de texto válida.');
    }

    return this.service.updateInterests(req.user.userId, interest);
  }
  @UseGuards(AuthGuard('jwt')) // 🔥 Protegemos la ruta exigiendo el token
  @Post('avatar') 
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @Request() req: any, // Extraemos la request completa
    @UploadedFile() file: Express.Multer.File,
  ) {
    // 1. Validar archivo
    if (!file) {
      throw new BadRequestException('No se recibió ningún archivo de imagen.');
    }

    // 2. Extraer el ID de forma segura desde el Token (req.user es inyectado por el AuthGuard)
    const studentId = req.user.userId;

    // 3. Subir la imagen atada a ese ID seguro
    return this.service.uploadAvatar(studentId, file);
  }

}