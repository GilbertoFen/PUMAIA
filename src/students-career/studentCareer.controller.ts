import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { StudentCareerService } from './studentCareer.service';
//Dto's
import { CreateStudentCareerDto } from './dto/createStudentCareer.dto';
import { UpdateStudentCareerDto } from './dto/updateStudentCareer.dto';

@Controller('student-career')
export class StudentCareerController {
    constructor(private readonly studentCareerService: StudentCareerService) {}

    //GET
    @Get('')
    async getAllStudentCareers() {
        try {
            return await this.studentCareerService.getAllStudentCareers();
        } catch (error) {
            console.error('ERROR EN GET ALL STUDENT CAREERS:', error);
            throw error;
        }
    }

    @Get(':id')
    async getStudentCareerById(@Param('id') id: string) {
        try {
            return await this.studentCareerService.getStudentCareerById(id);
        } catch (error) {
            console.error('ERROR EN GET STUDENT CAREER BY ID:', error);
            throw error;
        }
    }

    //POST
    @Post('')
    async createStudentCareer(@Body() dto: CreateStudentCareerDto) {
        try {
            return await this.studentCareerService.createStudentCareer(dto);
        } catch (error) {
            console.error('ERROR EN POST STUDENT CAREER:', error);
            throw error;
        }
    }

    //PUT
    @Put(':id')
    async updateStudentCareer(@Body() dto: UpdateStudentCareerDto, @Param('id') id: string) {
        try {
            return await this.studentCareerService.updateStudentCareer(id, dto);
        } catch (error) {
            console.error('ERROR EN UPDATE STUDENT CAREER:', error);
            throw error;
        }
    }

    //DELETE
    @Delete(':id')
    async deleteStudentCareer(@Param('id') id: string) {
        try {
            return await this.studentCareerService.deleteStudentCareer(id);
        } catch (error) {
            console.error('ERROR EN DELETE STUDENT CAREER:', error);
            throw error;
        }
    }
}