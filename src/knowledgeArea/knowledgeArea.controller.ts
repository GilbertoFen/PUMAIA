import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { KnowledgeAreaService } from './knowledgeArea.service';
import { CreateKnowledgeAreaDto } from './dto/createKnowledgeArea.dto';
import { UpdateKnowledgeAreaDto } from './dto/update-studentKnowledgeArea.dto';

@Controller('knowledge-area')
export class KnowledgeAreaController {
    
    constructor(private readonly knowledgeAreaService: KnowledgeAreaService) {}

    //GET
    @Get('')
    async getAllKnowledgeAreas(){
        try{
            return await this.knowledgeAreaService.getAllKnowledgeAreas()
        }catch(error){
            console.error('ERROR EN GET ALL KNOWLEDGE AREAS:', error);
            throw error;
        }
    }

    @Get(':id')
    async getKnowledgeAreaById(@Param('id') id: string){
        try{
            return await this.knowledgeAreaService.getKnowledgeAreaById(id)
        }catch(error){
            console.error('ERROR EN GET KNOWLEDGE AREA BY ID:', error);
            throw error;
        }
    }

    //POST
    @Post('')
    async createKnowledgeArea(@Body() dto: CreateKnowledgeAreaDto){
        try{
            return await this.knowledgeAreaService.createKnowledgeArea(dto)
        }catch(error){
            console.error('ERROR EN POST KNOWLEDGE AREA:', error);
            throw error;
        }
    }

    //Put
    @Put(':id')
    async updateKnowledgeArea(@Body() dto: UpdateKnowledgeAreaDto, @Param('id') id: string){
        try{
            return await this.knowledgeAreaService.updateKnowledgeArea(id, dto)
        }catch(error){
            console.error('ERROR EN UPDATE KNOWLEDGE AREA:', error);
            throw error;
        }
    }

    //DELETE
    @Delete(':id')
    async deleteKnowledgeArea(@Param('id') id: string){
        try{
            return await this.knowledgeAreaService.deleteKnowledgeArea(id)
        }catch(error){
            console.error('ERROR EN DELETE KNOWLEDGE AREA:', error);
            throw error;
        }
    }
}
