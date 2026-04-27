import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { CareerService } from './career.service';
//Dto's
import { CreateCareerDto } from './dto/createCareer.dto';
import { UpdateCareerDto } from './dto/updateCareer.dto';

@Controller('career')
export class CareerController {
    constructor(private readonly careerService: CareerService) {}

    //GET
    @Get('')
    async getAllCareers(){
         try{
            return await this.careerService.getAllCareers()
        }catch(error){
            console.error('ERROR EN GET ALL CAREERS:', error);
            throw error;
        }
    }

    @Get(':id')
     async getCareerById(@Param('id') id: string){
        try{
            return await this.careerService.getCareerById(id)
        }catch(error){
            console.error('ERROR EN GET CAREER BY ID:', error);
            throw error;
        }
    }

    //POST
    @Post('')
    async createCareer(@Body() dto: CreateCareerDto){
        try{
            return await this.careerService.createCareer(dto)
        }catch(error){
            console.error('ERROR EN POST CAREER:', error);
            throw error;
        }
    }
    
    //Put
    @Put(':id')
    async updateCareer(@Body() dto: UpdateCareerDto, @Param('id') id: string){
        try{
            return await this.careerService.updateCareer(id, dto)
        }catch(error){
            console.error('ERROR EN UPDATE CAREER:', error);
            throw error;
        }
    }

    //DELETE
    @Delete(':id')
    async deleteCareer(@Param('id') id: string) {
      try {
        return await this.careerService.deleteCareer(id);
      } catch (error) {
        console.error('ERROR EN DELETE CAREER:', error);
        throw error;
      }
    }

}
