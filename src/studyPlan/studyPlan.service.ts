import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateStudyPlanDto } from './dto/createStudyPlan.dto';
import { UpdateStudyPlanDto } from './dto/update-studyPlan.dto';



@Injectable()
export class StudyPlanService {

    constructor(private prisma: PrismaService) {}

    //GET
    async getAllStudyPlans() {
        try {
            return await this.prisma.studyPlan.findMany();
        } catch (error) {
            console.error('ERROR EN GET ALL STUDY PLANS:', error);
            throw error;
        }
    }

    async getStudyPlanById(id: string) {
        try {
            return await this.prisma.studyPlan.findUnique({
                where: { id },
            });
        } catch (error) {
            console.error('ERROR EN GET STUDY PLAN BY ID:', error);
            throw error;
        }
    }

    //CREATE
    async createStudyPlan(dto: CreateStudyPlanDto) {
        try {
            return await this.prisma.studyPlan.create({
                data: { ...dto },
            });
        } catch (error) {
            console.error('ERROR EN CREATE STUDY PLAN:', error);
            throw error;
        }
    }

    //UPDATE
    async updateStudyPlan(id: string, dto: UpdateStudyPlanDto) {
        try {
            return await this.prisma.studyPlan.update({
                where: { id },
                data: { ...dto },
            });
        } catch (error) {
            console.error('ERROR EN UPDATE STUDY PLAN:', error);
            throw error;
        }
    }

    //DELETE
    async deleteStudyPlan(id: string){
        try {
            return await this.prisma.studyPlan.delete({
                where: { id }
            })
        } catch(error){
            console.error('ERROR EN DELETE STUDY PLAN:', error);
            throw error;
        }
    }

}