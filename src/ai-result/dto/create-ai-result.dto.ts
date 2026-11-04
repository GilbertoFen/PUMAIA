import { IsString, IsNotEmpty, IsUUID, IsOptional, IsArray, ValidateNested, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class AIResultOptionDto {
  @IsInt()
  position: number;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;
}

export class CreateAIResultDto {
  @IsUUID()
  @IsNotEmpty()
  studentId: string;

  @IsUUID()
  @IsNotEmpty()
  categoryId: string;

  @IsString()
  @IsOptional()
  modelVersion?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AIResultOptionDto)
  options: AIResultOptionDto[];
}
