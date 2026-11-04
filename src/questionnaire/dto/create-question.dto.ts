import { IsString, IsNotEmpty, IsInt, IsEnum, IsBoolean, IsOptional, Min } from 'class-validator';
import { QuestionType, CategoriaPregunta } from '@prisma/client';

export class CreateQuestionDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsInt()
  @Min(1)
  position: number;

  @IsString()
  @IsNotEmpty()
  text: string;

  @IsEnum(QuestionType)
  type: QuestionType;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsEnum(CategoriaPregunta)
  category?: CategoriaPregunta;
}

