import { Controller, Body, Get, Post, Param, UseGuards, Req } from '@nestjs/common';
import { ContestService } from './contest.service';
import { CreateContestDto } from './dto/create-contest.dto';
import { EnrollStudentDto } from './dto/enroll-student.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('contests')
export class ContestController {
  constructor(private service: ContestService) { }
  @UseGuards(AuthGuard('jwt')) 

  @Post()
  create(@Body() dto: CreateContestDto, @Req() req) {
    const userId = req.user.id;
    console.log("id del usuario :", userId);
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
  @UseGuards(AuthGuard('jwt'))
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('with-contests/:accountNumber')
  async getStudentInfo(@Param('accountNumber') accountNumber: string) {
    return await this.service.findStudentWithContests(parseInt(accountNumber));
  }
}