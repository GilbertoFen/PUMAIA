import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
//Dto's
import { CreateSubjectDto } from './dto/createSubject.dto';
import { UpdateSubjectDto } from './dto/updateSubject.dto';



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

}