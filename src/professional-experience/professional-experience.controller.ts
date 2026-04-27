import { Controller, Get, Post, Delete, Body, Param } from '@nestjs/common';
import { ProfessionalExperienceService } from './professional-experience.service';
import { CreateProfessionalExperienceDto } from './dto/create-professional-experience.dto';

@Controller('professional-experience')
export class ProfessionalExperienceController {
    constructor(private readonly service: ProfessionalExperienceService) { }

    @Post()
    async assign(@Body() dto: CreateProfessionalExperienceDto) {
        const record = await this.service.assign(dto);

         return {
            message: 'Experiencia asignada correctamente',
            assignment: {
                student: record.student.name,
                expertise: record.areaExpertise.name,
                category_id: record.categoryId
            }
        };
    }

    @Get('student/:id')
    async getStudentExperience(@Param('id') id: string) {
        const experiences = await this.service.findByStudent(id);

         return {
            total: experiences.length,
            skills: experiences.map(exp => ({
                id_relacion: exp.id,
                area: exp.areaExpertise.name,
                categoria: exp.categoryId
            }))
        };
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.service.remove(id);
    }
}