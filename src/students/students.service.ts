import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UserStatus, RoleType } from '@prisma/client';

@Injectable()
export class StudentsService {
  private readonly logger = new Logger(StudentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  /**
   * Obtiene todos los alumnos con sus datos de usuario y carrera.
   */
  async findAll() {
    return this.prisma.student.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            lastNameP: true,
            lastNameM: true,
            email: true,
            avatarUrl: true,
            status: true,
          },
        },
        career: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });
  }

  /**
   * Obtiene un alumno por su ID de Student.
   */
  async findById(studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            lastNameP: true,
            lastNameM: true,
            email: true,
            avatarUrl: true,
            status: true,
          },
        },
        career: true,
      },
    });

    if (!student) {
      throw new NotFoundException(`Alumno con ID ${studentId} no encontrado.`);
    }

    return student;
  }

  /**
   * Busca un alumno por su número de cuenta.
   */
  async findByAccountNumber(accountNumber: number) {
    return this.prisma.student.findUnique({
      where: { accountNumber },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            lastNameP: true,
            lastNameM: true,
            email: true,
            avatarUrl: true,
          },
        },
        career: true,
      },
    });
  }

  /**
   * Busca un alumno por el correo del usuario asociado.
   */
  async findByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        student: {
          include: {
            career: true,
          },
        },
      },
    });

    return user?.student || null;
  }

  /**
   * Creación administrativa controlada de un alumno.
   */
  async create(dto: CreateStudentDto) {
    const cleanEmail = dto.email.toLowerCase().trim();

    // 1. Validar que no exista el número de cuenta ni el correo
    const existingStudent = await this.prisma.student.findUnique({
      where: { accountNumber: dto.accountNumber },
    });

    if (existingStudent) {
      throw new ConflictException(`El número de cuenta ${dto.accountNumber} ya está registrado.`);
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existingUser) {
      throw new ConflictException(`El correo ${cleanEmail} ya está registrado.`);
    }

    // 2. Resolver la carrera
    let careerId = dto.careerId;
    if (!careerId) {
      const defaultCareer = await this.prisma.career.findFirst();
      if (!defaultCareer) {
        throw new BadRequestException('No existe ninguna carrera registrada para asociar al estudiante.');
      }
      careerId = defaultCareer.id;
    }

    // 3. Resolver la institución
    const defaultInst = await this.prisma.institution.findFirst({
      where: { code: '240' },
    }) || await this.prisma.institution.findFirst();

    if (!defaultInst) {
      throw new BadRequestException('No existe ninguna institución registrada para asociar al estudiante.');
    }

    // 4. Crear User y Student en una transacción
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          institutionId: defaultInst.id,
          email: cleanEmail,
          name: dto.name,
          lastNameP: dto.lastNameP,
          lastNameM: dto.lastNameM || null,
          status: UserStatus.ACTIVE,
          roles: {
            create: { role: RoleType.STUDENT },
          },
        },
      });

      const student = await tx.student.create({
        data: {
          userId: user.id,
          accountNumber: dto.accountNumber,
          careerId,
          interest: dto.interest || null,
          currentSemester: dto.currentSemester || 1,
          average: dto.average ? Number(dto.average) : null,
          addressId: dto.addressId || null,
          isGraduated: false,
          hasCompletedQuiz: false,
        },
        include: {
          user: true,
          career: true,
        },
      });

      return student;
    });
  }

  /**
   * Asigna un concurso al alumno.
   */
  async assignContest(studentId: string, contestId: string) {
    const contest = await this.prisma.contest.findUnique({ where: { id: contestId } });
    if (!contest) throw new NotFoundException('Concurso no encontrado.');

    return this.prisma.studentContest.create({
      data: {
        studentId,
        contestId,
      },
      include: { contest: true },
    });
  }

  /**
   * Elimina un concurso asignado.
   */
  async removeContest(relationId: string) {
    return this.prisma.studentContest.delete({
      where: { id: relationId },
    });
  }

  /**
   * Actualiza los intereses declarados por el alumno.
   */
  async updateInterests(studentId: string, interest: string) {
    return this.prisma.student.update({
      where: { id: studentId },
      data: {
        interest: interest.trim(),
      },
      select: {
        id: true,
        interest: true,
      },
    });
  }

  /**
   * Genera el expediente completo del alumno adaptado al esquema Prisma v3:
   * - Une datos de User (nombre, apellidos, correo, avatar).
   * - Mapea enrollments a formato de materias/calificaciones para compatibilidad.
   * - Mapea responses y answers para retrocompatibilidad con el perfil.
   */
  async getFullProfileSummary(studentId: string) {
    const profile = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            lastNameP: true,
            lastNameM: true,
            email: true,
            avatarUrl: true,
          },
        },
        career: true,
        courses: { include: { course: true } },
        languages: { include: { language: true, skill: true } },
        schoolarships: { include: { schoolarship: true } },
        contests: { include: { contest: true } },
        experiences: { include: { areaExpertise: true, category: true } },
        enrollments: {
          include: {
            subject: true,
            period: true,
          },
        },
        responses: {
          include: {
            answers: {
              include: {
                question: true,
                option: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1, // El envío más reciente
        },
      },
    });

    if (!profile) return null;

    // Calcular promedio dinámico a partir de inscripciones con calificación
    const validGrades = profile.enrollments.filter((e) => e.grade !== null && e.grade !== undefined);
    let dynamicAverage = 0;

    if (validGrades.length > 0) {
      const sum = validGrades.reduce((acc, curr) => acc + (curr.grade || 0), 0);
      dynamicAverage = parseFloat((sum / validGrades.length).toFixed(2));
    } else if (profile.average) {
      dynamicAverage = Number(profile.average);
    }

    // Adaptador de compatibilidad: expone las materias como grades y respuestas como answers
    // para no romper consumidores dependientes (IA, frontend histórico)
    const formattedGrades = profile.enrollments.map((e) => ({
      id: e.id,
      studentId: e.studentId,
      subjectId: e.subjectId,
      grade: e.grade,
      status: e.status,
      attempt: e.attempt,
      source: e.source,
      subject: e.subject,
    }));

    const formattedAnswers =
      profile.responses?.[0]?.answers?.map((ans) => ({
        id: ans.id,
        questionId: ans.question.code,
        category: ans.question.category,
        answer: ans.option?.label || ans.textValue || ans.numberValue || '',
      })) || [];

    const fullName = `${profile.user.name} ${profile.user.lastNameP} ${profile.user.lastNameM || ''}`.trim();

    return {
      ...profile,
      // Propiedades de identidad provistas desde User
      name: profile.user.name,
      lastNameP: profile.user.lastNameP,
      lastNameM: profile.user.lastNameM,
      fullName,
      email: profile.user.email,
      avatarUrl: profile.user.avatarUrl,
      average: dynamicAverage,
      career: profile.career?.name || '',
      accountNumberFormatted: String(profile.accountNumber).padStart(9, '0'),
      // Adaptadores retrocompatibles
      grades: formattedGrades,
      answers: formattedAnswers,
    };
  }

  /**
   * Sube avatar a Cloudinary y actualiza User.avatarUrl.
   */
  async uploadAvatar(studentId: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No se recibió ninguna imagen.');

    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, userId: true },
    });

    if (!student) {
      throw new NotFoundException('Alumno no encontrado.');
    }

    const result = await this.cloudinary.uploadImage(file);

    await this.prisma.user.update({
      where: { id: student.userId },
      data: { avatarUrl: result.secure_url },
    });

    return {
      studentId,
      avatarUrl: result.secure_url,
    };
  }
}
