import { IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
import { Category } from '../enum/category.enum';


export class UpdateCategoryDto {
    @IsEnum(Category)
    @IsNotEmpty()
    @IsOptional()
    category: Category;
}