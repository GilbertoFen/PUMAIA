import { IsEmail, IsNotEmpty, IsString, IsInt } from "class-validator";

export class CreateAutenticacionDto {
    @IsEmail()
    email: string;

    @IsInt()
    @IsNotEmpty()
    accountNumber: number;

    @IsString()
    @IsNotEmpty()
    password: string;
}
