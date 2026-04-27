import { IsString, MinLength } from 'class-validator';

export class CreateColoniaDto {
  @IsString()
  @MinLength(2)
  name: string;
}