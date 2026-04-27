import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
//Dto's
import { CreateStudentCareerDto } from './dto/createStudentCareer.dto';
import { UpdateStudentCareerDto } from './dto/updateStudentCareer.dto';

@Injectable()
export class StudentCareerService {
    constructor(private prisma: PrismaService) {}

    //GET
    async getAllStudentCareers() {
        try {
            return await this.prisma.studentCareer.findMany();
        } catch (error) {
            console.error('ERROR EN GET ALL STUDENT CAREERS:', error);
            throw error;
        }
    }

    async getStudentCareerById(id: string) {
        try {
            return await this.prisma.studentCareer.findUnique({
                where: { id },
            });
        } catch (error) {
            console.error('ERROR EN GET STUDENT CAREER BY ID:', error);
            throw error;
        }
    }

    //CREATE
    async createStudentCareer(dto: CreateStudentCareerDto) {
        try {
            return await this.prisma.studentCareer.create({
                data: { ...dto },
            });
        } catch (error) {
            console.error('ERROR EN CREATE STUDENT CAREER:', error);
            throw error;
        }
    }

    //UPDATE
    async updateStudentCareer(id: string, dto: UpdateStudentCareerDto) {
        try {
            return await this.prisma.studentCareer.update({
                where: { id },
                data: { ...dto },
            });
        } catch (error) {
            console.error('ERROR EN UPDATE STUDENT CAREER:', error);
            throw error;
        }
    }

    //DELETE
    async deleteStudentCareer(id: string) {
        try {
            return await this.prisma.studentCareer.delete({
                where: { id },
            });
        } catch (error) {
            console.error('ERROR EN DELETE STUDENT CAREER:', error);
            throw error;
        }
    }
}