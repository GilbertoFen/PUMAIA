import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StudyLevel, StudySystem } from '@prisma/client';
import { CreateStudyPlanDto } from './dto/createStudyPlan.dto';
import { UpdateStudyPlanDto } from './dto/updateStudyPlan.dto';

@Injectable()
export class StudyPlanService {

    constructor(private prisma: PrismaService) {}

    //GET
    async getAllStudyPlans() {
        try {
            return await this.prisma.studyPlan.findMany({
                include: {
                    careers: true,
                    subjects: true,
                },
            });
        } catch (error) {
            console.error('ERROR EN GET ALL STUDY PLANS:', error);
            throw error;
        }
    }

    async getStudyPlanById(id: string) {
        try {
            return await this.prisma.studyPlan.findUnique({
                where: { id },
                include: {
                    careers: true,
                    subjects: true,
                },
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
                data: {
                    studyPlan: dto.studyPlan,
                    semesters: dto.semesters,
                    level: dto.level || StudyLevel.LICENCIATURA,
                    system: dto.system || StudySystem.ESCOLARIZADO,
                    totalCredits: dto.totalCredits ?? null,
                    optionalCredits: dto.optionalCredits ?? null,
                    firstGeneration: dto.firstGeneration ?? null,
                },
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
                data: {
                    ...(dto.studyPlan !== undefined && { studyPlan: dto.studyPlan }),
                    ...(dto.semesters !== undefined && { semesters: dto.semesters }),
                    ...(dto.level !== undefined && { level: dto.level }),
                    ...(dto.system !== undefined && { system: dto.system }),
                    ...(dto.totalCredits !== undefined && { totalCredits: dto.totalCredits }),
                    ...(dto.optionalCredits !== undefined && { optionalCredits: dto.optionalCredits }),
                    ...(dto.firstGeneration !== undefined && { firstGeneration: dto.firstGeneration }),
                },
            });
        } catch (error) {
            console.error('ERROR EN UPDATE STUDY PLAN:', error);
            throw error;
        }
    }

    //DELETE
    async deleteStudyPlan(id: string) {
        try {
            return await this.prisma.studyPlan.delete({
                where: { id },
            });
        } catch (error) {
            console.error('ERROR EN DELETE STUDY PLAN:', error);
            throw error;
        }
    }
}
