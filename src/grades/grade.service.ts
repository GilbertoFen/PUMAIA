import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateGradeDto } from './dto/createGrade.dto';
import { UpdateGradeDto } from './dto/updateGrade.dto';



@Injectable()
export class GradeService {

    constructor(private prisma: PrismaService) {}

    //GET
    async getAllGrades() {
        try {
            return await this.prisma.grade.findMany();
        } catch (error) {
            console.error('ERROR EN GET ALL GRADES:', error);
            throw error;
        }
    }

    async getGradeById(id: string) {
        try {
            return await this.prisma.grade.findUnique({
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
            return await this.prisma.grade.create({
                data: { ...dto },
            });
        } catch (error) {
            console.error('ERROR EN CREATE GRADE:', error);
            throw error;
        }
    }

    //UPDATE
    async updateGrade(id: string, dto: UpdateGradeDto) {
        try {
            return await this.prisma.grade.update({
                where: { id },
                data: { ...dto },
            });
        } catch (error) {
            console.error('ERROR EN UPDATE GRADE:', error);
            throw error;
        }
    }

    //DELETE
    async deleteGrade(id: string){
        try {
            return await this.prisma.grade.delete({
                where: { id }
            })
        } catch(error){
            console.error('ERROR EN DELETE GRADE:', error);
            throw error;
        }
    }

}