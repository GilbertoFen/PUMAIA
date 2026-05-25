import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SaveQuestionnaireDto } from './dto/save-questionnaire.dto';

@Injectable()
export class QuestionnaireService {
  constructor(private prisma: PrismaService) { }

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
  // 📝 MÉTODO NUEVO PARA ACTUALIZACIONES PARCIALES
  // 📝 MÉTODO CORREGIDO: Actualización de Cuestionario
  async updateAnswers(studentId: string, dto: any) { // Puedes usar tu SaveQuestionnaireDto si ya mapea esto
    return await this.prisma.$transaction(async (tx) => {

      for (const ans of dto.answers) {
        // 🔥 Extraemos las variables usando los nombres EXACTOS de tu JSON
        // Agregamos un fallback (||) por si en el futuro decides cambiarle el nombre
        const currentQuestionId = ans.questionId || ans.id;
        const currentAnswer = ans.answer || ans.value;

        // Si el front no manda categoría en la edición, ponemos una por defecto para que Prisma no explote al crear
        const currentCategory = ans.categoria || ans.category || 'INTERESES';

        await tx.questionnaireAnswer.upsert({
          where: {
            studentId_questionId: {
              studentId: studentId,
              questionId: currentQuestionId
            },
          },
          update: {
            answer: currentAnswer,
            // Omitimos actualizar la categoría aquí para no borrarla si el front no la mandó
          },
          create: {
            studentId: studentId,
            questionId: currentQuestionId,
            answer: currentAnswer,
            categoria: currentCategory,
          },
        });
      }

      return {
        message: 'Respuestas actualizadas correctamente',
        updatedFields: dto.answers.length
      };
    });
  }
}