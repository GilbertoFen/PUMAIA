import {
  Controller,
  Body, Get, Post, Delete, Param
} from '@nestjs/common';
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { NotFoundException } from '@nestjs/common';
@Controller('students')
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
  @Get(':email')
  async findByEmail(@Param('email') email: string){
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
  @Delete('remove-contest/:relationId')
  async removeContest(@Param('relationId') id: string) {
    return await this.service.removeContest(id);
  }
  
}