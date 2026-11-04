import { PartialType } from '@nestjs/mapped-types';
import { CreateGradeDto } from './createGrade.dto';
import { IsArray, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { EnrollmentStatus } from '@prisma/client';

export class UpdateGradeDto extends PartialType(CreateGradeDto) {}

export class SubjectGradeItemDto {
  @IsString()
  @IsNotEmpty()
  subjectID: string;

  @IsInt()
  @Min(5)
  @Max(10)
  grade: number;

  @IsOptional()
  @IsEnum(EnrollmentStatus)
  status?: EnrollmentStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  attempt?: number;

  @IsOptional()
  @IsString()
  periodId?: string;
}

export class ConfirmGradesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubjectGradeItemDto)
  subjects: SubjectGradeItemDto[];
}
