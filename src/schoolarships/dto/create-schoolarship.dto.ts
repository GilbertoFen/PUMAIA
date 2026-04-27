import { IsNotEmpty, IsString, IsUUID } from "class-validator";

export class CreateSchoolarshipDto {
    @IsString()
    @IsNotEmpty()
    name: string;
    @IsUUID()
    @IsNotEmpty()
    categoryId: string;
}
