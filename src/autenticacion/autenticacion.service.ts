import { Injectable, UnauthorizedException } from '@nestjs/common';
import { CreateAutenticacionDto } from './dto/create-autenticacion.dto';
import { AlumnosService } from 'src/alumnos/alumnos.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

type AutenticacionResult = {
  accessToken: string;
  userId: string;
  email: string;
}


@Injectable()
export class AutenticacionService {
  constructor(private alumnosService: AlumnosService,
    private JwtService: JwtService
  ) { }

  async autenticar(input: CreateAutenticacionDto): Promise<AutenticacionResult> {
    const alumno = await this.validarAlumno(input);
    if (!alumno) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const payload = {
      userId: alumno.id,
      username: alumno.email,
    };

    return {
      accessToken: this.JwtService.sign(payload),
      userId: alumno.id,
      email: alumno.email,
    }
  }

  async validarAlumno(input: CreateAutenticacionDto): Promise<any> {
    const alumno = await this.alumnosService.findUserByEmail(input.email);

    console.log('Alumno encontrado:', alumno);

    if (!alumno) return null;

    const isMatch = await bcrypt.compare(input.password, alumno.password);

    if (!isMatch) return null;

    

    const { password, ...result } = alumno;
    return result;
  }
}
