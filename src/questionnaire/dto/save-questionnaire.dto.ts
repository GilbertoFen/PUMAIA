import { IsArray, IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class AnswerItemDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsOptional()
  @IsString()
  optionId?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  categoria?: string;

  @IsNotEmpty()
  value: any;
}

export class SaveQuestionnaireDto {
  @IsArray()
  answers: AnswerItemDto[];
}
