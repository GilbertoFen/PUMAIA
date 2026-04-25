import { IsNumber, IsString } from 'class-validator';

export class CreateGradeDto {
    @IsNumber()
    grade: number

    @IsString()
    subjectID: string

    @IsString()
    studentID: string
}