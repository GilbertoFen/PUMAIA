import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { StudyPlanService } from './studyPlan.service';
//Dto's
import { CreateStudyPlanDto } from './dto/createStudyPlan.dto';
import { UpdateStudyPlanDto } from './dto/updateStudyPlan.dto';

@Controller('study-plan')
export class StudyPlanController {
    
    constructor(private readonly studyPlanService: StudyPlanService) {}

    //GET
    @Get('')
    async getAllStudyPlans(){
        try{
            return await this.studyPlanService.getAllStudyPlans()
        }catch(error){
            console.error('ERROR EN GET ALL STUDY PLANS:', error);
            throw error;
        }
    }

    @Get(':id')
    async getStudyPlanById(@Param('id') id: string){
        try{
            return await this.studyPlanService.getStudyPlanById(id)
        }catch(error){
            console.error('ERROR EN GET STUDY PLAN BY ID:', error);
            throw error;
        }
    }

    //POST
    @Post('')
    async createStudyPlan(@Body() dto: CreateStudyPlanDto){
        try{
            return await this.studyPlanService.createStudyPlan(dto)
        }catch(error){
            console.error('ERROR EN POST STUDY PLAN:', error);
            throw error;
        }
    }

    //Put
    @Put(':id')
    async updateStudyPlan(@Body() dto: UpdateStudyPlanDto, @Param('id') id: string){
        try{
            return await this.studyPlanService.updateStudyPlan(id, dto)
        }catch(error){
            console.error('ERROR EN UPDATE STUDY PLAN:', error);
            throw error;
        }
    }

    //DELETE
    @Delete(':id')
    async deleteStudyPlan(@Param('id') id: string){
        try{
            return await this.studyPlanService.deleteStudyPlan(id)
        }catch(error){
            console.error('ERROR EN DELETE STUDY PLAN:', error);
            throw error;
        }
    }
}
