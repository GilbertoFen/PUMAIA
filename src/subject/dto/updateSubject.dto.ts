import { IsString, IsOptional } from "class-validator"


export class UpdateSubjectDto {
    @IsString()
    @IsOptional()
    subject?: string
    
    @IsString()
    @IsOptional()
    categoryID?: string

}
