import { IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class CreateCourseUserDto {
    @IsNotEmpty()
    @IsUUID()
    courseId: string;

    @IsOptional()
    @IsUUID()
    studentId?: string;
}