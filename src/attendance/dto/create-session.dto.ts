import { IsUUID, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSessionDto {
  @IsUUID()
  @IsNotEmpty()
  sectionId: string;

  @IsOptional()
  @IsString()
  date?: string;
}


