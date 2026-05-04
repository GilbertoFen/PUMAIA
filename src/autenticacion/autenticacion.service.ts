import { Injectable, UnauthorizedException } from '@nestjs/common';
import { CreateAutenticacionDto } from './dto/create-autenticacion.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { StudentsService } from 'src/students/students.service';

type AutenticacionResult = {
  accessToken: string;
  userId: string;
  accountNumber: number;
  name: string;
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
      name: student.name,
      accountNumber:student.accountNumber,
    };

    return {
      accessToken: this.JwtService.sign(payload),
      userId: student.id,
      accountNumber: student.accountNumber,
      name: student.name
    }
  }

  async validarStudent(input: CreateAutenticacionDto): Promise<any> {
    const student = await this.studentsService.findByAccountNumber(input.accountNumber);

    console.log('Alumno encontrado:', student);

    if (!student) return null;

    const isMatch = await bcrypt.compare(input.password, student.password);

    if (!isMatch) return null;    

    const { password, ...result } = student;
    return result;
  }
}
