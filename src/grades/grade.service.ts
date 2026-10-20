import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateGradeDto } from './dto/createGrade.dto';
import { UpdateGradeDto, ConfirmGradesDto } from './dto/updateGrade.dto';



@Injectable()
export class GradeService {

    constructor(private prisma: PrismaService) { }

    //GET
    async getAllGrades() {
        try {
            return await this.prisma.grades.findMany();
        } catch (error) {
            console.error('ERROR EN GET ALL GRADES:', error);
            throw error;
        }
    }

    async getGradeById(id: string) {
        try {
            return await this.prisma.grades.findUnique({
                where: { id },
            });
        } catch (error) {
            console.error('ERROR EN GET GRADE BY ID:', error);
            throw error;
        }
    }

    //CREATE
    async createGrade(dto: CreateGradeDto) {
        try {
            return await this.prisma.grades.create({
                data: {
                    grade: dto.grade,
                    subject: {
                        connect: { id: dto.subjectID },
                    },
                    student: {
                        connect: { id: dto.studentID },
                    },
                },
            });
        } catch (error) {
            console.error('ERROR EN CREATE GRADE:', error);
            throw error;
        }
    }

    //UPDATE
    async updateGrade(id: string, dto: UpdateGradeDto) {
        try {
            return await this.prisma.grades.update({
                where: { id },
                data: {
                    grade: dto.grade,
                    subject: {
                        connect: { id: dto.subjectID },
                    },
                    student: {
                        connect: { id: dto.studentID },
                    },
                },
            });
        } catch (error) {
            console.error('ERROR EN UPDATE GRADE:', error);
            throw error;
        }
    }

    //DELETE
    async deleteGrade(id: string) {
        try {
            return await this.prisma.grades.delete({
                where: { id }
            })
        } catch (error) {
            console.error('ERROR EN DELETE GRADE:', error);
            throw error;
        }
    }

    async saveConfirmedGrades(studentId: string, dto: ConfirmGradesDto) {
        const dataToInsert = dto.subjects
            .filter(s => s.subjectID !== null)
            .map(s => ({
                studentId: studentId,
                subjectId: s.subjectID,
                grade: s.grade,
            }));

        if (dataToInsert.length === 0) {
            throw new BadRequestException('No hay materias validas');
        }

        return await this.prisma.grades.createMany({
            data: dataToInsert,
            skipDuplicates: true,
        });
    }

    async getMyGrades(studentId: string) {
        const grades = await this.prisma.grades.findMany({
            where: {
                studentId: studentId,
            },
            include: {
                subject: true, // Trae la info de la tabla Subject relacionada
            },
            orderBy: {
                subject: {
                    subject: 'asc', // Ordenar por nombre de materia
                },
            },
        });

        // Mapeamos para que el Frontend reciba el formato que ya espera
        return grades.map((g) => ({
            subjectID: g.subjectId,
            subjectName: g.subject.subject, // Nombre real de la materia
            grade: g.grade,
            exists: true,
        }));
    }

}