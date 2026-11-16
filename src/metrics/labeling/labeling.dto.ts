import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class LabelingQueueQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit debe ser un entero' })
  @Min(1)
  @Max(50)
  limit?: number;
}

export class AddLabelsDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Indica al menos un tema.' })
  @ArrayMaxSize(5, { message: 'Máximo 5 temas por conversación.' })
  @ArrayUnique()
  @IsUUID('all', {
    each: true,
    message: 'Cada topicId debe ser un UUID válido.',
  })
  topicIds: string[];
}
