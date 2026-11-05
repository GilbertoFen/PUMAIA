import {
  IsString,
  IsOptional,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsEnum,
  IsUUID,
  IsBoolean,
} from 'class-validator';
import { FeedbackValue } from '@prisma/client';

export class CreateMessageDto {
  @IsString({ message: 'El contenido del mensaje debe ser texto.' })
  @IsNotEmpty({ message: 'El contenido del mensaje no puede estar vacío.' })
  @MaxLength(2000, {
    message: 'El mensaje no puede exceder los 2000 caracteres.',
  })
  content: string;

  @IsOptional()
  @IsUUID('4', { message: 'El conversationId debe ser un UUID válido.' })
  conversationId?: string;

  /** El alumno puede pedir tratar esta conversación como sensible. Nunca se puede usar para quitar la marca. */
  @IsBoolean()
  @IsOptional()
  sensitive?: boolean;
}

export class UpdateConversationDto {
  @IsString({ message: 'El título debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El título no puede estar vacío.' })
  @MinLength(1)
  @MaxLength(100, { message: 'El título no puede exceder los 100 caracteres.' })
  title: string;
}

export class UpdateConversationSensitiveDto {
  @IsBoolean({ message: 'El indicador sensitive debe ser un valor booleano.' })
  sensitive: boolean;
}

export class MessageFeedbackDto {
  @IsEnum(FeedbackValue, {
    message: 'El valor de feedback debe ser UP o DOWN.',
  })
  value: FeedbackValue;

  @IsString()
  @IsOptional()
  @MaxLength(500, {
    message: 'El comentario no puede exceder los 500 caracteres.',
  })
  comment?: string;
}

export class CreatePsychologicalSummaryDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10, {
    message: 'El resumen psicológico debe tener al menos 10 caracteres.',
  })
  @MaxLength(5000, {
    message: 'El resumen psicológico no puede exceder los 5000 caracteres.',
  })
  content: string;

  @IsOptional()
  @IsUUID('4', { message: 'El conversationId debe ser un UUID válido.' })
  conversationId?: string;
}

export class UpdatePsychologicalSummaryDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(5000)
  content: string;
}

export class SharePsychologicalSummaryDto {
  @IsUUID('4', { message: 'El recipientId debe ser un UUID válido.' })
  @IsNotEmpty()
  recipientId: string;
}

/** El alumno solo puede etiquetar con MANUAL. Las etiquetas automáticas las pondrá un proceso interno. */
export class AddConversationLabelDto {
  @IsUUID('4', { message: 'El topicId debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'El topicId es obligatorio.' })
  topicId: string;
}
