import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SaveQuestionnaireDto } from './dto/save-questionnaire.dto';

@Injectable()
export class QuestionnaireService {
  constructor(private prisma: PrismaService) {}

  async saveAll(studentId: string, dto: SaveQuestionnaireDto) {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Guardar/Actualizar cada respuesta
      for (const ans of dto.answers) {
        await tx.questionnaireAnswer.upsert({
          where: {
            studentId_questionId: { studentId, questionId: ans.id },
          },
          update: { 
            answer: ans.value, 
            categoria: ans.category 
          },
          create: {
            studentId,
            questionId: ans.id,
            answer: ans.value,
            categoria: ans.category,
          },
        });
      }

      // 2. Marcar cuestionario como completado
      return await tx.student.update({
        where: { id: studentId },
        data: { hasCompletedQuiz: true },
      });
    });
  }

  async getAnswers(studentId: string) {
    return this.prisma.questionnaireAnswer.findMany({
      where: { studentId },
    });
  }
}