import { IsNotEmpty, IsString, IsUUID } from "class-validator";

export class CreateCourseDto {
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsUUID()
    categoryId: string;
}
