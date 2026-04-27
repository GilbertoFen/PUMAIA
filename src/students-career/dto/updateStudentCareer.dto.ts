import { IsString, IsBoolean, IsOptional } from 'class-validator';

export class UpdateStudentCareerDto {
    @IsString()
    @IsOptional()
    careerId?: string

    @IsString()
    @IsOptional()
    studentId?: string

    @IsBoolean()
    @IsOptional()
    isGraduated?: boolean
}