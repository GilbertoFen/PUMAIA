import { IsNumber, IsString, IsOptional, IsEnum, Min, Max } from 'class-validator';
import { EnrollmentStatus, EnrollmentSource } from '@prisma/client';

export class CreateGradeDto {
  @IsNumber()
  @Min(5, { message: 'La calificación mínima es 5' })
  @Max(10, { message: 'La calificación máxima es 10' })
  @IsOptional()
  grade?: number;

  @IsString()
  subjectID: string;

  @IsString()
  @IsOptional()
  studentID?: string;

  @IsString()
  @IsOptional()
  periodId?: string;

  @IsEnum(EnrollmentStatus)
  @IsOptional()
  status?: EnrollmentStatus;

  @IsNumber()
  @IsOptional()
  attempt?: number;

  @IsEnum(EnrollmentSource)
  @IsOptional()
  source?: EnrollmentSource;
}
