import { IsNotEmpty, IsUUID } from "class-validator";

export class CreateSchoolarshipUsersDto {
    @IsUUID ()
    @IsNotEmpty()
    schoolarshipId: string;
    @IsNotEmpty()
    @IsUUID()
    userId: string;
}