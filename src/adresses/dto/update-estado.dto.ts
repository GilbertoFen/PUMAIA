import { IsNotEmpty, IsString } from "class-validator";


export class UpdateSpecDto {
    @IsString()
    @IsNotEmpty()
    name: string;
}
