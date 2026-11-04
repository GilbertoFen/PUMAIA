import { IsString, IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { DocumentStatus } from '@prisma/client';

export class UpdateKnowledgeDocumentDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  chunkCount?: number;
}

