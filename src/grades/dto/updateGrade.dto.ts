import { IsNumber, IsString, IsOptional } from 'class-validator';

export class UpdateGradeDto {
    @IsNumber()
    @IsOptional()
    grade?: number
    
    @IsString()
    @IsOptional()
    subjectID?: string
    
    @IsString()
    @IsOptional()
    studentID?: string
}

export class ConfirmGradesDto {
  subjects: {
    subjectID: string;
    grade: number;
  }[];
}