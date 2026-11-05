import { Injectable, BadRequestException, BadGatewayException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AICategoryService } from '../ai-category/ai-category.service';
import { StudentsService } from '../students/students.service';
import { CreateAIResultDto } from './dto/create-ai-result.dto';

@Injectable()
export class AIResultService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiCategoryService: AICategoryService,
    private readonly studentsService: StudentsService,
  ) {}

  async create(dto: CreateAIResultDto) {
    return await this.prisma.aIResult.create({
      data: {
        studentId: dto.studentId,
        categoryId: dto.categoryId,
        modelVersion: dto.modelVersion ?? null,
        options: {
          createMany: {
            data: dto.options.map((opt) => ({
              position: opt.position,
              title: opt.title,
              description: opt.description,
            })),
          },
        },
      },
      include: {
        options: {
          orderBy: { position: 'asc' },
        },
      },
    });
  }

  async findByStudent(studentId: string) {
    return await this.prisma.aIResult.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      include: {
        options: {
          orderBy: { position: 'asc' },
        },
        category: true,
      },
    });
  }

  async processAndSaveAnalysis(studentId: string): Promise<any> {
    // 1. Obtener expediente relacional completo del alumno autenticado
    const student = await this.studentsService.getFullProfileSummary(studentId);
    if (!student) throw new BadRequestException('Estudiante no encontrado.');

    // Función auxiliar para aplanar respuestas del cuestionario
    const parseAnswerText = (ans: any): string => {
      if (!ans) return 'Sin responder';
      if (typeof ans === 'string') return ans;
      if (Array.isArray(ans)) return ans.join(', ');
      if (typeof ans === 'object') return `${ans.answer || ''} ${ans.exp ? `(${ans.exp})` : ''}`;
      return String(ans);
    };

    const enrolledSubjectsText = (student.enrollments || [])
      .map((e: any) => {
        const subName = e.subject?.subject || 'Asignatura';
        const gradeText = e.grade !== null && e.grade !== undefined ? `Calificación: ${e.grade}` : 'En curso';
        const statusText = e.status || '';
        return `- ${subName} (${gradeText}, ${statusText})`;
      })
      .join('\n      ');

    const languagesText = (student.languages || [])
      .map((l: any) => {
        const langName = l.language?.name || 'Idioma';
        const levelName = l.skill?.proficiency || l.skill?.name || 'Nivel no especificado';
        return `${langName} (Nivel: ${levelName})`;
      })
      .join(', ');

    const experiencesText = (student.experiences || [])
      .map((e: any) => {
        const areaName = e.areaExpertise?.name || 'General';
        const catName = e.category?.category || '';
        return `${areaName}${catName ? ` [${catName}]` : ''}`;
      })
      .join(', ');

    const studentContext = `
      Nombre del Alumno: ${student.fullName || `${student.name} ${student.lastNameP}`}
      Carrera: ${student.career || 'Licenciatura en Matemáticas Aplicadas y Computación'}
      Semestre Actual Detectado: ${student.currentSemester}° semestre
      Promedio General: ${student.average || 'Sin promedio registrado'}
      Intereses Declarados: ${student.interest || 'No declarados'}

      Historial Académico y Materias Cursadas:
      ${enrolledSubjectsText || 'Sin materias registradas aún'}

      Cursos Realizados: ${student.courses?.map((c: any) => c.course?.name).filter(Boolean).join(', ') || 'Ninguno'}
      Concursos y Competencias: ${student.contests?.map((cn: any) => cn.contest?.name).filter(Boolean).join(', ') || 'Ninguno'}
      Becas Académicas: ${student.schoolarships?.map((s: any) => s.schoolarship?.name).filter(Boolean).join(', ') || 'Ninguna'}
      Idiomas y Niveles: ${languagesText || 'Solo español nativo'}
      Experiencia Profesional y Áreas de Especialización: ${experiencesText || 'Sin experiencia profesional previa'}

      Respuestas del Cuestionario Inicial Vocacional y Habilidades:
      ${student.answers?.map((a: any, index: number) => `Pregunta ${index + 1} [ID: ${a.questionId}] (${a.category || 'General'}): ${parseAnswerText(a.answer)}`).join('\n  ') || 'No ha respondido el cuestionario base.'}
    `.trim();

    // 2. Petición a FastAPI en Render con timeout de 75 segundos para tolerar cold-start
    const fastApiUrl = process.env.FASTAPI_URL || 'https://server-genai.onrender.com/analyze-profile';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 75000);

    let response: any;
    try {
      response = await fetch(fastApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_context: studentContext }),
        signal: controller.signal,
      });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new BadGatewayException(
          'El servidor de inteligencia artificial (Render) está iniciando o tardó demasiado en responder. Por favor reintenta en unos instantes.',
        );
      }
      throw new BadGatewayException(
        `Error de conexión con el motor de análisis PumaIA: ${err.message || 'Servidor no disponible'}`,
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new BadGatewayException(
        `El motor de análisis PumaIA devolvió un error (HTTP ${response.status}). ${errBody ? `Detalle: ${errBody}` : 'Intenta nuevamente más tarde.'}`,
      );
    }

    const aiData = await response.json();

    // 3. Validar categorías de IA desde el catálogo
    const aiCategories = await this.aiCategoryService.findAll();
    let defaultCategoryId: string;

    if (aiCategories.length === 0) {
      const newCat = await this.prisma.aICategory.create({
        data: { name: 'Rutas Profesionales' },
      });
      defaultCategoryId = newCat.id;
    } else {
      defaultCategoryId = aiCategories[0].id;
    }

    // 4. Preparar opciones dinámicas para AIResultOption SIN inventar opciones dummy
    const structuredOptions: { position: number; title: string; description: string }[] = [];

    const serializedDescriptionA = `${aiData.descriptionA || ''}||${aiData.meta_summary || ''}||${aiData.meta_strengths || ''}||${aiData.meta_opportunities || ''}`;

    if (Array.isArray(aiData.options) && aiData.options.length > 0) {
      const validOptions = aiData.options
        .filter((o: any) => o && (o.title || o.option))
        .slice(0, 5);

      validOptions.forEach((opt: any, index: number) => {
        const desc = index === 0 ? (opt.description || serializedDescriptionA) : (opt.description || '');
        structuredOptions.push({
          position: index + 1,
          title: String(opt.title || opt.option).trim(),
          description: desc,
        });
      });
    } else {
      const candidates = [
        { title: aiData.optionA, description: serializedDescriptionA },
        { title: aiData.optionB, description: aiData.descriptionB || '' },
        { title: aiData.optionC, description: aiData.descriptionC || '' },
        { title: aiData.optionD, description: aiData.descriptionD || '' },
        { title: aiData.optionE, description: aiData.descriptionE || '' },
      ];

      candidates.forEach((cand) => {
        if (cand.title && typeof cand.title === 'string' && cand.title.trim().length > 0) {
          structuredOptions.push({
            position: structuredOptions.length + 1,
            title: cand.title.trim(),
            description: cand.description || '',
          });
        }
      });
    }

    if (structuredOptions.length === 0) {
      throw new BadRequestException('El motor de IA no generó recomendaciones vocacionales válidas.');
    }

    // 5. Persistencia relacional atómica (esquema v3: AIResult + AIResultOption)
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.aIResult.findFirst({
        where: { studentId },
        orderBy: { createdAt: 'desc' },
      });

      let targetResultId: string;

      if (existing) {
        targetResultId = existing.id;
        await tx.aIResult.update({
          where: { id: targetResultId },
          data: {
            categoryId: defaultCategoryId,
            createdAt: new Date(),
          },
        });
        await tx.aIResultOption.deleteMany({
          where: { resultId: targetResultId },
        });
      } else {
        const created = await tx.aIResult.create({
          data: {
            studentId,
            categoryId: defaultCategoryId,
          },
        });
        targetResultId = created.id;
      }

      await tx.aIResultOption.createMany({
        data: structuredOptions.map((opt) => ({
          resultId: targetResultId,
          position: opt.position,
          title: opt.title,
          description: opt.description,
        })),
      });
    });

    return aiData;
  }
}
