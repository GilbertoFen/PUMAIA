import { IsNotEmpty, IsString } from "class-validator";


export class UpdateMunicipioDto {
    @IsString()
    @IsNotEmpty()
    name: string;
}
