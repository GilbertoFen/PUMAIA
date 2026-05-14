import { IsArray, IsString, IsNotEmpty, IsObject, IsEnum } from 'class-validator';
import { CategoriaPregunta } from '@prisma/client';

export class AnswerItemDto {
  @IsString()
  @IsNotEmpty()
  id: string; // El questionId del front

  @IsEnum(CategoriaPregunta)
  category: CategoriaPregunta;

  @IsNotEmpty()
  value: any; // Aquí puede venir el string, array o el objeto de proyectos
}

export class SaveQuestionnaireDto {
  @IsArray()
  answers: AnswerItemDto[];
}