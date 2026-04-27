import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { GradeService } from './grade.service';
import { CreateGradeDto } from './dto/createGrade.dto';
import { UpdateGradeDto } from './dto/updateGrade.dto';

@Controller('grade')
export class GradeController {
    
    constructor(private readonly gradeService: GradeService) {}

    //GET
    @Get('')
    async getAllGrades(){
        try{
            return await this.gradeService.getAllGrades()
        }catch(error){
            console.error('ERROR EN GET ALL GRADES:', error);
            throw error;
        }
    }

    @Get(':id')
    async getGradeById(@Param('id') id: string){
        try{
            return await this.gradeService.getGradeById(id)
        }catch(error){
            console.error('ERROR EN GET GRADE BY ID:', error);
            throw error;
        }
    }

    //POST
    @Post('')
    async createGrade(@Body() dto: CreateGradeDto){
        try{
            return await this.gradeService.createGrade(dto)
        }catch(error){
            console.error('ERROR EN POST GRADE:', error);
            throw error;
        }
    }

    //Put
    @Put(':id')
    async updateGrade(@Body() dto: UpdateGradeDto, @Param('id') id: string){
        try{
            return await this.gradeService.updateGrade(id, dto)
        }catch(error){
            console.error('ERROR EN UPDATE GRADE:', error);
            throw error;
        }
    }

    //DELETE
    @Delete(':id')
    async deleteGrade(@Param('id') id: string){
        try{
            return await this.gradeService.deleteGrade(id)
        }catch(error){
            console.error('ERROR EN DELETE GRADE:', error);
            throw error;
        }
    }
}
