import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/createCategory.dto';
import { UpdateCategoryDto } from './dto/updateCategory.dto';
import { JwtAuthGuard } from '../autenticacion/guards/jwt-auth.guard';
import { RolesGuard } from '../autenticacion/guards/roles.guard';
import { Roles } from '../autenticacion/decorators/roles.decorator';
import { RoleType } from '@prisma/client';

@Controller('category')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.INSTITUTION_ADMIN)
  @Post('')
  async createCategory(@Body() dto: CreateCategoryDto) {
    try {
      return await this.categoryService.createCategory(dto);
    } catch (error) {
      console.error('ERROR EN POST CATEGORY:', error);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.INSTITUTION_ADMIN)
  @Put(':id')
  async updateCategory(@Body() dto: UpdateCategoryDto, @Param('id') id: string) {
    try {
      return await this.categoryService.updateCategory(id, dto);
    } catch (error) {
      console.error('ERROR EN UPDATE CATEGORY:', error);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.INSTITUTION_ADMIN)
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
