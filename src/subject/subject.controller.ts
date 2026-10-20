import { Controller, Get, Post, Put, Delete, Param, Body, UseInterceptors, UploadedFile, Request, BadRequestException, UseGuards } from '@nestjs/common';
import { SubjectService } from './subject.service';
import { CreateSubjectDto } from './dto/createSubject.dto';
import { UpdateSubjectDto } from './dto/updateSubject.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';

@Controller('subjects')
export class SubjectController {

    constructor(private readonly subjectService: SubjectService) { }

    //GET
    @Get('')
    async getAllSubjects() {
        try {
            return await this.subjectService.getAllSubjects()
        } catch (error) {
            console.error('ERROR EN GET ALL SUBJECTS:', error);
            throw error;
        }
    }

    @Get(':id')
    async getSubjectById(@Param('id') id: string) {
        try {
            return await this.subjectService.getSubjectById(id)
        } catch (error) {
            console.error('ERROR EN GET SUBJECT BY ID:', error);
            throw error;
        }
    }

    //POST
    @Post('')
    async createSubject(@Body() dto: CreateSubjectDto) {
        try {
            return await this.subjectService.createSubject(dto)
        } catch (error) {
            console.error('ERROR EN POST SUBJECT:', error);
            throw error;
        }
    }

    //Put
    @Put(':id')
    async updateSubject(@Body() dto: UpdateSubjectDto, @Param('id') id: string) {
        try {
            return await this.subjectService.updateSubject(id, dto)
        } catch (error) {
            console.error('ERROR EN UPDATE SUBJECT:', error);
            throw error;
        }
    }

    //DELETE
    @Delete(':id')
    async deleteSubject(@Param('id') id: string) {
        try {
            return await this.subjectService.deleteSubject(id)
        } catch (error) {
            console.error('ERROR EN DELETE SUBJECT:', error);
            throw error;
        }
    }

    @UseGuards(AuthGuard('jwt')) // Protegido con JWT
    @Post('analyze-pdf')
    @UseInterceptors(FileInterceptor('file')) // El campo en Postman se llamará 'file'
    async uploadAndSaveHistory(
        @Request() req: any,
        @UploadedFile() file: Express.Multer.File,
    ) {
        if (!file) {
            throw new BadRequestException('No se adjuntó ningún PDF.');
        }

        // Obtenemos el ID del alumno desde el token
        const studentId = req.user.userId; // Ajusta según el console.log que hiciste arriba

        // Disparamos la magia
        return this.subjectService.saveAcademicHistory(studentId, file.buffer);
    }
}
