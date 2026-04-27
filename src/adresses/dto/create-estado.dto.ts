import { IsString, MinLength } from 'class-validator';

export class CreateEstadoDto {
  @IsString()
  @MinLength(2)
  name: string;
}