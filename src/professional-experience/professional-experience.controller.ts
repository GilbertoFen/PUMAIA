import { Controller, Get, Post, Delete, Body, Param, Patch, UseGuards } from '@nestjs/common';
import { ProfessionalExperienceService } from './professional-experience.service';
import { CreateProfessionalExperienceDto } from './dto/create-professional-experience.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('professional-experience')
@UseGuards(AuthGuard('jwt'))
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
    @Patch(':id')
    async update(
        @Param('id') id: string,
        @Body() dto: { areaExpertiseId?: string; categoryId?: string }
    ) {
        return this.service.update(id, dto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.service.remove(id);
    }
}