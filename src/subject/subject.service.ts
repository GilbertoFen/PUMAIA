import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
//Dto's
import { CreateSubjectDto } from './dto/createSubject.dto';
import { UpdateSubjectDto } from './dto/updateSubject.dto';
import { procesarYValidarHistorial } from '../utils/parser-pdf';
import {MateriaTemporal} from '../utils/types.js';

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
}