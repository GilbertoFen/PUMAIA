import { IsEnum, IsNotEmpty } from 'class-validator';
import { Category } from '../enum/category.enum';


export class CreateCategoryDto {
    @IsEnum(Category)
    @IsNotEmpty()
    category: Category;
}