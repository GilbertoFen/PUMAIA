import { IsString, IsInt, IsEnum, IsBoolean, IsOptional, Min } from 'class-validator';
import { QuestionType, CategoriaPregunta } from '@prisma/client';

export class UpdateQuestionDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  position?: number;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsEnum(CategoriaPregunta)
  category?: CategoriaPregunta;
}

