import { IsNotEmpty, IsString } from "class-validator";


export class UpdateColoniaDto {
    @IsString()
    @IsNotEmpty()
    name: string;
}
