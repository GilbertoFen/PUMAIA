import { Test, TestingModule } from '@nestjs/testing';
import { ProfessorsService } from '../professors/professors.service';
import { ProfessorsController } from '../professors/professors.controller';
import { PersonalProfileService } from '../personal-profile/personal-profile.service';
import { PersonalProfileController } from '../personal-profile/personal-profile.controller';
import { HealthService } from '../health/health.service';
import { HealthController } from '../health/health.controller';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ContactType, Visibility } from '@prisma/client';

describe('Auditoría y Pruebas Unitarias — Fase 8: Cuerpo Docente, Perfil Personal y Salud Operativa (PumaIA)', () => {
  let professorsService: ProfessorsService;
  let professorsController: ProfessorsController;
  let profileService: PersonalProfileService;
  let profileController: PersonalProfileController;
  let healthService: HealthService;
  let healthController: HealthController;

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
    },
    professor: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    academicCategory: {
      findUnique: jest.fn(),
    },
    professorStudy: {
      create: jest.fn(),
    },
    professorPublication: {
      create: jest.fn(),
    },
    subject: {
      findUnique: jest.fn(),
    },
    professorCourse: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    personalProfile: {
      upsert: jest.fn(),
    },
    contactMethod: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(prismaMock)),
    $queryRaw: jest.fn(),
  };

  const configMock = {
    get: jest.fn((key: string) => {
      if (key === 'FASTAPI_CHAT_URL') return 'http://127.0.0.1:8000/api/chat';
      if (key === 'GOOGLE_CLIENT_ID') return 'google-client-id-test.apps.googleusercontent.com';
      if (key === 'JWT_SECRET') return 'test-jwt-secret-xyz';
      return null;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [
        ProfessorsController,
        PersonalProfileController,
        HealthController,
      ],
      providers: [
        ProfessorsService,
        PersonalProfileService,
        HealthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    professorsService = module.get<ProfessorsService>(ProfessorsService);
    professorsController = module.get<ProfessorsController>(ProfessorsController);
    profileService = module.get<PersonalProfileService>(PersonalProfileService);
    profileController = module.get<PersonalProfileController>(PersonalProfileController);
    healthService = module.get<HealthService>(HealthService);
    healthController = module.get<HealthController>(HealthController);
  });

  describe('1. Módulo de Profesores (Cuerpo Docente)', () => {
    it('debe registrar un profesor correctamente', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'usr-prof-1' });
      prismaMock.professor.findUnique.mockResolvedValue(null);
      prismaMock.professor.create.mockResolvedValue({
        id: 'prof-1',
        name: 'Carlos',
        lastNameP: 'Sánchez',
        lastNameM: 'Pérez',
        active: true,
        userId: 'usr-prof-1',
        user: { id: 'usr-prof-1', email: 'csanchez@unam.mx' },
      });

      const res = await professorsController.create({
        name: 'Carlos',
        lastNameP: 'Sánchez',
        lastNameM: 'Pérez',
        userId: 'usr-prof-1',
      });

      expect(res.id).toBe('prof-1');
      expect(res.name).toBe('Carlos');
      expect(prismaMock.professor.create).toHaveBeenCalled();
    });

    it('debe rechazar la vinculación si el usuario ya está asociado a otro profesor', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'usr-prof-1' });
      prismaMock.professor.findUnique.mockResolvedValue({ id: 'prof-other', userId: 'usr-prof-1' });

      await expect(
        professorsService.create({
          name: 'Carlos',
          lastNameP: 'Sánchez',
          userId: 'usr-prof-1',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('debe registrar un grado o estudio académico del profesor', async () => {
      prismaMock.professor.findUnique.mockResolvedValue({
        id: 'prof-1',
        name: 'Carlos',
        sections: [],
      });
      prismaMock.professorStudy.create.mockResolvedValue({
        id: 'study-1',
        professorId: 'prof-1',
        degree: 'Doctorado',
        field: 'Ciencias de la Computación',
        institution: 'UNAM',
        year: 2020,
      });

      const res = await professorsController.addStudy('prof-1', {
        degree: 'Doctorado',
        field: 'Ciencias de la Computación',
        institution: 'UNAM',
        year: 2020,
      });

      expect(res.degree).toBe('Doctorado');
      expect(res.field).toBe('Ciencias de la Computación');
    });

    it('debe impedir la eliminación de un profesor que tiene secciones activas asignadas', async () => {
      prismaMock.professor.findUnique.mockResolvedValue({
        id: 'prof-1',
        sections: [{ id: 'sec-1' }],
      });

      await expect(professorsController.remove('prof-1')).rejects.toThrow(BadRequestException);
      expect(prismaMock.professor.delete).not.toHaveBeenCalled();
    });

    it('debe eliminar un profesor que no tenga secciones asignadas', async () => {
      prismaMock.professor.findUnique.mockResolvedValue({
        id: 'prof-1',
        sections: [],
      });
      prismaMock.professor.delete.mockResolvedValue({ id: 'prof-1' });

      const res = await professorsController.remove('prof-1');
      expect(res.id).toBe('prof-1');
      expect(prismaMock.professor.delete).toHaveBeenCalledWith({ where: { id: 'prof-1' } });
    });
  });

  describe('2. Módulo de Perfil Personal y Métodos de Contacto', () => {
    const authUser = {
      userId: 'usr-student-1',
      email: 'student@comunidad.unam.mx',
      role: 'STUDENT',
      studentId: 'stud-1',
    } as any;

    it('debe obtener o crear el perfil personal del usuario autenticado', async () => {
      prismaMock.personalProfile.upsert.mockResolvedValue({
        id: 'prof-pers-1',
        userId: 'usr-student-1',
        preferredName: 'Charlie',
        user: { email: 'student@comunidad.unam.mx' },
      });

      const res = await profileController.getMyProfile(authUser);
      expect(res.preferredName).toBe('Charlie');
      expect(prismaMock.personalProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'usr-student-1' },
        }),
      );
    });

    it('debe agregar un método de contacto y desmarcar otros primarios del mismo tipo', async () => {
      prismaMock.contactMethod.create.mockResolvedValue({
        id: 'cm-1',
        userId: 'usr-student-1',
        type: ContactType.PHONE,
        value: '5512345678',
        isPrimary: true,
        visibility: Visibility.PRIVATE,
      });

      const res = await profileController.addContactMethod(authUser, {
        type: ContactType.PHONE,
        value: '5512345678',
        isPrimary: true,
      });

      expect(res.id).toBe('cm-1');
      expect(prismaMock.contactMethod.updateMany).toHaveBeenCalledWith({
        where: { userId: 'usr-student-1', type: ContactType.PHONE },
        data: { isPrimary: false },
      });
    });

    it('debe prohibir la modificación de un método de contacto perteneciente a otro usuario', async () => {
      prismaMock.contactMethod.findUnique.mockResolvedValue({
        id: 'cm-other',
        userId: 'other-user-999',
        type: ContactType.EMAIL,
      });

      await expect(
        profileController.updateContactMethod(authUser, 'cm-other', {
          value: 'hacker@mail.com',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('debe prohibir la eliminación de un método de contacto ajeno', async () => {
      prismaMock.contactMethod.findUnique.mockResolvedValue({
        id: 'cm-other',
        userId: 'other-user-999',
      });

      await expect(
        profileController.removeContactMethod(authUser, 'cm-other'),
      ).rejects.toThrow(ForbiddenException);
      expect(prismaMock.contactMethod.delete).not.toHaveBeenCalled();
    });
  });

  describe('3. Módulo de Salud Operativa (HealthModule)', () => {
    it('debe responder OK con diagnóstico de PostgreSQL y subsistemas de seguridad', async () => {
      prismaMock.$queryRaw.mockResolvedValue([{ 1: 1 }]);

      const res = await healthController.check();

      expect(res.status).toBe('OK');
      expect(res.database.status).toBe('HEALTHY');
      expect(res.database.provider).toContain('PostgreSQL');
      expect(res.security.googleAuthEnabled).toBe(true);
      expect(res.security.jwtConfigured).toBe(true);
      expect(res.security.rbacActive).toBe(true);
      expect(res.security.consentsEnforced).toBe(true);
    });

    it('debe degradar el estado a DEGRADED si falla la base de datos', async () => {
      prismaMock.$queryRaw.mockRejectedValue(new Error('Connection timeout'));

      const res = await healthController.check();

      expect(res.status).toBe('DEGRADED');
      expect(res.database.status).toBe('UNHEALTHY');
    });
  });
});

