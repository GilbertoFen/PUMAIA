import { IsString, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateQuestionOptionDto {
  @IsOptional()
  @IsString()
  value?: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  position?: number;
}

