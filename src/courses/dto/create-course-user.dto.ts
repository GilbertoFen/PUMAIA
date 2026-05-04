import { IsNotEmpty, IsUUID } from "class-validator";

export class CreateCourseUserDto {
    @IsNotEmpty()
    @IsUUID()
    courseId: string;
    @IsUUID()
    @IsNotEmpty()
    studentId: string;
}