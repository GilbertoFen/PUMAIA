import { Injectable } from '@nestjs/common';
import { PrismaService } from "src/prisma/prisma.service";
import { CreateProfessionalExperienceDto } from './dto/create-professional-experience.dto';
@Injectable()
export class ProfessionalExperienceService {
    constructor(private prisma: PrismaService) { }

    async assign(dto: CreateProfessionalExperienceDto) {
        return await this.prisma.professionalExperience.create({
            data: {
                studentId: dto.studentId,
                areaExpertiseId: dto.areaExpertiseId,
                categoryId: dto.categoryId,
            },
            include: {
                areaExpertise: true,
                student: true,
            },
        });
    }

    async findByStudent(studentId: string) {
        return await this.prisma.professionalExperience.findMany({
            where: { studentId },
            include: {
                areaExpertise: true,
            },
        });
    }
    async update(id: string, dto: { areaExpertiseId?: string; categoryId?: string }) {
        return await this.prisma.professionalExperience.update({
            where: { id },
            data: {
                areaExpertiseId: dto.areaExpertiseId,
                categoryId: dto.categoryId,
            },
            include: {
                areaExpertise: true,
            }
        });
    }

    async remove(id: string) {
        return await this.prisma.professionalExperience.delete({
            where: { id },
        });
    }
}