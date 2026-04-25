import { IsString } from "class-validator"


export class CreateSubjectDto {
    @IsString()
    subject: string

    @IsString()
    categoryID: string

}
