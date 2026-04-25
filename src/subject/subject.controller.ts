import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { SubjectService } from './subject.service';
import { CreateSubjectDto } from './dto/createSubject.dto';
import { UpdateSubjectDto } from './dto/updateSubject.dto';

@Controller('subjects')
export class SubjectController {
    
    constructor(private readonly subjectService: SubjectService) {}

    //GET
    @Get('')
    async getAllSubjects(){
        try{
            return await this.subjectService.getAllSubjects()
        }catch(error){
            console.error('ERROR EN GET ALL SUBJECTS:', error);
            throw error;
        }
    }

    @Get(':id')
    async getSubjectById(@Param('id') id: string){
        try{
            return await this.subjectService.getSubjectById(id)
        }catch(error){
            console.error('ERROR EN GET SUBJECT BY ID:', error);
            throw error;
        }
    }

    //POST
    @Post('')
    async createSubject(@Body() dto: CreateSubjectDto){
        try{
            return await this.subjectService.createSubject(dto)
        }catch(error){
            console.error('ERROR EN POST SUBJECT:', error);
            throw error;
        }
    }

    //Put
    @Put(':id')
    async updateSubject(@Body() dto: UpdateSubjectDto, @Param('id') id: string){
        try{
            return await this.subjectService.updateSubject(id, dto)
        }catch(error){
            console.error('ERROR EN UPDATE SUBJECT:', error);
            throw error;
        }
    }

    //DELETE
    @Delete(':id')
    async deleteSubject(@Param('id') id: string){
        try{
            return await this.subjectService.deleteSubject(id)
        }catch(error){
            console.error('ERROR EN DELETE SUBJECT:', error);
            throw error;
        }
    }
}
