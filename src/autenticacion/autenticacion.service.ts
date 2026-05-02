import { Injectable, UnauthorizedException } from '@nestjs/common';
import { CreateAutenticacionDto } from './dto/create-autenticacion.dto';
import { AlumnosService } from 'src/alumnos/alumnos.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { StudentsService } from 'src/students/students.service';

type AutenticacionResult = {
  accessToken: string;
  userId: string;
  email: string;
}


@Injectable()
export class AutenticacionService {
  constructor(private studentsService: StudentsService,
    private JwtService: JwtService
  ) { }

  async autenticar(input: CreateAutenticacionDto): Promise<AutenticacionResult> {
    const student = await this.validarStudent(input);
    if (!student) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const payload = {
      userId: student.id,
      username: student.email,
      accountNumber:student.accountNumber,
    };

    return {
      accessToken: this.JwtService.sign(payload),
      userId: student.id,
      email: student.email,
    }
  }

  async validarStudent(input: CreateAutenticacionDto): Promise<any> {
    const student = await this.studentsService.findByEmail(input.email);

    console.log('Alumno encontrado:', student);

    if (!student) return null;

    const isMatch = await bcrypt.compare(input.password, student.password);

    if (!isMatch) return null;    

    const { password, ...result } = student;
    return result;
  }
}
