import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class CreateAutenticacionDto {
    @IsEmail()
    email: string;

    @IsString()
    @IsNotEmpty()
    password: string;
}
