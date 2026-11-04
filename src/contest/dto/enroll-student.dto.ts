import { IsUUID, IsNotEmpty, IsOptional } from 'class-validator';

export class EnrollStudentDto {
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsUUID()
  @IsNotEmpty()
  contestId!: string;
}