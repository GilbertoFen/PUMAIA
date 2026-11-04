import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateKnowledgeDocumentDto } from './dto/create-knowledge-document.dto';
import { UpdateKnowledgeDocumentDto } from './dto/update-knowledge-document.dto';
import { DocumentStatus } from '@prisma/client';

@Injectable()
export class KnowledgeDocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra un nuevo documento fuente de conocimiento institucional.
   */
  async create(dto: CreateKnowledgeDocumentDto, uploadedByUserId?: string) {
    const institution = await this.prisma.institution.findUnique({
      where: { id: dto.institutionId },
    });
    if (!institution) {
      throw new NotFoundException('Institución no encontrada.');
    }

    return this.prisma.knowledgeDocument.create({
      data: {
        institutionId: dto.institutionId,
        title: dto.title.trim(),
        version: dto.version.trim(),
        sourceUrl: dto.sourceUrl?.trim() || null,
        status: DocumentStatus.PENDING,
        chunkCount: 0,
        uploadedBy: uploadedByUserId || null,
      },
      include: {
        institution: true,
      },
    });
  }

  /**
   * Lista documentos de conocimiento con filtros opcionales.
   */
  async findAll(status?: DocumentStatus, institutionId?: string) {
    return this.prisma.knowledgeDocument.findMany({
      where: {
        ...(status && { status }),
        ...(institutionId && { institutionId }),
      },
      include: {
        institution: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Obtiene un documento de conocimiento por ID.
   */
  async findOne(id: string) {
    const doc = await this.prisma.knowledgeDocument.findUnique({
      where: { id },
      include: { institution: true },
    });
    if (!doc) {
      throw new NotFoundException(`Documento con ID ${id} no encontrado.`);
    }
    return doc;
  }

  /**
   * Actualiza el estado o fragmentos indexados de un documento.
   */
  async update(id: string, dto: UpdateKnowledgeDocumentDto) {
    await this.findOne(id);

    return this.prisma.knowledgeDocument.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * Elimina un documento si su estado es PENDING o FAILED.
   */
  async remove(id: string) {
    const doc = await this.findOne(id);

    if (doc.status === DocumentStatus.INDEXED) {
      throw new BadRequestException(
        'No es posible eliminar un documento que ya se encuentra indexado en el vector store. Márquelo como REPLACED o desactívelo primero.',
      );
    }

    return this.prisma.knowledgeDocument.delete({
      where: { id },
    });
  }
}

