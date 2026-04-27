import { IsString, IsBoolean } from 'class-validator';

export class CreateStudentCareerDto {
    @IsString()
    careerId: string

    @IsString()
    studentId: string

    @IsBoolean()
    isGraduated: boolean
}