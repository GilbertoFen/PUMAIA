import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { StudentCareerService } from './studentCareer.service';
import { CreateStudentCareerDto } from './dto/createStudentCareer.dto';
import { UpdateStudentCareerDto } from './dto/updateStudentCareer.dto';
import { JwtAuthGuard } from '../autenticacion/guards/jwt-auth.guard';
import { RolesGuard } from '../autenticacion/guards/roles.guard';
import { Roles } from '../autenticacion/decorators/roles.decorator';
import { RoleType } from '@prisma/client';

@Controller('student-career')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.INSTITUTION_ADMIN)
export class StudentCareerController {
    constructor(private readonly studentCareerService: StudentCareerService) {}

    // GET
    @Get('')
    async getAllStudentCareers() {
        return this.studentCareerService.getAllStudentCareers();
    }

    @Get(':id')
    async getStudentCareerById(@Param('id') id: string) {
        return this.studentCareerService.getStudentCareerById(id);
    }

    // POST
    @Post('')
    async createStudentCareer(@Body() dto: CreateStudentCareerDto) {
        return this.studentCareerService.createStudentCareer(dto);
    }

    // PUT
    @Put(':id')
    async updateStudentCareer(@Body() dto: UpdateStudentCareerDto, @Param('id') id: string) {
        return this.studentCareerService.updateStudentCareer(id, dto);
    }

    // DELETE
    @Delete(':id')
    async deleteStudentCareer(@Param('id') id: string) {
        return this.studentCareerService.deleteStudentCareer(id);
    }
}
