import { RoleType } from '@prisma/client';

export interface AuthUser {
  userId: string;
  studentId: string | null;
  professorId?: string | null;
  sessionId?: string | null;
  email: string;
  name: string;
  roles: RoleType[];
  accountNumber: number | null;
}

export interface JwtPayload {
  sub: string;
  userId: string;
  studentId: string | null;
  professorId?: string | null;
  sid?: string | null;
  email: string;
  name: string;
  roles: RoleType[];
  accountNumber: number | null;
}
