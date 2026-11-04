import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';

export class UpdatePersonalProfileDto {
  @IsOptional()
  @IsString()
  preferredName?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  birthDay?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  birthMonth?: number;

  @IsOptional()
  @IsString()
  aboutMe?: string;
}

