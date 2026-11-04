import { IsString, IsNotEmpty, IsOptional, IsInt, IsUrl, Min } from 'class-validator';

export class CreatePublicationDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsInt()
  @Min(1950)
  year?: number;

  @IsOptional()
  @IsString()
  url?: string;
}
