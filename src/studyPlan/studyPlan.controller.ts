import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { StudyPlanService } from './studyPlan.service';
import { CreateStudyPlanDto } from './dto/createStudyPlan.dto';
import { UpdateStudyPlanDto } from './dto/updateStudyPlan.dto';
import { JwtAuthGuard } from '../autenticacion/guards/jwt-auth.guard';
import { RolesGuard } from '../autenticacion/guards/roles.guard';
import { Roles } from '../autenticacion/decorators/roles.decorator';
import { RoleType } from '@prisma/client';

@Controller('study-plan')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudyPlanController {
    constructor(private readonly studyPlanService: StudyPlanService) {}

    // GET
    @Get('')
    async getAllStudyPlans() {
        return this.studyPlanService.getAllStudyPlans();
    }

    @Get(':id')
    async getStudyPlanById(@Param('id') id: string) {
        return this.studyPlanService.getStudyPlanById(id);
    }

    // POST (Administrador)
    @Post('')
    @Roles(RoleType.INSTITUTION_ADMIN)
    async createStudyPlan(@Body() dto: CreateStudyPlanDto) {
        return this.studyPlanService.createStudyPlan(dto);
    }

    // PUT (Administrador)
    @Put(':id')
    @Roles(RoleType.INSTITUTION_ADMIN)
    async updateStudyPlan(@Body() dto: UpdateStudyPlanDto, @Param('id') id: string) {
        return this.studyPlanService.updateStudyPlan(id, dto);
    }

    // DELETE (Administrador)
    @Delete(':id')
    @Roles(RoleType.INSTITUTION_ADMIN)
    async deleteStudyPlan(@Param('id') id: string) {
        return this.studyPlanService.deleteStudyPlan(id);
    }
}
