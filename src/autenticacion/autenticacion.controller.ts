import { Controller, Get, Post, Body, Patch, Param, Delete, HttpCode } from '@nestjs/common';
import { AutenticacionService } from './autenticacion.service';
import { CreateAutenticacionDto } from './dto/create-autenticacion.dto';
import { CreateStudentDto } from 'src/students/dto/create-student.dto';
import { StudentsService } from 'src/students/students.service';
@Controller('autenticacion')
export class AutenticacionController {
  constructor(private readonly autenticacionService: AutenticacionService,private studentsService: StudentsService) {}
  //create DTO!!!
  @Post('register')
  async register(@Body() registerDto: CreateStudentDto) {
     const newStudent = await this.studentsService.create(registerDto);
     
     return this.autenticacionService.autenticar({ 
         accountNumber: registerDto.accountNumber, 
         password: registerDto.password,
         email: registerDto.email // <-- Agrega esta línea
     });
  }
  @HttpCode(200) 
  @Post('login')
  login (@Body() input: CreateAutenticacionDto) {
    return this.autenticacionService.autenticar(input);
  }
}
