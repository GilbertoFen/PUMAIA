import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CoursesService } from '../courses/courses.service';
import { CoursesController } from '../courses/courses.controller';
import { SchoolarshipsService } from '../schoolarships/schoolarships.service';
import { SchoolarshipsController } from '../schoolarships/schoolarships.controller';
import { LanguagesService } from '../languages/languages.service';
import { LanguagesController } from '../languages/languages.controller';
import { ContestService } from '../contest/contest.service';
import { ContestController } from '../contest/contest.controller';
import { ProfessionalExperienceService } from '../professional-experience/professional-experience.service';
import { ProfessionalExperienceController } from '../professional-experience/professional-experience.controller';
import { StudentsService } from '../students/students.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { RoleType } from '@prisma/client';
import type { AuthUser } from '../autenticacion/interfaces/auth-user.interface';

describe('Auditoría y Pruebas Unitarias — Fase 4: Experiencias, Concursos e Integración de Perfil (PumaIA)', () => {
  let prismaMock: any;
  let coursesService: CoursesService;
  let coursesController: CoursesController;
  let schoolarshipsService: SchoolarshipsService;
  let schoolarshipsController: SchoolarshipsController;
  let languagesService: LanguagesService;
  let languagesController: LanguagesController;
  let contestService: ContestService;
  let contestController: ContestController;
  let experienceService: ProfessionalExperienceService;
  let experienceController: ProfessionalExperienceController;
  let studentsService: StudentsService;

  const mockStudentUser: AuthUser = {
    userId: 'user-stu-123',
    email: 'estudiante@comunidad.unam.mx',
    name: 'Juan Pérez',
    roles: [RoleType.STUDENT],
    studentId: 'student-uuid-456',
    accountNumber: 318123456,
  };

  const mockOtherStudentUser: AuthUser = {
    userId: 'user-stu-999',
    email: 'otro@comunidad.unam.mx',
    name: 'Otro Alumno',
    roles: [RoleType.STUDENT],
    studentId: 'student-other-999',
    accountNumber: 318999999,
  };

  const mockAdminUser: AuthUser = {
    userId: 'user-admin-1',
    email: 'admin@fi.unam.mx',
    name: 'Admin FI',
    roles: [RoleType.INSTITUTION_ADMIN],
    studentId: null,
    accountNumber: null,
  };

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn(async (cb) => cb(prismaMock)),
      course: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      studentCourse: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      schoolarship: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      studentSchoolarship: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      language: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      skill: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      studentLanguage: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      contest: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      studentContest: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      areaExpertise: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      category: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      professionalExperience: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      student: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const cloudinaryMock = {
      uploadImage: jest.fn().mockResolvedValue({ secure_url: 'https://cloudinary.com/avatar.png' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoursesService,
        CoursesController,
        SchoolarshipsService,
        SchoolarshipsController,
        LanguagesService,
        LanguagesController,
        ContestService,
        ContestController,
        ProfessionalExperienceService,
        ProfessionalExperienceController,
        StudentsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: CloudinaryService, useValue: cloudinaryMock },
      ],
    }).compile();

    coursesService = module.get<CoursesService>(CoursesService);
    coursesController = module.get<CoursesController>(CoursesController);
    schoolarshipsService = module.get<SchoolarshipsService>(SchoolarshipsService);
    schoolarshipsController = module.get<SchoolarshipsController>(SchoolarshipsController);
    languagesService = module.get<LanguagesService>(LanguagesService);
    languagesController = module.get<LanguagesController>(LanguagesController);
    contestService = module.get<ContestService>(ContestService);
    contestController = module.get<ContestController>(ContestController);
    experienceService = module.get<ProfessionalExperienceService>(ProfessionalExperienceService);
    experienceController = module.get<ProfessionalExperienceController>(ProfessionalExperienceController);
    studentsService = module.get<StudentsService>(StudentsService);
  });

  describe('1. Cursos y Talleres (CoursesModule)', () => {
    it('debe registrar un curso para el alumno autenticado y evitar inscripciones duplicadas', async () => {
      prismaMock.course.findUnique.mockResolvedValue({ id: 'c1', name: 'Docker & Kubernetes' });
      prismaMock.studentCourse.findUnique.mockResolvedValueOnce(null); // No existe
      prismaMock.studentCourse.create.mockResolvedValue({
        id: 'sc-1',
        studentId: mockStudentUser.studentId,
        courseId: 'c1',
        course: { id: 'c1', name: 'Docker & Kubernetes' },
      });

      const res = await coursesController.createCourseUser(
        mockStudentUser,
        { courseId: 'c1', studentId: 'malicious-id' },
      );

      expect(res).not.toBeNull();
      expect(res!.course.name).toBe('Docker & Kubernetes');
      // Debe haber forzado el studentId del usuario autenticado
      expect(prismaMock.studentCourse.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ studentId: mockStudentUser.studentId }),
        include: { course: true },
      });
    });

    it('debe retornar la inscripción existente si ya está registrado en el curso (idempotencia)', async () => {
      prismaMock.course.findUnique.mockResolvedValue({ id: 'c1', name: 'Docker' });
      prismaMock.studentCourse.findUnique
        .mockResolvedValueOnce({ id: 'sc-existing', studentId: 'student-uuid-456', courseId: 'c1' })
        .mockResolvedValueOnce({ id: 'sc-existing', course: { name: 'Docker' } });

      const res = await coursesService.createCourseUser({
        studentId: 'student-uuid-456',
        courseId: 'c1',
      });

      expect(res?.course?.name).toBe('Docker');
      expect(prismaMock.studentCourse.create).not.toHaveBeenCalled();
    });

    it('debe impedir que un alumno elimine o modifique el curso de otro alumno', async () => {
      prismaMock.studentCourse.findUnique.mockResolvedValue({
        id: 'sc-victim',
        studentId: 'student-other-999',
      });

      await expect(
        coursesService.removeCourseUser('sc-victim', mockStudentUser.studentId || undefined),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        coursesService.updateCourseUser('sc-victim', { courseId: 'c2' }, mockStudentUser.studentId || undefined),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('2. Becas y Apoyos (SchoolarshipsModule)', () => {
    it('debe asignar una beca con startedAt y endsAt para el alumno autenticado', async () => {
      prismaMock.schoolarship.findUnique.mockResolvedValue({ id: 'sch-1', name: 'Beca Manutención' });
      prismaMock.student.findUnique.mockResolvedValue({ id: mockStudentUser.studentId });
      prismaMock.studentSchoolarship.findUnique.mockResolvedValue(null);
      prismaMock.studentSchoolarship.create.mockResolvedValue({
        id: 'rel-sch-1',
        studentId: mockStudentUser.studentId,
        schoolarshipId: 'sch-1',
        startedAt: new Date('2025-01-15'),
        endsAt: new Date('2025-06-30'),
        schoolarship: { id: 'sch-1', name: 'Beca Manutención' },
      });

      const res = await schoolarshipsController.createSchoolarshipUser(
        mockStudentUser,
        { schoolarshipId: 'sch-1', startedAt: '2025-01-15', endsAt: '2025-06-30' },
      );

      expect(res).not.toBeNull();
      expect(res!.schoolarship.name).toBe('Beca Manutención');
      expect(prismaMock.studentSchoolarship.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          studentId: mockStudentUser.studentId,
          schoolarshipId: 'sch-1',
        }),
        include: { schoolarship: true },
      });
    });

    it('debe rechazar la eliminación de beca de otro alumno', async () => {
      prismaMock.studentSchoolarship.findUnique.mockResolvedValue({
        id: 'sch-other',
        studentId: 'student-other-999',
      });

      await expect(
        schoolarshipsController.removeSchoolarshipUser(mockStudentUser, 'sch-other'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('3. Idiomas y Competencias (LanguagesModule)', () => {
    it('debe registrar un idioma con su nivel de habilidad (CEFR)', async () => {
      prismaMock.skill.findUnique.mockResolvedValue({ id: 'skill-b2', proficiency: 'B2' });
      prismaMock.language.findUnique.mockResolvedValue({ id: 'lang-en', name: 'Inglés' });
      prismaMock.studentLanguage.findUnique.mockResolvedValue(null);
      prismaMock.studentLanguage.create.mockResolvedValue({
        id: 'sl-1',
        studentId: mockStudentUser.studentId,
        languageId: 'lang-en',
        skillId: 'skill-b2',
        language: { name: 'Inglés' },
        skill: { id: 'skill-b2', proficiency: 'B2' },
      });

      const res = await languagesController.createLanguageUser(
        mockStudentUser,
        { languageId: 'lang-en', skillId: 'skill-b2' },
      );

      expect(res.language.name).toBe('Inglés');
      expect(res.skill.proficiency).toBe('B2');
    });

    it('debe impedir que un alumno elimine el idioma de otro alumno', async () => {
      prismaMock.studentLanguage.findUnique.mockResolvedValue({
        id: 'sl-other',
        studentId: 'student-other-999',
      });

      await expect(
        languagesController.removeLanguageUser(mockStudentUser, 'sl-other'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('4. Concursos y Certámenes (ContestModule)', () => {
    it('debe inscribir al alumno en un concurso evitando duplicados y exponiendo datos de usuario del alumno', async () => {
      prismaMock.contest.findUnique.mockResolvedValue({ id: 'contest-1', title: 'Hackatón UNAM' });
      prismaMock.studentContest.findFirst.mockResolvedValue(null);
      prismaMock.studentContest.create.mockResolvedValue({
        id: 'sc-reg-1',
        studentId: mockStudentUser.studentId,
        contestId: 'contest-1',
        contest: { title: 'Hackatón UNAM' },
        student: {
          user: { name: 'Juan', lastNameP: 'Pérez' },
        },
      });

      const res = await contestController.enroll(
        mockStudentUser,
        { contestId: 'contest-1' },
      );

      expect(res.message).toBe('Inscripción exitosa');
      expect(res.details.alumno).toBe('Juan Pérez');
    });

    it('debe impedir que un alumno elimine la inscripción al concurso de otro estudiante', async () => {
      prismaMock.studentContest.findUnique.mockResolvedValue({
        id: 'reg-victim',
        studentId: 'student-other-999',
      });

      await expect(
        contestController.removeEnrollment(mockStudentUser, 'reg-victim'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('5. Experiencia Profesional (ProfessionalExperienceModule)', () => {
    it('debe crear una experiencia profesional vinculada al estudiante y validar catálogo', async () => {
      prismaMock.areaExpertise.findUnique.mockResolvedValue({ id: 'ae-1', name: 'Desarrollo Web' });
      prismaMock.category.findUnique.mockResolvedValue({ id: 'cat-1', name: 'Tecnología' });
      prismaMock.professionalExperience.create.mockResolvedValue({
        id: 'exp-1',
        studentId: mockStudentUser.studentId,
        areaExpertiseId: 'ae-1',
        categoryId: 'cat-1',
        areaExpertise: { name: 'Desarrollo Web' },
        category: { name: 'Tecnología' },
        student: {
          user: { name: 'Juan', lastNameP: 'Pérez' },
        },
      });

      const res = await experienceController.assign(
        mockStudentUser,
        { areaExpertiseId: 'ae-1', categoryId: 'cat-1' },
      );

      expect(res.message).toBe('Experiencia asignada correctamente');
      expect(res.assignment.expertise).toBe('Desarrollo Web');
    });

    it('debe rechazar modificación o eliminación de experiencia ajena', async () => {
      prismaMock.professionalExperience.findUnique.mockResolvedValue({
        id: 'exp-foreign',
        studentId: 'student-other-999',
      });

      await expect(
        experienceController.update(mockStudentUser, 'exp-foreign', { areaExpertiseId: 'ae-2' }),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        experienceController.remove(mockStudentUser, 'exp-foreign'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('6. Integración Completa de Expediente (StudentsService.getFullProfileSummary)', () => {
    it('debe estructurar el expediente completo integrando cursos, becas, idiomas, concursos y promedios reales', async () => {
      prismaMock.student.findUnique.mockResolvedValue({
        id: mockStudentUser.studentId,
        accountNumber: 318123456,
        currentSemester: 8,
        average: 9.25,
        user: {
          id: 'user-stu-123',
          name: 'Gil',
          lastNameP: 'Developer',
          lastNameM: 'Puma',
          email: 'gil@ciencias.unam.mx',
          avatarUrl: 'https://cloudinary.com/avatar.png',
        },
        career: { id: 'car-1', name: 'Ingeniería en Computación', code: '107' },
        courses: [
          { id: 'sc-1', course: { name: 'Arquitectura Cloud', hours: 40 } },
        ],
        languages: [
          { id: 'sl-1', language: { name: 'Inglés' }, skill: { id: 'sk-1', proficiency: 'C1' } },
        ],
        schoolarships: [
          { id: 'sch-1', schoolarship: { name: 'Beca de Excelencia' } },
        ],
        contests: [
          { id: 'ct-1', contest: { title: 'ICPC Regional' } },
        ],
        experiences: [
          { id: 'exp-1', areaExpertise: { name: 'Backend Engineering' }, category: { name: 'TI' } },
        ],
        enrollments: [
          { id: 'e1', subjectId: 's1', grade: 10, status: 'APPROVED', source: 'TRANSCRIPT', subject: { name: 'Redes' } },
          { id: 'e2', subjectId: 's2', grade: 8, status: 'APPROVED', source: 'TRANSCRIPT', subject: { name: 'Bases de Datos' } },
        ],
        responses: [
          {
            answers: [
              {
                id: 'a1',
                question: { code: 'PREG_01', category: 'VOCACIONAL' },
                option: { label: 'Software' },
              },
            ],
          },
        ],
      });

      const summary = await studentsService.getFullProfileSummary(mockStudentUser.studentId!);

      expect(summary).not.toBeNull();
      expect(summary!.fullName).toBe('Gil Developer Puma');
      expect(summary!.accountNumberFormatted).toBe('318123456');
      expect(summary!.average).toBe(9); // (10 + 8) / 2 = 9.0
      expect(summary!.career).toBe('Ingeniería en Computación');
      expect(summary!.courses).toHaveLength(1);
      expect(summary!.languages).toHaveLength(1);
      expect(summary!.schoolarships).toHaveLength(1);
      expect(summary!.contests).toHaveLength(1);
      expect(summary!.experiences).toHaveLength(1);
      expect(summary!.grades).toHaveLength(2);
      expect(summary!.answers).toHaveLength(1);
      expect(summary!.answers[0].answer).toBe('Software');
    });
  });
});
