import {
  IsString,
  IsOptional,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsEnum,
  IsArray,
  IsUUID,
  IsBoolean,
} from 'class-validator';
import { FeedbackValue, LabelSource } from '@prisma/client';

export class CreateMessageDto {
  @IsString({ message: 'El contenido del mensaje debe ser texto.' })
  @IsNotEmpty({ message: 'El contenido del mensaje no puede estar vacío.' })
  @MaxLength(2000, { message: 'El mensaje no puede exceder los 2000 caracteres.' })
  content: string;

  @IsString()
  @IsOptional()
  @IsUUID('4', { message: 'El conversationId debe ser un UUID válido.' })
  conversationId?: string;

  @IsString()
  @IsOptional()
  student_profile?: string;

  @IsArray()
  @IsOptional()
  history?: any[];

  @IsBoolean()
  @IsOptional()
  sensitive?: boolean;
}

export class UpdateConversationDto {
  @IsString({ message: 'El título debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El título no puede estar vacío.' })
  @MinLength(1, { message: 'El título debe tener al menos 1 caracter.' })
  @MaxLength(100, { message: 'El título no puede exceder los 100 caracteres.' })
  title: string;
}

export class UpdateConversationSensitiveDto {
  @IsBoolean({ message: 'El indicador sensitive debe ser un valor booleano.' })
  sensitive: boolean;
}

export class MessageFeedbackDto {
  @IsEnum(FeedbackValue, { message: 'El valor de feedback debe ser UP o DOWN.' })
  value: FeedbackValue;

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'El comentario no puede exceder los 500 caracteres.' })
  comment?: string;
}

export class CreatePsychologicalSummaryDto {
  @IsString({ message: 'El contenido del resumen psicológico debe ser texto.' })
  @IsNotEmpty({ message: 'El contenido del resumen psicológico no puede estar vacío.' })
  @MinLength(10, { message: 'El resumen psicológico debe tener al menos 10 caracteres.' })
  @MaxLength(5000, { message: 'El resumen psicológico no puede exceder los 5000 caracteres.' })
  content: string;

  @IsOptional()
  @IsUUID('4', { message: 'El conversationId debe ser un UUID válido.' })
  conversationId?: string;
}

export class UpdatePsychologicalSummaryDto {
  @IsString({ message: 'El contenido del resumen psicológico debe ser texto.' })
  @IsNotEmpty({ message: 'El contenido del resumen psicológico no puede estar vacío.' })
  @MinLength(10, { message: 'El resumen psicológico debe tener al menos 10 caracteres.' })
  @MaxLength(5000, { message: 'El resumen psicológico no puede exceder los 5000 caracteres.' })
  content: string;
}

export class SharePsychologicalSummaryDto {
  @IsUUID('4', { message: 'El recipientId debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'El recipientId es obligatorio para compartir el resumen.' })
  recipientId: string;
}

export class AddConversationLabelDto {
  @IsUUID('4', { message: 'El topicId debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'El topicId es obligatorio.' })
  topicId: string;

  @IsOptional()
  @IsEnum(LabelSource)
  source?: LabelSource;

  @IsOptional()
  confidence?: number;

  @IsOptional()
  @IsString()
  modelVersion?: string;
}
