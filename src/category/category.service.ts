import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
//DTO's
import { CreateCategoryDto } from './dto/createCategory.dto';
import { UpdateCategoryDto } from './dto/updateCategory.dto';



@Injectable()
export class CategoryService {

    constructor(private prisma: PrismaService) {}

    //GET
    async getAllCategories() {
        try {
            return await this.prisma.category.findMany();
        } catch (error) {
            console.error('ERROR EN GET ALL CATEGORIES:', error);
            throw error;
        }
    }

    async getCategoryById(id: string) {
        try {
            return await this.prisma.category.findUnique({
                where: { id },
            });
        } catch (error) {
            console.error('ERROR EN GET CATEGORY BY ID:', error);
            throw error;
        }
    }

    //CREATE
    async createCategory(dto: CreateCategoryDto) {
        try {
            return await this.prisma.category.create({
                data: { ...dto },
            });
        } catch (error) {
            console.error('ERROR EN CREATE CATEGORY:', error);
            throw error;
        }
    }

    //UPDATE
    async updateCategory(id: string, dto: UpdateCategoryDto) {
        try {
            return await this.prisma.category.update({
                where: { id },
                data: { ...dto },
            });
        } catch (error) {
            console.error('ERROR EN UPDATE CATEGORY:', error);
            throw error;
        }
    }

    //DELETE
    async deleteCategory(id: string){
        try {
            return await this.prisma.category.delete({
                where: { id }
            })
        } catch(error){
            console.error('ERROR EN DELETE CATEGORY:', error);
            throw error;
        }
    }

}