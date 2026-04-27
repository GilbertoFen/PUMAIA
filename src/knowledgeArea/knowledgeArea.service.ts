import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateKnowledgeAreaDto } from './dto/createKnowledgeArea.dto';
import { UpdateKnowledgeAreaDto } from './dto/update-studentKnowledgeArea.dto';



@Injectable()
export class KnowledgeAreaService {

    constructor(private prisma: PrismaService) {}

    //GET
    async getAllKnowledgeAreas() {
        try {
            return await this.prisma.knowledgeArea.findMany();
        } catch (error) {
            console.error('ERROR EN GET ALL KNOWLEDGE AREAS:', error);
            throw error;
        }
    }

    async getKnowledgeAreaById(id: string) {
        try {
            return await this.prisma.knowledgeArea.findUnique({
                where: { id },
            });
        } catch (error) {
            console.error('ERROR EN GET KNOWLEDGE AREA BY ID:', error);
            throw error;
        }
    }

    //CREATE
    async createKnowledgeArea(dto: CreateKnowledgeAreaDto) {
        try {
            return await this.prisma.knowledgeArea.create({
                data: { ...dto },
            });
        } catch (error) {
            console.error('ERROR EN CREATE KNOWLEDGE AREA:', error);
            throw error;
        }
    }

    //UPDATE
    async updateKnowledgeArea(id: string, dto: UpdateKnowledgeAreaDto) {
        try {
            return await this.prisma.knowledgeArea.update({
                where: { id },
                data: { ...dto },
            });
        } catch (error) {
            console.error('ERROR EN UPDATE KNOWLEDGE AREA:', error);
            throw error;
        }
    }

    //DELETE
    async deleteKnowledgeArea(id: string){
        try {
            return await this.prisma.knowledgeArea.delete({
                where: { id }
            })
        } catch(error){
            console.error('ERROR EN DELETE KNOWLEDGE AREA:', error);
            throw error;
        }
    }

}