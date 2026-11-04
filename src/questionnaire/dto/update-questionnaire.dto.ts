import { IsEnum, IsInt, IsOptional, IsBoolean, Min } from 'class-validator';
import { QuestionnaireKind } from '@prisma/client';

export class UpdateQuestionnaireDto {
  @IsOptional()
  @IsEnum(QuestionnaireKind)
  kind?: QuestionnaireKind;

  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

