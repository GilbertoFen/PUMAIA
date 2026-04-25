import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
//Dtos's
import { CreateCareerDto } from "./dto/createCareer.dto";
import { UpdateCareerDto } from "./dto/updateCareer.dto";


@Injectable()
export class CareerService{
    constructor (private prisma: PrismaService) {}

    //GET
    async getAllCareers(){
        try{
            return await this.prisma.career.findMany();
        } catch(error){
            console.log("ERROR EN GEL ALL CAREERS", error);
            throw error;
        }
    }

    async getCareerById(id: string) {
        try {
            return await this.prisma.career.findUnique({
                where: { id },
            });
        } catch (error) {
            console.error('ERROR EN GET CAREER BY ID:', error);
            throw error;
        }
    }

    //CREATE
    async createCareer(dto: CreateCareerDto) {
            try {
                return await this.prisma.career.create({
                    data: { ...dto },
                });
            } catch (error) {
                console.error('ERROR EN CREATE CAREER:', error);
                throw error;
            }
    }

    //UPDATE
    async updateCareer(id: string, dto: UpdateCareerDto){
        try {
            return await this.prisma.career.update({
                where: { id },
                data: { ...dto },
            });
        } catch (error) {
            console.error('ERROR EN UPDATE CAREER:', error);
            throw error;
        }
    }

    //DELETE
    async deleteCareer(id: string){
        try {
            return await this.prisma.career.delete({
                where: { id }
            })
        } catch(error){
            console.error('ERROR EN DELETE CAREER:', error);
            throw error;
        }
    }

}
