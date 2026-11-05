import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SaveQuestionnaireDto } from './dto/save-questionnaire.dto';
import { CreateQuestionnaireDto } from './dto/create-questionnaire.dto';
import { UpdateQuestionnaireDto } from './dto/update-questionnaire.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { CreateQuestionOptionDto } from './dto/create-question-option.dto';
import { UpdateQuestionOptionDto } from './dto/update-question-option.dto';
import {
  QuestionnaireKind,
  QuestionType,
} from '@prisma/client';

@Injectable()
export class QuestionnaireService {
  constructor(private readonly prisma: PrismaService) {}

  // =========================================================================
  // 1. GESTIÓN DE CUESTIONARIOS (Questionnaire)
  // =========================================================================

  /**
   * Crea un nuevo cuestionario.
   */
  async createQuestionnaire(dto: CreateQuestionnaireDto) {
    const existing = await this.prisma.questionnaire.findUnique({
      where: {
        kind_version: {
          kind: dto.kind,
          version: dto.version,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Ya existe un cuestionario del tipo ${dto.kind} con la versión ${dto.version}.`,
      );
    }

    return this.prisma.questionnaire.create({
      data: {
        kind: dto.kind,
        version: dto.version,
        active: dto.active ?? true,
      },
    });
  }

  /**
   * Lista todos los cuestionarios con conteo de preguntas y envíos.
   */
  async findAllQuestionnaires(kind?: QuestionnaireKind) {
    return this.prisma.questionnaire.findMany({
      where: kind ? { kind } : undefined,
      orderBy: [{ kind: 'asc' }, { version: 'desc' }],
      include: {
        _count: {
          select: {
            questions: true,
            responses: true,
          },
        },
      },
    });
  }

  /**
   * Obtiene un cuestionario por ID con sus preguntas y opciones ordenadas.
   */
  async findOneQuestionnaire(id: string) {
    const questionnaire = await this.prisma.questionnaire.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { position: 'asc' },
          include: {
            options: {
              orderBy: { position: 'asc' },
            },
          },
        },
        _count: {
          select: { responses: true },
        },
      },
    });

    if (!questionnaire) {
      throw new NotFoundException(`Cuestionario con ID ${id} no encontrado.`);
    }

    return questionnaire;
  }

  /**
   * Obtiene o crea el cuestionario activo por tipo (por defecto ONBOARDING versión 1).
   */
  async getOrCreateActiveQuestionnaire(
    kind: QuestionnaireKind = QuestionnaireKind.ONBOARDING,
  ) {
    let questionnaire = await this.prisma.questionnaire.findFirst({
      where: { kind, active: true },
      orderBy: { version: 'desc' },
      include: {
        questions: {
          orderBy: { position: 'asc' },
          include: { options: { orderBy: { position: 'asc' } } },
        },
      },
    });

    if (!questionnaire) {
      questionnaire = await this.prisma.questionnaire.create({
        data: {
          kind,
          version: 1,
          active: true,
        },
        include: {
          questions: {
            include: { options: true },
          },
        },
      });
    }

    if (
      kind === QuestionnaireKind.ONBOARDING &&
      (!questionnaire.questions || questionnaire.questions.length === 0)
    ) {
      await this.ensureDefaultOnboardingQuestions(questionnaire.id);
      questionnaire = (await this.prisma.questionnaire.findUnique({
        where: { id: questionnaire.id },
        include: {
          questions: {
            orderBy: { position: 'asc' },
            include: { options: { orderBy: { position: 'asc' } } },
          },
        },
      })) || questionnaire;
    }

    return questionnaire;
  }

  /**
   * Actualiza el estado o versión de un cuestionario.
   */
  async updateQuestionnaire(id: string, dto: UpdateQuestionnaireDto) {
    await this.findOneQuestionnaire(id);

    return this.prisma.questionnaire.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * Elimina un cuestionario si no cuenta con envíos de respuestas registrados.
   */
  async deleteQuestionnaire(id: string) {
    const questionnaire = await this.findOneQuestionnaire(id);

    if (questionnaire._count.responses > 0) {
      throw new BadRequestException(
        'No es posible eliminar un cuestionario que ya posee respuestas de alumnos.',
      );
    }

    return this.prisma.questionnaire.delete({
      where: { id },
    });
  }

  // =========================================================================
  // 2. GESTIÓN DE PREGUNTAS (Question)
  // =========================================================================

  /**
   * Agrega una pregunta a un cuestionario.
   */
  async createQuestion(questionnaireId: string, dto: CreateQuestionDto) {
    await this.findOneQuestionnaire(questionnaireId);

    const existingCode = await this.prisma.question.findUnique({
      where: {
        questionnaireId_code: {
          questionnaireId,
          code: dto.code,
        },
      },
    });

    if (existingCode) {
      throw new ConflictException(
        `Ya existe una pregunta con la clave "${dto.code}" en este cuestionario.`,
      );
    }

    return this.prisma.question.create({
      data: {
        questionnaireId,
        code: dto.code,
        position: dto.position,
        text: dto.text,
        type: dto.type,
        required: dto.required ?? true,
        category: dto.category ?? null,
      },
      include: {
        options: true,
      },
    });
  }

  /**
   * Actualiza una pregunta.
   */
  async updateQuestion(id: string, dto: UpdateQuestionDto) {
    const question = await this.prisma.question.findUnique({ where: { id } });
    if (!question) {
      throw new NotFoundException(`Pregunta con ID ${id} no encontrada.`);
    }

    return this.prisma.question.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * Elimina una pregunta si no tiene respuestas asociadas.
   */
  async deleteQuestion(id: string) {
    const answersCount = await this.prisma.answer.count({
      where: { questionId: id },
    });

    if (answersCount > 0) {
      throw new BadRequestException(
        'No es posible eliminar una pregunta que ya cuenta con respuestas registradas.',
      );
    }

    return this.prisma.question.delete({
      where: { id },
    });
  }

  // =========================================================================
  // 3. GESTIÓN DE OPCIONES DE PREGUNTAS (QuestionOption)
  // =========================================================================

  /**
   * Agrega una opción a una pregunta.
   */
  async createOption(questionId: string, dto: CreateQuestionOptionDto) {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
    });
    if (!question) {
      throw new NotFoundException(
        `Pregunta con ID ${questionId} no encontrada.`,
      );
    }

    const existingValue = await this.prisma.questionOption.findUnique({
      where: {
        questionId_value: {
          questionId,
          value: dto.value,
        },
      },
    });

    if (existingValue) {
      throw new ConflictException(
        `Ya existe una opción con el valor "${dto.value}" para esta pregunta.`,
      );
    }

    return this.prisma.questionOption.create({
      data: {
        questionId,
        value: dto.value,
        label: dto.label,
        position: dto.position,
      },
    });
  }

  /**
   * Actualiza una opción de pregunta.
   */
  async updateOption(id: string, dto: UpdateQuestionOptionDto) {
    const option = await this.prisma.questionOption.findUnique({
      where: { id },
    });
    if (!option) {
      throw new NotFoundException(`Opción con ID ${id} no encontrada.`);
    }

    return this.prisma.questionOption.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * Elimina una opción si no tiene respuestas vinculadas.
   */
  async deleteOption(id: string) {
    const answersCount = await this.prisma.answer.count({
      where: { optionId: id },
    });

    if (answersCount > 0) {
      throw new BadRequestException(
        'No es posible eliminar una opción seleccionada previamente por alumnos.',
      );
    }

    return this.prisma.questionOption.delete({
      where: { id },
    });
  }

  // =========================================================================
  // 4. ENVÍOS Y RESPUESTAS DEL ALUMNO (Response y Answer)
  // =========================================================================

  /**
   * Guarda las respuestas de un estudiante para el cuestionario activo.
   * Reglas de integridad:
   * 1. Impide responder el cuestionario ONBOARDING más de una vez (ConflictException).
   * 2. Valida que todas las preguntas obligatorias (required: true) del cuestionario activo sean respondidas.
   * 3. Prohíbe la creación arbitraria de preguntas desde el cliente: cada pregunta debe existir en el cuestionario activo.
   * 4. Valida estrictamente que las opciones seleccionadas pertenezcan a la pregunta correspondiente del cuestionario activo.
   */
  async saveAll(
    studentId: string,
    dto: SaveQuestionnaireDto,
    options?: { allowOnboardingUpdate?: boolean },
  ) {
    if (
      !dto ||
      !dto.answers ||
      !Array.isArray(dto.answers) ||
      dto.answers.length === 0
    ) {
      throw new BadRequestException(
        'Se requiere al menos una respuesta válida para procesar el cuestionario.',
      );
    }

    return await this.prisma.$transaction(async (tx) => {
      // 1. Obtener cuestionario ONBOARDING activo
      let questionnaire = await tx.questionnaire.findFirst({
        where: { kind: QuestionnaireKind.ONBOARDING, active: true },
        orderBy: { version: 'desc' },
      });

      if (!questionnaire) {
        questionnaire = await tx.questionnaire.create({
          data: {
            kind: QuestionnaireKind.ONBOARDING,
            version: 1,
            active: true,
          },
        });
      }

      const questionCount = await tx.question.count({
        where: { questionnaireId: questionnaire.id },
      });
      if (questionCount === 0) {
        await this.ensureDefaultOnboardingQuestions(questionnaire.id, tx);
      }

      // 2. Verificar si ya existe un envío previo para este estudiante y cuestionario
      let response = await tx.response.findFirst({
        where: {
          studentId,
          questionnaireId: questionnaire.id,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (
        questionnaire.kind === QuestionnaireKind.ONBOARDING &&
        !options?.allowOnboardingUpdate
      ) {
        if (response) {
          throw new ConflictException(
            'El cuestionario de diagnóstico inicial (ONBOARDING) ya fue respondido por este estudiante y no puede enviarse más de una vez.',
          );
        }

        if (typeof (tx.student as any)?.findUnique === 'function') {
          const existingStudent = await (tx.student as any).findUnique({
            where: { id: studentId },
            select: { hasCompletedQuiz: true },
          });
          if (existingStudent?.hasCompletedQuiz === true) {
            throw new ConflictException(
              'El estudiante ya completó previamente el cuestionario de diagnóstico inicial (ONBOARDING).',
            );
          }
        }
      }

      // 3. Validar que todas las preguntas obligatorias (required: true) del cuestionario activo estén respondidas
      if (
        !options?.allowOnboardingUpdate &&
        typeof (tx.question as any)?.findMany === 'function'
      ) {
        const requiredQuestions =
          (await tx.question.findMany({
            where: {
              questionnaireId: questionnaire.id,
              required: true,
            },
          })) || [];

        const answeredCodes = new Map<string, any>();
        for (const ans of dto.answers) {
          if (ans && ans.id) {
            answeredCodes.set(String(ans.id).trim(), ans);
          }
        }

        for (const reqQ of requiredQuestions) {
          const provided = answeredCodes.get(reqQ.code);
          const hasOption = Boolean(provided?.optionId);
          const hasValue =
            provided?.value !== undefined &&
            provided?.value !== null &&
            String(provided.value).trim() !== '';

          if (!provided || (!hasOption && !hasValue)) {
            throw new BadRequestException(
              `Falta responder la pregunta obligatoria "${reqQ.code}" (${reqQ.text || reqQ.code}).`,
            );
          }
        }
      }

      const preparedAnswers: Array<{
        questionId: string;
        optionId: string | null;
        numberValue: number | null;
        textValue: string | null;
      }> = [];

      // 4. Procesar y validar cada respuesta contra el catálogo del cuestionario activo
      for (const ans of dto.answers) {
        if (!ans || !ans.id) {
          throw new BadRequestException(
            'Todas las respuestas deben incluir el código de pregunta (id).',
          );
        }

        const questionCode = String(ans.id).trim();

        // Buscar la pregunta dentro de este cuestionario activo (PROHIBIDO auto-crear preguntas desde el cliente)
        const question = await tx.question.findUnique({
          where: {
            questionnaireId_code: {
              questionnaireId: questionnaire.id,
              code: questionCode,
            },
          },
        });

        if (!question) {
          throw new BadRequestException(
            `La pregunta "${questionCode}" no existe en el cuestionario activo. No se permite inyectar preguntas arbitrarias desde el cliente.`,
          );
        }

        if (
          question.questionnaireId &&
          question.questionnaireId !== questionnaire.id
        ) {
          throw new BadRequestException(
            `La pregunta "${questionCode}" no pertenece al cuestionario activo.`,
          );
        }

        // Validación estricta de pertenencia de opción a ESTA pregunta
        let validOptionId: string | null = null;
        if (ans.optionId) {
          const option = await tx.questionOption.findFirst({
            where: {
              id: ans.optionId,
              questionId: question.id,
            },
          });
          if (!option) {
            throw new BadRequestException(
              `La opción "${ans.optionId}" no pertenece a la pregunta "${questionCode}" del cuestionario activo.`,
            );
          }
          validOptionId = option.id;
        } else if (typeof ans.value === 'string') {
          const option = await tx.questionOption.findFirst({
            where: {
              questionId: question.id,
              OR: [{ id: ans.value }, { value: ans.value }],
            },
          });
          if (option) {
            validOptionId = option.id;
          } else if (question.type === QuestionType.SINGLE_CHOICE) {
            throw new BadRequestException(
              `El valor "${ans.value}" no corresponde a una opción válida de la pregunta "${questionCode}".`,
            );
          }
        }

        // Almacenamiento limpio de tipos
        let numberVal: number | null = null;
        let textVal: string | null = null;

        if (typeof ans.value === 'number') {
          numberVal = ans.value;
        } else if (typeof ans.value === 'string') {
          const trimmed = ans.value.trim();
          const parsed = parseInt(trimmed, 10);
          if (!isNaN(parsed) && String(parsed) === trimmed) {
            numberVal = parsed;
          } else {
            textVal = ans.value;
          }
        } else if (ans.value !== undefined && ans.value !== null) {
          textVal = JSON.stringify(ans.value);
        }

        preparedAnswers.push({
          questionId: question.id,
          optionId: validOptionId,
          numberValue: numberVal,
          textValue: textVal,
        });
      }

      if (!response) {
        response = await tx.response.create({
          data: {
            studentId,
            questionnaireId: questionnaire.id,
          },
        });
      }

      for (const prep of preparedAnswers) {
        // Eliminar respuestas anteriores de esta pregunta en este envío para prevenir duplicados
        await tx.answer.deleteMany({
          where: {
            responseId: response.id,
            questionId: prep.questionId,
          },
        });

        await tx.answer.create({
          data: {
            responseId: response.id,
            questionId: prep.questionId,
            optionId: prep.optionId,
            numberValue: prep.numberValue,
            textValue: prep.textValue,
          },
        });
      }

      // 5. Marcar que el estudiante ha completado el cuestionario
      await tx.student.update({
        where: { id: studentId },
        data: { hasCompletedQuiz: true },
      });

      return {
        message: 'Cuestionario guardado exitosamente',
        totalAnswers: dto.answers.length,
      };
    });
  }

  /**
   * Obtiene las respuestas del estudiante en formato compatible con el frontend existente.
   */
  async getAnswers(studentId: string) {
    const latestResponse = await this.prisma.response.findFirst({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      include: {
        answers: {
          include: {
            question: true,
            option: true,
          },
        },
      },
    });

    if (!latestResponse || !latestResponse.answers) {
      return [];
    }

    return latestResponse.answers.map((ans) => {
      let finalVal: any =
        ans.option?.value ||
        ans.option?.label ||
        (ans.textValue !== null && ans.textValue !== undefined
          ? ans.textValue
          : ans.numberValue !== null && ans.numberValue !== undefined
            ? ans.numberValue
            : '');

      if (typeof ans.textValue === 'string') {
        const trimmed = ans.textValue.trim();
        if (
          (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
          (trimmed.startsWith('[') && trimmed.endsWith(']'))
        ) {
          try {
            finalVal = JSON.parse(trimmed);
          } catch {
            finalVal = ans.textValue;
          }
        }
      }

      return {
        id: ans.id,
        questionId: ans.question.code,
        category: ans.question.category,
        optionId: ans.optionId,
        answer: finalVal,
      };
    });
  }

  /**
   * Actualización explícita de respuestas del alumno (endpoint PATCH /api/questionnaire/update).
   * Sigue validando estrictamente que preguntas y opciones existan en el cuestionario activo.
   */
  async updateAnswers(studentId: string, dto: SaveQuestionnaireDto) {
    return this.saveAll(studentId, dto, { allowOnboardingUpdate: true });
  }

  /**
   * Retorna los envíos históricos de un estudiante.
   */
  async getStudentResponses(studentId: string) {
    return this.prisma.response.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      include: {
        questionnaire: true,
        answers: {
          include: {
            question: true,
            option: true,
          },
        },
      },
    });
  }

  /**
   * Garantiza la existencia de las preguntas y opciones oficiales de ONBOARDING.
   */
  async ensureDefaultOnboardingQuestions(questionnaireId: string, client?: any) {
    const db = client || this.prisma;
    const defaultQuestions = [
      {
        code: 'tiempo_traslado',
        text: '¿Cuánto tiempo te toma en promedio trasladarte de tu casa a la FES Acatlán (solo trayecto de ida)?',
        type: QuestionType.SINGLE_CHOICE,
        category: 'EXPECTATIVAS',
        position: 1,
        options: [
          'Menos de 45 minutos',
          'Entre 45 y 90 minutos',
          'Entre 1.5 y 2.5 horas',
          'Más de 2.5 horas (Zona foránea / trayecto largo)',
        ],
      },
      {
        code: 'situacion_laboral',
        text: '¿Cuál es tu situación laboral actual durante el semestre escolar?',
        type: QuestionType.SINGLE_CHOICE,
        category: 'EXPECTATIVAS',
        position: 2,
        options: [
          'Dedicación exclusiva al estudio (No trabajo)',
          'Trabajo de medio tiempo / becario (< 20 horas por semana)',
          'Trabajo de tiempo completo (> 35 horas por semana)',
          'No trabajo actualmente, pero busco empleo activo',
        ],
      },
      {
        code: 'equipo_computo',
        text: '¿Cuentas con equipo de cómputo propio y conexión a internet suficiente para programar y hacer proyectos en casa?',
        type: QuestionType.SINGLE_CHOICE,
        category: 'EXPECTATIVAS',
        position: 3,
        options: [
          'Sí, cuento con laptop/PC adecuada para programar y compilar',
          'Cuento con equipo pero es compartido o con rendimiento limitado',
          'No, dependo enteramente de las salas y laboratorios de cómputo de Acatlán',
        ],
      },
      {
        code: 'materias_fuertes',
        text: '¿En cuáles de las siguientes áreas sientes que tienes mayor facilidad, fortaleza o gusto personal?',
        type: QuestionType.MULTI_CHOICE,
        category: 'HABILIDADES',
        position: 4,
        options: [
          'Programación, lógica y desarrollo de software',
          'Matemáticas formales y teóricas (Cálculo, Álgebra, Demostraciones)',
          'Probabilidad, Estadística y Análisis de Datos',
          'Optimización, Investigación de Operaciones y Métodos Numéricos',
          'Ninguna en específico todavía (Aún conociendo la carrera)',
        ],
      },
      {
        code: 'reaccion_problema',
        text: 'Cuando repruebas un primer examen parcial o no entiendes un tema clave de una materia, ¿cuál suele ser tu conducta habitual?',
        type: QuestionType.SINGLE_CHOICE,
        category: 'INTERESES',
        position: 5,
        options: [
          'Busco asesorías, libros o videos y armo grupos de estudio',
          'Prefiero estudiar de forma autodidacta hasta resolverlo',
          'Me genera frustración y tiendo a descuidar la materia o dejar de asistir',
          'Desatiendo esa materia para salvar las demás y planeo recursarla',
        ],
      },
      {
        code: 'experiencia_laboral',
        text: '¿Has programado proyectos personales, participado en hackathones/olimpiadas o realizado cursos técnicos certificados previamente?',
        type: QuestionType.TEXT,
        category: 'EXPERIENCIA',
        position: 6,
        options: ['Sí', 'No'],
      },
      {
        code: 'ambiente_trabajo',
        text: '¿Hacia qué sector o ambiente laboral te gustaría enfocar tu carrera al egresar de MAC?',
        type: QuestionType.SINGLE_CHOICE,
        category: 'EXPECTATIVAS',
        position: 7,
        options: [
          'Desarrollo de software backend / arquitectura web y móvil',
          'Ciencia de datos, machine learning o inteligencia artificial',
          'Sector financiero, riesgos o actuaría (FinTech / Banca)',
          'Investigación científica, docencia o posgrado formal',
          'Emprender o crear una startup/empresa de base tecnológica',
        ],
      },
    ];

    for (const q of defaultQuestions) {
      const existing = await db.question.findUnique({
        where: {
          questionnaireId_code: {
            questionnaireId,
            code: q.code,
          },
        },
      });

      if (!existing) {
        const createdQ = await db.question.create({
          data: {
            questionnaireId,
            code: q.code,
            text: q.text,
            type: q.type,
            category: q.category as any,
            position: q.position,
            required: true,
          },
        });

        if (q.options && q.options.length > 0) {
          for (let i = 0; i < q.options.length; i++) {
            await db.questionOption.create({
              data: {
                questionId: createdQ.id,
                position: i + 1,
                value: q.options[i],
                label: q.options[i],
              },
            });
          }
        }
      }
    }
  }
}
