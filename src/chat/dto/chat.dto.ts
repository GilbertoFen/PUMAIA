import { IsString, IsOptional, IsNotEmpty, MinLength } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsOptional()
  conversationId?: string; // Si es nulo, creamos una nueva conv.
}

export class UpdateConversationDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  title: string;
}