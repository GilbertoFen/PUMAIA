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
        const salt = await bcrypt.genSalt();
        const hashedPassword = await bcrypt.hash(dto.password, salt);

        return this.prisma.student.create({
            data: {
                accountNumber: dto.accountNumber,
                name: dto.name,
                lastNameP: dto.lastNameP,
                lastNameM: dto.lastNameM,
                interest: dto.interest,
                currentSemester: dto.currentSemester,
                average: dto.average,
                email: dto.email,
                password: hashedPassword,
                addressId: dto.addressId,
            }
        });
    }
    async findByAccountNumber(accountNumber: number) {
        const result = await this.prisma.student.findUnique({
            where: { accountNumber },
            include: {
                careers: {
                    include: {
                        career: true
                    }
                }
            }
        });
        console.log('Resultado de Prisma:', JSON.stringify(result, null, 2));
        return result;
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
    // En tu student.service.ts (o el servicio que maneje el perfil del alumno)
    async updateInterests(studentId: string, interest: string) {
        return await this.prisma.student.update({
            where: {
                id: studentId
            },
            data: {
                interest: interest.trim(), // Insertamos el string crudo tal cual llegó
            },
            select: {
                id: true,
                interest: true
            }
        });
    }
    // En tu student.service.ts
    async getFullProfileSummary(studentId: string) {
        return await this.prisma.student.findUnique({
            where: { id: studentId },
            include: {
                courses: {
                    include: { course: true }
                },
                languages: {
                    include: { language: true, skill: true }
                },
                schoolarships: { // Verifica si en tu prisma se escribe con una o dos 'h'
                    include: { schoolarship: true }
                },
                contests: {
                    include: { contest: true }
                },
                experiences: {
                    include: { areaExpertise: true }
                }
            }
        });
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
