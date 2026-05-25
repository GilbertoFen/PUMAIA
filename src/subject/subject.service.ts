import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
//Dto's
import { CreateSubjectDto } from './dto/createSubject.dto';
import { UpdateSubjectDto } from './dto/updateSubject.dto';
import { procesarYValidarHistorial } from '../utils/parser-pdf';
import { MateriaTemporal } from '../utils/types.js';

import { BadRequestException } from '@nestjs/common';


@Injectable()
export class SubjectService {

    constructor(private prisma: PrismaService) { }

    //GET
    async getAllSubjects() {
        try {
            return await this.prisma.subject.findMany();
        } catch (error) {
            console.error('ERROR EN GET ALL SUBJECTS:', error);
            throw error;
        }
    }

    async getSubjectById(id: string) {
        try {
            return await this.prisma.subject.findUnique({
                where: { id },
            });
        } catch (error) {
            console.error('ERROR EN GET SUBJECT BY ID:', error);
            throw error;
        }
    }

    //CREATE
    async createSubject(dto: CreateSubjectDto) {
        try {
            return await this.prisma.subject.create({
                data: {
                    subject: dto.subject,
                    category: {
                        connect: { id: dto.categoryID },
                    },
                },
            });
        } catch (error) {
            console.error('ERROR EN CREATE SUBJECT:', error);
            throw error;
        }
    }

    //UPDATE
    async updateSubject(id: string, dto: UpdateSubjectDto) {
        try {
            return await this.prisma.subject.update({
                where: { id },
                data: {
                    subject: dto.subject,
                    category: {
                        connect: { id: dto.categoryID },
                    },
                },
            });
        } catch (error) {
            console.error('ERROR EN UPDATE SUBJECT:', error);
            throw error;
        }
    }

    //DELETE
    async deleteSubject(id: string) {
        try {
            return await this.prisma.subject.delete({
                where: { id }
            })
        } catch (error) {
            console.error('ERROR EN DELETE SUBJECT:', error);
            throw error;
        }
    }
    async analyzeAndMatchHistory(fileBuffer: Buffer) {
        const markdown = await procesarYValidarHistorial(fileBuffer);

        if (!markdown) {
            throw new BadRequestException('El documento no es un historial válido.');
        }

        const materiasParaMatch: MateriaTemporal[] = [];

        const materiaRegex = /-\s+\*\*(.+?)\*\*:\s+(\d+)/g;
        let match: RegExpExecArray | null;

        while ((match = materiaRegex.exec(markdown)) !== null) {
            materiasParaMatch.push({
                nombre: match[1].trim(),
                calificacion: parseInt(match[2], 10)
            });
        }

        const catalogo = await this.prisma.subject.findMany();

        const subjectsMatched = materiasParaMatch.map(mPDF => {
            const matchBD = catalogo.find(mBD =>
                this.normalizar(mBD.subject) === this.normalizar(mPDF.nombre)
            );

            return {
                subjectID: matchBD?.id || null,
                subjectName: mPDF.nombre,
                grade: mPDF.calificacion,
                exists: !!matchBD
            };
        });

        return {
            rawMarkdown: markdown,
            subjects: subjectsMatched
        };
    }

    private normalizar(t: string): string {
        return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    }
    // 🧮 NUEVO MÉTODO: Analizar, Guardar Calificaciones y Actualizar Promedio
    // 🧮 MÉTODO MEJORADO: Analizar, Upsert de Calificaciones y Actualizar Promedio
    async saveAcademicHistory(studentId: string, fileBuffer: Buffer) {
        // 1. Analizamos el PDF
        const analysis = await this.analyzeAndMatchHistory(fileBuffer);
        
        // 2. Filtramos solo las materias válidas
        const validSubjects = analysis.subjects.filter(s => s.exists && s.subjectID);

        if (validSubjects.length === 0) {
            throw new BadRequestException('No se encontraron materias válidas en el historial para guardar.');
        }

        let newAverage = 0;

        // 3. TRANSACCIÓN ATÓMICA: Hacemos el Upsert y recalculamos
        await this.prisma.$transaction(async (tx) => {
            
            // A. UPSERT MANUAL: Iteramos sobre las materias que arrojó el PDF
            for (const subject of validSubjects) {
                // Buscamos si el alumno ya tiene esta materia registrada
                const existingGrade = await tx.grades.findFirst({
                    where: {
                        studentId: studentId,
                        subjectId: subject.subjectID as string,
                    }
                });

                if (existingGrade) {
                    // Si ya existe, la actualizamos (por si mejoró su calificación)
                    await tx.grades.update({
                        where: { id: existingGrade.id },
                        data: { grade: subject.grade }
                    });
                } else {
                    // Si es nueva (ej. de un nuevo semestre), la insertamos
                    await tx.grades.create({
                        data: {
                            studentId: studentId,
                            subjectId: subject.subjectID as string,
                            grade: subject.grade
                        }
                    });
                }
            }

            // B. CALCULAR PROMEDIO REAL: Obtenemos todas sus calificaciones actuales en BD
            const allGrades = await tx.grades.findMany({
                where: { studentId: studentId }
            });

            // Sumamos y dividimos para sacar el promedio exacto
            const sum = allGrades.reduce((acc, curr) => acc + curr.grade, 0);
            newAverage = allGrades.length > 0 ? Math.round(sum / allGrades.length) : 0;

            // C. Guardamos el promedio estático en el perfil del alumno
            await tx.student.update({
                where: { id: studentId },
                data: { average: newAverage }
            });
        });

        // 4. Devolvemos la respuesta al Frontend
        return {
            message: 'Historial procesado y actualizado correctamente (Upsert).',
            subjectsProcessed: validSubjects.length,
            newAverage: newAverage,
            subjects: validSubjects
        };
    }
}