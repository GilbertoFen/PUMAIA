import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateStudentDto } from './dto/create-student.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class StudentsService {
    constructor(private prisma: PrismaService) { }

    async findAll() {
        try {
            console.log('1. Buscando todos los estudiantes...');
            const result = await this.prisma.student.findMany();
            console.log('2. Estudiantes encontrados:', result);
            return result;
        } catch (error) {
            console.error('ERROR EN PRISMA:', error);
            throw error;
        }
    }

    async create(dto: CreateStudentDto) {
        try {
            const salt = await bcrypt.genSalt();
            const hashedPassword = await bcrypt.hash(dto.password, salt);
            const result = await this.prisma.student.create({ data: {...dto, password: hashedPassword }});
            return result;
        } catch (error) {
            console.error('ERROR EN PRISMA:', error);
            throw error;
        }
    }
    async findByAccountNumber(accountNumber: number) {
        return await this.prisma.student.findUnique({
            where: { accountNumber }
        });
    }

    async findByEmail(email: string) {
        return await this.prisma.student.findUnique({
            where: { email }
        });
    }


    async assignContest(studentId: string, contestId: string) {
        try {
            return await this.prisma.studentContest.create({
                data: {
                    studentId: studentId,
                    contestId: contestId,
                },
                 include: {
                    contest: true
                }
            });
        } catch (error) {
            console.error("Error al asignar concurso:", error);
            throw error;
        }
    }
    async removeContest(relationId: string) {
        try {
            return await this.prisma.studentContest.delete({
                where: { id: relationId }
            });
        } catch (error) {
            console.error("Error al eliminar relación concurso-alumno:", error);
            throw error;
        }
    }

}
