import { IsNotEmpty, IsNumber, IsString } from "class-validator";

export class CreateAdressDto {
    @IsString()
    @IsNotEmpty()
    street: string;
    @IsString()
    @IsNotEmpty()
    city: string;
    @IsString()
    @IsNotEmpty()
    state: string;
    @IsNotEmpty()
    @IsNumber()
    zipCode: number;
}
