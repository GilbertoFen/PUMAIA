import { Controller, Body, Get, Post, Param } from '@nestjs/common';
import { ContestService } from './contest.service';
import { CreateContestDto } from './dto/create-contest.dto';
import { EnrollStudentDto } from './dto/enroll-student.dto';
@Controller('contests')
export class ContestController {
  constructor(private service: ContestService) { }

  @Post()
  create(@Body() dto: CreateContestDto) {
    return this.service.create(dto);
  }
  @Post('enroll')
  async enroll(@Body() dto: EnrollStudentDto) {
    const registration = await this.service.enroll(dto);

    return {
      message: 'Inscripción exitosa',
      details: {
        alumno: registration.student.name,
        concurso_asignado: registration.contest.name,
        fecha_registro: new Date().toISOString()
      }
    };
  }
  @Get('student/:id')
  async getStudentContests(@Param('id') id: string) {
    const list = await this.service.findByStudent(id);

    return {
      count: list.length,
      participations: list.map(item => ({
        id_registro: item.id,
        nombre_concurso: item.contest.name.toUpperCase(),
      }))
    };
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('with-contests/:accountNumber')
  async getStudentInfo(@Param('accountNumber') accountNumber: string) {
    return await this.service.findStudentWithContests(parseInt(accountNumber));
  }
}