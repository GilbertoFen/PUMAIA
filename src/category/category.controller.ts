import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { CategoryService } from './category.service';
//Dto's
import { CreateCategoryDto } from './dto/createCategory.dto';
import { UpdateCategoryDto } from './dto/updateCategory.dto';

@Controller('category')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  //GET
  @Get('')
  async getAllCategories() {
    try {
      return await this.categoryService.getAllCategories();
    } catch (error) {
      console.error('ERROR EN GET ALL CATEGORIES:', error);
      throw error;
    }
  }

  @Get(':id')
  async getCategoryById(@Param('id') id: string) {
    try {
      return await this.categoryService.getCategoryById(id);
    } catch (error) {
      console.error('ERROR EN GET CATEGORY BY ID:', error);
      throw error;
    }
  }

  //POST
  @Post('')
  async createCategory(@Body() dto: CreateCategoryDto) {
    try {
      return await this.categoryService.createCategory(dto);
    } catch (error) {
      console.error('ERROR EN POST CATEGORY:', error);
      throw error;
    }
  }

  //Put
  @Put(':id')
  async updateCategory(@Body() dto: UpdateCategoryDto, @Param('id') id: string) {
    try {
      return await this.categoryService.updateCategory(id, dto);
    } catch (error) {
      console.error('ERROR EN UPDATE CATEGORY:', error);
      throw error;
    }
  }

  //DELETE
  @Delete(':id')
  async deleteCategory(@Param('id') id: string) {
    try {
      return await this.categoryService.deleteCategory(id);
    } catch (error) {
      console.error('ERROR EN DELETE CATEGORY:', error);
      throw error;
    }
  }
}
