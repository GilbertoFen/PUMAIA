import { IsEnum, IsInt, IsOptional, IsBoolean, Min } from 'class-validator';
import { QuestionnaireKind } from '@prisma/client';

export class CreateQuestionnaireDto {
  @IsEnum(QuestionnaireKind)
  kind: QuestionnaireKind;

  @IsInt()
  @Min(1)
  version: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

