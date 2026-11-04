import { Controller, Get, Post, Put, Delete, Param, Body, UseInterceptors, UploadedFile, BadRequestException, UseGuards } from '@nestjs/common';
import { SubjectService } from './subject.service';
import { CreateSubjectDto } from './dto/createSubject.dto';
import { UpdateSubjectDto } from './dto/updateSubject.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../autenticacion/guards/jwt-auth.guard';
import { RolesGuard } from '../autenticacion/guards/roles.guard';
import { Roles } from '../autenticacion/decorators/roles.decorator';
import { CurrentUser } from '../autenticacion/decorators/current-user.decorator';
import type { AuthUser } from '../autenticacion/interfaces/auth-user.interface';
import { RoleType } from '@prisma/client';

@Controller('subjects')
export class SubjectController {

    constructor(private readonly subjectService: SubjectService) { }

    // GET
    @Get('')
    async getAllSubjects() {
        return this.subjectService.getAllSubjects();
    }

    @Get(':id')
    async getSubjectById(@Param('id') id: string) {
        return this.subjectService.getSubjectById(id);
    }

    // POST (Administrador)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RoleType.INSTITUTION_ADMIN)
    @Post('')
    async createSubject(@Body() dto: CreateSubjectDto) {
        return this.subjectService.createSubject(dto);
    }

    // PUT (Administrador)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RoleType.INSTITUTION_ADMIN)
    @Put(':id')
    async updateSubject(@Body() dto: UpdateSubjectDto, @Param('id') id: string) {
        return this.subjectService.updateSubject(id, dto);
    }

    // DELETE (Administrador)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RoleType.INSTITUTION_ADMIN)
    @Delete(':id')
    async deleteSubject(@Param('id') id: string) {
        return this.subjectService.deleteSubject(id);
    }

    // ANALYZE PDF (Estudiante autenticado)
    @UseGuards(JwtAuthGuard)
    @Post('analyze-pdf')
    @UseInterceptors(FileInterceptor('file'))
    async uploadAndSaveHistory(
        @CurrentUser() user: AuthUser,
        @UploadedFile() file: Express.Multer.File,
    ) {
        if (!file) {
            throw new BadRequestException('No se adjuntó ningún PDF.');
        }

        if (!user || !user.studentId) {
            throw new BadRequestException('El usuario no cuenta con un perfil de estudiante vinculado.');
        }

        return this.subjectService.saveAcademicHistory(user.studentId, file.buffer);
    }
}
