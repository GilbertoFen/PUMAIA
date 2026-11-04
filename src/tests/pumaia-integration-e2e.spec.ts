import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import {
  RoleType,
  UserStatus,
  ConsentKind,
  SummaryStatus,
  QuestionnaireKind,
  QuestionType,
  SessionStatus,
  AttendanceStatus,
  AttendanceMethod,
  TopicGroup,
  EnrollmentStatus,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AutenticacionController } from '../autenticacion/autenticacion.controller';
import { AutenticacionService } from '../autenticacion/autenticacion.service';
import { JwtStrategy } from '../autenticacion/jwt.strategy';
import { JwtAuthGuard } from '../autenticacion/guards/jwt-auth.guard';
import { RolesGuard } from '../autenticacion/guards/roles.guard';
import { ConsentsController } from '../consents/consents.controller';
import { ConsentsService } from '../consents/consents.service';
import { ChatController } from '../chat/chat.controller';
import { ChatService } from '../chat/chat.service';
import { QuestionnaireController } from '../questionnaire/questionnaire.controller';
import { QuestionnaireService } from '../questionnaire/questionnaire.service';
import { SectionsController } from '../sections/sections.controller';
import { SectionsService } from '../sections/sections.service';
import { AttendanceController } from '../attendance/attendance.controller';
import { AttendanceService } from '../attendance/attendance.service';
import { MetricsController } from '../metrics/metrics.controller';
import { MetricsService } from '../metrics/metrics.service';

describe('Pruebas de Integración HTTP y E2E Reales — PUMAIA (Prioridades 1 a 10)', () => {
  let app: INestApplication;
  let attendanceService: AttendanceService;

  // Base de datos relacional en memoria para el pipeline HTTP E2E completo
  const db = {
    users: new Map<string, any>(),
    userRoles: new Map<string, any[]>(),
    students: new Map<string, any>(),
    professors: new Map<string, any>(),
    authSessions: new Map<string, any>(),
    privacyNotices: new Map<string, any>(),
    consents: [] as any[],
    conversations: new Map<string, any>(),
    messages: [] as any[],
    topics: new Map<string, any>(),
    conversationLabels: [] as any[],
    psychologicalSummaries: new Map<string, any>(),
    questionnaires: new Map<string, any>(),
    questions: new Map<string, any>(),
    questionOptions: new Map<string, any>(),
    responses: new Map<string, any>(),
    answers: [] as any[],
    sections: new Map<string, any>(),
    meetings: new Map<string, any>(),
    roster: new Map<string, any>(),
    enrollments: new Map<string, any>(),
    classSessions: new Map<string, any>(),
    attendanceRecords: new Map<string, any>(),
    subjects: new Map<string, any>(),
    auditLogs: [] as any[],
  };

  let idSeq = 1;
  const nextUuid = (prefix = '00000000-0000-4000-8000-') =>
    `${prefix}${String(idSeq++).padStart(12, '0')}`;

  const CAREER_ID = '11111111-1111-4111-8111-111111111111';
  const SUBJECT_ID = '22222222-2222-4222-8222-222222222222';
  const PERIOD_ID = '33333333-3333-4333-8333-333333333333';
  const TOPIC_ID = '44444444-4444-4444-8444-444444444444';
  const PSYCHOLOGIST_USER_ID = '55555555-5555-4555-8555-555555555555';
  const PROF_OWNER_USER_ID = '66666666-6666-4666-8666-666666666666';
  const PROF_OWNER_ID = '66666666-6666-4666-8666-666666666667';
  const PROF_OTHER_USER_ID = '77777777-7777-4777-8777-777777777777';
  const PROF_OTHER_ID = '77777777-7777-4777-8777-777777777778';
  const ADMIN_USER_ID = '88888888-8888-4888-8888-888888888888';

  const hydrateUser = (u: any) => {
    if (!u) return null;
    const roles = db.userRoles.get(u.id) || [];
    const student =
      Array.from(db.students.values()).find((s) => s.userId === u.id) || null;
    const professor =
      Array.from(db.professors.values()).find((p) => p.userId === u.id) || null;
    return { ...u, roles, student, professor };
  };

  const prismaStatefulMock: any = {
    $transaction: jest.fn(async (cb) => cb(prismaStatefulMock)),
    institution: {
      findFirst: jest.fn(async () => ({ id: 'inst-1', code: 'FESA' })),
    },
    knowledgeArea: {
      findFirst: jest.fn(async () => ({ id: 'ka-1' })),
    },
    studyPlan: {
      findFirst: jest.fn(async () => ({ id: 'sp-1' })),
    },
    career: {
      findFirst: jest.fn(async () => ({
        id: CAREER_ID,
        name: 'Matemáticas Aplicadas y Computación',
      })),
    },
    user: {
      findFirst: jest.fn(async ({ where }: any) => {
        if (where?.OR) {
          for (const cond of where.OR) {
            if (cond.email) {
              const byEmail = Array.from(db.users.values()).find(
                (u) => u.email === cond.email,
              );
              if (byEmail) return hydrateUser(byEmail);
            }
            if (cond.googleSub) {
              const bySub = Array.from(db.users.values()).find(
                (u) => u.googleSub === cond.googleSub,
              );
              if (bySub) return hydrateUser(bySub);
            }
          }
        }
        return null;
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.id) return hydrateUser(db.users.get(where.id));
        if (where.email) {
          const found = Array.from(db.users.values()).find(
            (u) => u.email === where.email,
          );
          return hydrateUser(found);
        }
        if (where.googleSub) {
          const found = Array.from(db.users.values()).find(
            (u) => u.googleSub === where.googleSub,
          );
          return hydrateUser(found);
        }
        return null;
      }),
      create: jest.fn(async ({ data }: any) => {
        const id = data.id || nextUuid();
        const user = {
          id,
          email: data.email,
          name: data.name,
          lastNameP: data.lastNameP,
          lastNameM: data.lastNameM ?? null,
          googleSub: data.googleSub ?? null,
          passwordHash: data.passwordHash ?? null,
          failedLoginAttempts: data.failedLoginAttempts ?? 0,
          lockedUntil: data.lockedUntil ?? null,
          verificationTokenHash: data.verificationTokenHash ?? null,
          verificationExpiresAt: data.verificationExpiresAt ?? null,
          resetPasswordTokenHash: data.resetPasswordTokenHash ?? null,
          resetPasswordExpiresAt: data.resetPasswordExpiresAt ?? null,
          status: data.status ?? UserStatus.INVITED,
          emailVerifiedAt: data.emailVerifiedAt ?? null,
          lastLoginAt: data.lastLoginAt ?? null,
          createdAt: new Date(),
        };
        db.users.set(id, user);
        if (data.roles?.create) {
          const rList = Array.isArray(data.roles.create)
            ? data.roles.create
            : [data.roles.create];
          db.userRoles.set(
            id,
            rList.map((r: any) => ({ userId: id, role: r.role })),
          );
        }
        if (data.student?.create) {
          const stId = nextUuid();
          db.students.set(stId, {
            id: stId,
            userId: id,
            accountNumber: data.student.create.accountNumber,
            careerId: data.student.create.careerId,
            currentSemester: data.student.create.currentSemester ?? 1,
            hasCompletedQuiz: false,
          });
        }
        if (data.professor?.create) {
          const prId = nextUuid();
          db.professors.set(prId, {
            id: prId,
            userId: id,
            name: data.professor.create.name,
            lastNameP: data.professor.create.lastNameP,
            active: true,
          });
        }
        return hydrateUser(user);
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const existing = db.users.get(where.id);
        if (!existing) throw new Error('User not found');
        const updated = { ...existing, ...data };
        db.users.set(where.id, updated);
        return hydrateUser(updated);
      }),
    },
    userRole: {
      upsert: jest.fn(async ({ where, create }: any) => {
        const uid = where.userId_role.userId;
        const role = where.userId_role.role;
        const list = db.userRoles.get(uid) || [];
        if (!list.some((r) => r.role === role)) {
          list.push({ userId: uid, role: create.role });
          db.userRoles.set(uid, list);
        }
        return { userId: uid, role };
      }),
    },
    student: {
      findUnique: jest.fn(async ({ where }: any) => {
        let st: any = null;
        if (where.id) st = db.students.get(where.id) || null;
        if (where.accountNumber !== undefined) {
          st =
            Array.from(db.students.values()).find(
              (s) => s.accountNumber === where.accountNumber,
            ) || null;
        }
        if (!st) return null;
        const u = db.users.get(st.userId);
        return {
          ...st,
          user: u,
          career: { name: 'MAC' },
        };
      }),
      findMany: jest.fn(async () => Array.from(db.students.values())),
      create: jest.fn(async ({ data }: any) => {
        const id = nextUuid();
        const st = { id, ...data, hasCompletedQuiz: false };
        db.students.set(id, st);
        return st;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const st = db.students.get(where.id);
        const updated = { ...st, ...data };
        db.students.set(where.id, updated);
        return updated;
      }),
    },
    professor: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.id) return db.professors.get(where.id) || null;
        if (where.userId) {
          return (
            Array.from(db.professors.values()).find(
              (p) => p.userId === where.userId,
            ) || null
          );
        }
        return null;
      }),
    },
    authSession: {
      create: jest.fn(async ({ data }: any) => {
        db.authSessions.set(data.id, { ...data, createdAt: new Date() });
        return db.authSessions.get(data.id);
      }),
      findUnique: jest.fn(
        async ({ where }: any) => db.authSessions.get(where.id) || null,
      ),
      update: jest.fn(async ({ where, data }: any) => {
        const sess = db.authSessions.get(where.id);
        const updated = { ...sess, ...data };
        db.authSessions.set(where.id, updated);
        return updated;
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const [k, v] of db.authSessions.entries()) {
          if (where.userId && v.userId === where.userId) {
            db.authSessions.set(k, { ...v, ...data });
            count++;
          } else if (where.id && v.id === where.id) {
            db.authSessions.set(k, { ...v, ...data });
            count++;
          }
        }
        return { count };
      }),
    },
    privacyNotice: {
      findFirst: jest.fn(async ({ where }: any) => {
        const list = Array.from(db.privacyNotices.values()).filter(
          (n) => !where?.kind || n.kind === where.kind,
        );
        return list[0] || null;
      }),
      findUnique: jest.fn(
        async ({ where }: any) => db.privacyNotices.get(where.id) || null,
      ),
      create: jest.fn(async ({ data }: any) => {
        const id = nextUuid();
        const notice = { id, ...data };
        db.privacyNotices.set(id, notice);
        return notice;
      }),
    },
    consentRecord: {
      create: jest.fn(async ({ data }: any) => {
        const rec = { id: nextUuid(), ...data, createdAt: new Date() };
        db.consents.push(rec);
        return rec;
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        const matches = db.consents
          .filter(
            (c) =>
              c.userId === where.userId &&
              (!where.kind || c.kind === where.kind),
          )
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        if (!matches[0]) return null;
        return {
          ...matches[0],
          notice: db.privacyNotices.get(matches[0].noticeId),
        };
      }),
      findMany: jest.fn(async ({ where }: any) =>
        db.consents.filter((c) => c.userId === where.userId),
      ),
    },
    conversation: {
      findMany: jest.fn(async ({ where }: any) =>
        Array.from(db.conversations.values()).filter(
          (c) => c.studentId === where.studentId,
        ),
      ),
      findUnique: jest.fn(
        async ({ where }: any) => db.conversations.get(where.id) || null,
      ),
      create: jest.fn(async ({ data }: any) => {
        const id = nextUuid();
        const conv = {
          id,
          sensitive: false,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        db.conversations.set(id, conv);
        return conv;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const conv = db.conversations.get(where.id);
        const updated = { ...conv, ...data };
        db.conversations.set(where.id, updated);
        return updated;
      }),
      delete: jest.fn(async ({ where }: any) => {
        const conv = db.conversations.get(where.id);
        db.conversations.delete(where.id);
        return conv;
      }),
    },
    message: {
      create: jest.fn(async ({ data }: any) => {
        const msg = { id: nextUuid(), ...data, createdAt: new Date() };
        db.messages.push(msg);
        return msg;
      }),
      findMany: jest.fn(async ({ where }: any) =>
        db.messages.filter((m) => m.conversationId === where.conversationId),
      ),
      findUnique: jest.fn(async ({ where }: any) => {
        const m = db.messages.find((x) => x.id === where.id);
        if (!m) return null;
        return { ...m, conversation: db.conversations.get(m.conversationId) };
      }),
    },
    topicCategory: {
      findUnique: jest.fn(
        async ({ where }: any) => db.topics.get(where.id) || null,
      ),
      findMany: jest.fn(async () => {
        return Array.from(db.topics.values()).map((t) => ({
          ...t,
          labels: db.conversationLabels
            .filter((l) => l.topicId === t.id)
            .map((l) => {
              const conv = db.conversations.get(l.conversationId);
              const st = conv ? db.students.get(conv.studentId) : null;
              const consents = st
                ? db.consents
                    .filter(
                      (c) =>
                        c.userId === st.userId &&
                        c.kind === ConsentKind.ANALYTICS,
                    )
                    .sort(
                      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
                    )
                    .slice(0, 1)
                : [];
              return {
                ...l,
                conversation: conv
                  ? {
                      ...conv,
                      student: st ? { ...st, user: { consents } } : null,
                    }
                  : null,
              };
            })
            .filter((l) => l.conversation && !l.conversation.sensitive),
        }));
      }),
    },
    conversationLabel: {
      upsert: jest.fn(async ({ create }: any) => {
        const lbl = {
          id: nextUuid(),
          ...create,
          topic: db.topics.get(create.topicId),
        };
        db.conversationLabels.push(lbl);
        return lbl;
      }),
      findMany: jest.fn(async ({ where }: any) =>
        db.conversationLabels.filter(
          (l) => l.conversationId === where.conversationId,
        ),
      ),
    },
    psychologicalSummary: {
      create: jest.fn(async ({ data }: any) => {
        const id = nextUuid();
        const sum = {
          id,
          ...data,
          createdAt: new Date(),
          approvedAt: null,
          sharedAt: null,
          revokedAt: null,
        };
        db.psychologicalSummaries.set(id, sum);
        return sum;
      }),
      findUnique: jest.fn(
        async ({ where }: any) =>
          db.psychologicalSummaries.get(where.id) || null,
      ),
      findMany: jest.fn(async ({ where }: any) =>
        Array.from(db.psychologicalSummaries.values()).filter(
          (s) => s.studentId === where.studentId,
        ),
      ),
      update: jest.fn(async ({ where, data }: any) => {
        const existing = db.psychologicalSummaries.get(where.id);
        const updated = { ...existing, ...data };
        db.psychologicalSummaries.set(where.id, updated);
        return updated;
      }),
    },
    questionnaire: {
      findFirst: jest.fn(async ({ where }: any) => {
        return (
          Array.from(db.questionnaires.values()).find(
            (q) => q.kind === where.kind && q.active === where.active,
          ) || null
        );
      }),
      findUnique: jest.fn(
        async ({ where }: any) => db.questionnaires.get(where.id) || null,
      ),
    },
    question: {
      findMany: jest.fn(async ({ where }: any) => {
        return Array.from(db.questions.values())
          .filter((q) => {
            if (
              where?.questionnaireId &&
              q.questionnaireId !== where.questionnaireId
            )
              return false;
            if (where?.required !== undefined && q.required !== where.required)
              return false;
            return true;
          })
          .map((q) => ({
            ...q,
            options: Array.from(db.questionOptions.values()).filter(
              (o) => o.questionId === q.id,
            ),
            answers: db.answers
              .filter((a) => a.questionId === q.id)
              .map((a) => ({
                ...a,
                response: db.responses.get(a.responseId),
              })),
          }));
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.id) return db.questions.get(where.id) || null;
        if (where.questionnaireId_code) {
          return (
            Array.from(db.questions.values()).find(
              (q) =>
                q.questionnaireId ===
                  where.questionnaireId_code.questionnaireId &&
                q.code === where.questionnaireId_code.code,
            ) || null
          );
        }
        return null;
      }),
    },
    questionOption: {
      findFirst: jest.fn(async ({ where }: any) => {
        return (
          Array.from(db.questionOptions.values()).find((o) => {
            if (o.questionId !== where.questionId) return false;
            if (where.id && o.id === where.id) return true;
            if (where.OR) {
              return where.OR.some(
                (cond: any) =>
                  (cond.id && o.id === cond.id) ||
                  (cond.value && o.value === cond.value),
              );
            }
            return false;
          }) || null
        );
      }),
    },
    response: {
      findFirst: jest.fn(async ({ where }: any) => {
        return (
          Array.from(db.responses.values()).find(
            (r) =>
              r.studentId === where.studentId &&
              (!where.questionnaireId ||
                r.questionnaireId === where.questionnaireId),
          ) || null
        );
      }),
      create: jest.fn(async ({ data }: any) => {
        const id = nextUuid();
        const r = { id, ...data, createdAt: new Date() };
        db.responses.set(id, r);
        return r;
      }),
    },
    answer: {
      deleteMany: jest.fn(async ({ where }: any) => {
        db.answers = db.answers.filter(
          (a) =>
            !(
              a.responseId === where.responseId &&
              a.questionId === where.questionId
            ),
        );
        return { count: 1 };
      }),
      create: jest.fn(async ({ data }: any) => {
        const a = { id: nextUuid(), ...data };
        db.answers.push(a);
        return a;
      }),
    },
    subject: {
      findUnique: jest.fn(
        async ({ where }: any) => db.subjects.get(where.id) || null,
      ),
      findMany: jest.fn(async () =>
        Array.from(db.subjects.values()).map((s) => ({
          ...s,
          category: { category: 'COMPUTACION' },
          enrollments: Array.from(db.enrollments.values())
            .filter((e) => e.subjectId === s.id)
            .map((e) => ({
              ...e,
              student: db.students.get(e.studentId),
            })),
        })),
      ),
    },
    academicPeriod: {
      findUnique: jest.fn(async ({ where }: any) =>
        where.id === PERIOD_ID ? { id: PERIOD_ID, code: '2026-1' } : null,
      ),
    },
    courseSection: {
      findUnique: jest.fn(async ({ where }: any) => {
        let sec: any = null;
        if (where.id) sec = db.sections.get(where.id) || null;
        if (where.joinCode) {
          sec =
            Array.from(db.sections.values()).find(
              (s) => s.joinCode === where.joinCode,
            ) || null;
        }
        if (where.subjectId_periodId_groupCode) {
          sec =
            Array.from(db.sections.values()).find(
              (s) =>
                s.subjectId === where.subjectId_periodId_groupCode.subjectId &&
                s.periodId === where.subjectId_periodId_groupCode.periodId &&
                s.groupCode === where.subjectId_periodId_groupCode.groupCode,
            ) || null;
        }
        if (!sec) return null;
        return {
          ...sec,
          subject: db.subjects.get(sec.subjectId) || { subject: 'Cálculo' },
          period: { id: PERIOD_ID, code: '2026-1' },
          meetings: Array.from(db.meetings.values()).filter(
            (m) => m.sectionId === sec.id,
          ),
          roster: Array.from(db.roster.values())
            .filter((r) => r.sectionId === sec.id)
            .map((r) => {
              const st = r.linkedStudentId
                ? db.students.get(r.linkedStudentId)
                : null;
              const u = st ? db.users.get(st.userId) : null;
              return {
                ...r,
                linkedStudent: st ? { ...st, user: u } : null,
              };
            }),
          enrollments: Array.from(db.enrollments.values()).filter(
            (e) => e.sectionId === sec.id,
          ),
        };
      }),
      findMany: jest.fn(async () => Array.from(db.sections.values())),
      create: jest.fn(async ({ data }: any) => {
        const id = nextUuid();
        const sec = { id, ...data, createdAt: new Date() };
        db.sections.set(id, sec);
        return sec;
      }),
    },
    sectionMeeting: {
      create: jest.fn(async ({ data }: any) => {
        const id = nextUuid();
        const m = { id, ...data };
        db.meetings.set(id, m);
        return m;
      }),
      findUnique: jest.fn(
        async ({ where }: any) => db.meetings.get(where.id) || null,
      ),
      delete: jest.fn(async ({ where }: any) => {
        const m = db.meetings.get(where.id);
        db.meetings.delete(where.id);
        return m;
      }),
    },
    sectionRoster: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.id) return db.roster.get(where.id) || null;
        if (where.sectionId_accountNumber) {
          return (
            Array.from(db.roster.values()).find(
              (r) =>
                r.sectionId === where.sectionId_accountNumber.sectionId &&
                r.accountNumber === where.sectionId_accountNumber.accountNumber,
            ) || null
          );
        }
        return null;
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        return (
          Array.from(db.roster.values()).find(
            (r) =>
              r.sectionId === where.sectionId &&
              r.linkedStudentId === where.linkedStudentId,
          ) || null
        );
      }),
      create: jest.fn(async ({ data }: any) => {
        const id = nextUuid();
        const r = { id, ...data };
        db.roster.set(id, r);
        return r;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const r = db.roster.get(where.id);
        const updated = { ...r, ...data };
        db.roster.set(where.id, updated);
        return updated;
      }),
    },
    enrollment: {
      findFirst: jest.fn(async ({ where }: any) => {
        return (
          Array.from(db.enrollments.values()).find(
            (e) =>
              e.studentId === where.studentId &&
              (!where.sectionId || e.sectionId === where.sectionId) &&
              (!where.subjectId || e.subjectId === where.subjectId),
          ) || null
        );
      }),
      create: jest.fn(async ({ data }: any) => {
        const id = nextUuid();
        const e = { id, ...data };
        db.enrollments.set(id, e);
        return e;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const e = db.enrollments.get(where.id);
        const updated = { ...e, ...data };
        db.enrollments.set(where.id, updated);
        return updated;
      }),
    },
    classSession: {
      findFirst: jest.fn(async ({ where }: any) => {
        return (
          Array.from(db.classSessions.values()).find(
            (s) => s.sectionId === where.sectionId && s.status === where.status,
          ) || null
        );
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        const sess = db.classSessions.get(where.id);
        if (!sess) return null;
        const sec = db.sections.get(sess.sectionId);
        return {
          ...sess,
          section: {
            ...sec,
            roster: Array.from(db.roster.values()).filter(
              (r) => r.sectionId === sess.sectionId,
            ),
            enrollments: Array.from(db.enrollments.values()).filter(
              (e) => e.sectionId === sess.sectionId,
            ),
          },
          records: Array.from(db.attendanceRecords.values()).filter(
            (r) => r.sessionId === sess.id,
          ),
        };
      }),
      create: jest.fn(async ({ data }: any) => {
        const id = nextUuid();
        const s = { id, ...data };
        db.classSessions.set(id, s);
        return s;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const s = db.classSessions.get(where.id);
        const updated = { ...s, ...data };
        db.classSessions.set(where.id, updated);
        return updated;
      }),
    },
    attendanceRecord: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.id) return db.attendanceRecords.get(where.id) || null;
        if (where.sessionId_studentId) {
          return (
            Array.from(db.attendanceRecords.values()).find(
              (r) =>
                r.sessionId === where.sessionId_studentId.sessionId &&
                r.studentId === where.sessionId_studentId.studentId,
            ) || null
          );
        }
        return null;
      }),
      create: jest.fn(async ({ data }: any) => {
        const id = nextUuid();
        const r = { id, ...data };
        db.attendanceRecords.set(id, r);
        return r;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const r = db.attendanceRecords.get(where.id);
        const updated = { ...r, ...data };
        db.attendanceRecords.set(where.id, updated);
        return updated;
      }),
      findMany: jest.fn(async ({ where }: any) =>
        Array.from(db.attendanceRecords.values()).filter(
          (r) => !where.sessionId || r.sessionId === where.sessionId,
        ),
      ),
    },
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'pumaia-e2e-secret-key-2026';
    process.env.JWT_REFRESH_SECRET = 'pumaia-e2e-refresh-secret-key-2026';
    process.env.GOOGLE_CLIENT_ID = 'pumaia-google-client-id.apps.googleusercontent.com';

    // Sembrar catálogos base
    db.subjects.set(SUBJECT_ID, {
      id: SUBJECT_ID,
      subject: 'Ingeniería de Software',
      code: 1601,
    });
    db.topics.set(TOPIC_ID, {
      id: TOPIC_ID,
      code: 'TRAMITES_TITULACION',
      label: 'Trámites de Titulación',
      topicGroup: TopicGroup.TRAMITES,
      active: true,
    });

    // Sembrar cuestionario ONBOARDING activo con 1 pregunta obligatoria y 2 opciones
    const qId = '99999999-9999-4999-8999-999999999991';
    const quesId = '99999999-9999-4999-8999-999999999992';
    const opt1Id = '99999999-9999-4999-8999-999999999993';
    const optForeignId = '99999999-9999-4999-8999-999999999994';

    db.questionnaires.set(qId, {
      id: qId,
      kind: QuestionnaireKind.ONBOARDING,
      version: 1,
      active: true,
    });
    db.questions.set(quesId, {
      id: quesId,
      questionnaireId: qId,
      code: 'p1_interes',
      position: 1,
      text: 'Área de interés principal',
      type: QuestionType.SINGLE_CHOICE,
      required: true,
      category: 'INTERESES',
    });
    db.questionOptions.set(opt1Id, {
      id: opt1Id,
      questionId: quesId,
      position: 1,
      value: 'ia',
      label: 'Inteligencia Artificial',
    });
    db.questionOptions.set(optForeignId, {
      id: optForeignId,
      questionId: 'other-question-id',
      position: 1,
      value: 'foreign',
      label: 'Opción Ajena',
    });

    // Sembrar psicólogo destinatario, profesor titular, profesor externo y administrador
    db.users.set(PSYCHOLOGIST_USER_ID, {
      id: PSYCHOLOGIST_USER_ID,
      email: 'psicologia@pcpuma.acatlan.unam.mx',
      name: 'ORIENTADOR',
      lastNameP: 'UNAM',
      status: UserStatus.ACTIVE,
    });
    db.userRoles.set(PSYCHOLOGIST_USER_ID, [
      { userId: PSYCHOLOGIST_USER_ID, role: RoleType.ANALYST },
    ]);

    db.users.set(PROF_OWNER_USER_ID, {
      id: PROF_OWNER_USER_ID,
      email: 'prof.titular@pcpuma.acatlan.unam.mx',
      name: 'TITULAR',
      lastNameP: 'DOCENTE',
      status: UserStatus.ACTIVE,
    });
    db.userRoles.set(PROF_OWNER_USER_ID, [
      { userId: PROF_OWNER_USER_ID, role: RoleType.PROFESSOR },
    ]);
    db.professors.set(PROF_OWNER_ID, {
      id: PROF_OWNER_ID,
      userId: PROF_OWNER_USER_ID,
      name: 'TITULAR',
      lastNameP: 'DOCENTE',
      active: true,
    });

    db.users.set(PROF_OTHER_USER_ID, {
      id: PROF_OTHER_USER_ID,
      email: 'prof.ajeno@pcpuma.acatlan.unam.mx',
      name: 'AJENO',
      lastNameP: 'DOCENTE',
      status: UserStatus.ACTIVE,
    });
    db.userRoles.set(PROF_OTHER_USER_ID, [
      { userId: PROF_OTHER_USER_ID, role: RoleType.PROFESSOR },
    ]);
    db.professors.set(PROF_OTHER_ID, {
      id: PROF_OTHER_ID,
      userId: PROF_OTHER_USER_ID,
      name: 'AJENO',
      lastNameP: 'DOCENTE',
      active: true,
    });

    db.users.set(ADMIN_USER_ID, {
      id: ADMIN_USER_ID,
      email: 'admin.coord@pcpuma.acatlan.unam.mx',
      name: 'ADMIN',
      lastNameP: 'MAC',
      status: UserStatus.ACTIVE,
    });
    db.userRoles.set(ADMIN_USER_ID, [
      { userId: ADMIN_USER_ID, role: RoleType.INSTITUTION_ADMIN },
    ]);

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret: process.env.JWT_SECRET,
          signOptions: { expiresIn: '15m' },
        }),
      ],
      controllers: [
        AutenticacionController,
        ConsentsController,
        ChatController,
        QuestionnaireController,
        SectionsController,
        AttendanceController,
        MetricsController,
      ],
      providers: [
        AutenticacionService,
        JwtStrategy,
        JwtAuthGuard,
        RolesGuard,
        ConsentsService,
        ChatService,
        QuestionnaireService,
        SectionsService,
        AttendanceService,
        MetricsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              return process.env[key] ?? defaultValue;
            }),
          },
        },
        { provide: PrismaService, useValue: prismaStatefulMock },
        {
          provide: AuditService,
          useValue: {
            log: jest.fn(async (entry) => {
              db.auditLogs.push(entry);
              return entry;
            }),
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    attendanceService = moduleRef.get<AttendanceService>(AttendanceService);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        response: 'Respuesta generada por el asistente académico PumaIA.',
      }),
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  let studentAccessToken = '';
  let studentRefreshTokenCookie = '';
  let verificationToken = '';

  describe('Escenarios 1 a 8: Autenticación Tradicional, Google OAuth, Rotación y Sesiones por Dispositivo', () => {
    it('1 y 2. Rechaza registro con correo no institucional o localPart no numérico y acepta registro válido @pcpuma.acatlan.unam.mx', async () => {
      // Dominio inválido
      await request(app.getHttpServer())
        .post('/api/autenticacion/register')
        .send({
          email: '318123456@gmail.com',
          password: 'PasswordSegura123!',
          name: 'ALUMNO',
          lastNameP: 'PRUEBA',
          accountNumber: 318123456,
        })
        .expect(400);

      // localPart alfanumérico inválido para estudiante
      await request(app.getHttpServer())
        .post('/api/autenticacion/register')
        .send({
          email: 'juan.perez@pcpuma.acatlan.unam.mx',
          password: 'PasswordSegura123!',
          name: 'JUAN',
          lastNameP: 'PEREZ',
        })
        .expect(400);

      // Registro válido de estudiante
      const regRes = await request(app.getHttpServer())
        .post('/api/autenticacion/register')
        .send({
          email: '318123456@pcpuma.acatlan.unam.mx',
          password: 'PasswordSegura123!',
          name: 'CARLOS',
          lastNameP: 'PUMA',
          accountNumber: 318123456,
          currentSemester: 6,
        })
        .expect(201);

      expect(regRes.body.requiresVerification).toBe(true);
      // Seguridad estricta: el token de verificación NUNCA se expone en la respuesta HTTP
      expect(regRes.body.verificationToken).toBeUndefined();
      expect(regRes.body.devVerificationToken).toBeUndefined();

      const authService = app.get<AutenticacionService>(AutenticacionService);
      const sentMail = authService.getLatestTestEmail('318123456@pcpuma.acatlan.unam.mx');
      expect(sentMail).toBeDefined();
      expect(sentMail?.actionUrl).toContain('mode=verify');
      expect(sentMail?.actionUrl).toContain('email=318123456%40pcpuma.acatlan.unam.mx');
      verificationToken = sentMail!.token;
    });

    it('3 y 4. Bloquea login antes de verificar correo, verifica correo y autentica correctamente (y bloquea tras intentos fallidos)', async () => {
      // Intento de login antes de verificar correo -> 403 Forbidden
      await request(app.getHttpServer())
        .post('/api/autenticacion/login')
        .send({
          email: '318123456@pcpuma.acatlan.unam.mx',
          password: 'PasswordSegura123!',
        })
        .expect(403);

      // Verificar correo con token válido
      await request(app.getHttpServer())
        .post('/api/autenticacion/verify-email')
        .send({
          email: '318123456@pcpuma.acatlan.unam.mx',
          token: verificationToken,
        })
        .expect(200);

      // Contraseña incorrecta -> 401
      await request(app.getHttpServer())
        .post('/api/autenticacion/login')
        .send({
          email: '318123456@pcpuma.acatlan.unam.mx',
          password: 'WrongPassword999',
        })
        .expect(401);

      // Login correcto -> 200 + JWT + Cookie httpOnly
      const loginRes = await request(app.getHttpServer())
        .post('/api/autenticacion/login')
        .send({
          email: '318123456@pcpuma.acatlan.unam.mx',
          password: 'PasswordSegura123!',
        })
        .expect(200);

      expect(loginRes.body.accessToken).toBeDefined();
      expect(loginRes.body.user.accountNumber).toBe(318123456);
      studentAccessToken = loginRes.body.accessToken;

      const setCookie = loginRes.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      const cookieArr = Array.isArray(setCookie) ? setCookie : [setCookie];
      const refreshCookie = cookieArr.find((c: string) =>
        c.startsWith('puma_refresh_token='),
      );
      expect(refreshCookie).toContain('HttpOnly');
      studentRefreshTokenCookie = refreshCookie.split(';')[0];
    });

    it('5. Flujo completo de recuperación y restablecimiento de contraseña (forgot-password + reset-password)', async () => {
      const forgotRes = await request(app.getHttpServer())
        .post('/api/autenticacion/forgot-password')
        .send({ email: '318123456@pcpuma.acatlan.unam.mx' })
        .expect(200);

      // Seguridad estricta: el token de recuperación NUNCA se expone en la respuesta HTTP
      expect(forgotRes.body.resetToken).toBeUndefined();
      expect(forgotRes.body.devResetToken).toBeUndefined();

      const authService = app.get<AutenticacionService>(AutenticacionService);
      const resetMail = authService.getLatestTestEmail('318123456@pcpuma.acatlan.unam.mx');
      expect(resetMail).toBeDefined();
      expect(resetMail?.actionUrl).toContain('mode=reset');

      await request(app.getHttpServer())
        .post('/api/autenticacion/reset-password')
        .send({
          email: '318123456@pcpuma.acatlan.unam.mx',
          token: resetMail!.token,
          newPassword: 'NuevaPassword2026!',
        })
        .expect(200);

      // La sesión previa fue revocada tras el cambio de contraseña
      await request(app.getHttpServer())
        .get('/api/autenticacion/me')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .expect(401);

      // Nuevo login con la nueva contraseña
      const relogin = await request(app.getHttpServer())
        .post('/api/autenticacion/login')
        .send({
          email: '318123456@pcpuma.acatlan.unam.mx',
          password: 'NuevaPassword2026!',
        })
        .expect(200);

      studentAccessToken = relogin.body.accessToken;
      const setCookie = relogin.headers['set-cookie'];
      const cookieArr = Array.isArray(setCookie) ? setCookie : [setCookie];
      studentRefreshTokenCookie = cookieArr
        .find((c: string) => c.startsWith('puma_refresh_token='))
        .split(';')[0];
    });

    it('6. Login con Google OAuth integrado al mismo sistema de sesiones', async () => {
      const authService = app.get<AutenticacionService>(AutenticacionService);
      jest
        .spyOn(authService as any, 'verifyGoogleIdToken')
        .mockResolvedValueOnce({
          sub: 'google-sub-319000111',
          email: '319000111@pcpuma.acatlan.unam.mx',
          name: 'ANA GOMEZ',
          email_verified: true,
          given_name: 'ANA',
          family_name: 'GOMEZ',
        });

      const googleRes = await request(app.getHttpServer())
        .post('/api/autenticacion/google')
        .send({ idToken: 'valid.google.id.token.mock' })
        .expect(200);

      expect(googleRes.body.accessToken).toBeDefined();
      expect(googleRes.body.user.accountNumber).toBe(319000111);
    });

    it('7 y 8. Rotación de refresh token, detección de reutilización y logout independiente por dispositivo', async () => {
      // Iniciar sesión en un segundo dispositivo (Dispositivo B)
      const deviceBLogin = await request(app.getHttpServer())
        .post('/api/autenticacion/login')
        .set('User-Agent', 'Mozilla/5.0 Dispositivo-B')
        .send({
          email: '318123456@pcpuma.acatlan.unam.mx',
          password: 'NuevaPassword2026!',
        })
        .expect(200);

      const deviceBAccessToken = deviceBLogin.body.accessToken;
      const setCookieB = deviceBLogin.headers['set-cookie'];
      const cookieArrB = Array.isArray(setCookieB) ? setCookieB : [setCookieB];
      const deviceBRefreshCookie = cookieArrB
        .find((c: string) => c.startsWith('puma_refresh_token='))
        .split(';')[0];

      // Rotar el refresh token de Dispositivo B
      const refreshRes = await request(app.getHttpServer())
        .post('/api/autenticacion/refresh')
        .set('Cookie', [deviceBRefreshCookie])
        .send({})
        .expect(200);

      expect(refreshRes.body.accessToken).toBeDefined();

      // Reutilizar el refresh token antiguo de Dispositivo B -> debe ser rechazado (401) y revocar esa sesión
      await request(app.getHttpServer())
        .post('/api/autenticacion/refresh')
        .set('Cookie', [deviceBRefreshCookie])
        .send({})
        .expect(401);

      // Dispositivo B quedó revocado tras la reutilización detectada
      await request(app.getHttpServer())
        .get('/api/autenticacion/me')
        .set('Authorization', `Bearer ${deviceBAccessToken}`)
        .expect(401);

      // Mientras tanto, la sesión del Dispositivo A (studentAccessToken) sigue activa e independiente
      await request(app.getHttpServer())
        .get('/api/autenticacion/me')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .set('Cookie', [studentRefreshTokenCookie])
        .expect(200);
    });
  });

  describe('Escenarios 9 a 12: Privacidad, Consentimientos, Chat Sensible y Resúmenes Psicológicos', () => {
    let conversationId = '';
    let summaryId = '';
    let psychologistToken = '';

    beforeAll(async () => {
      const authService = app.get<AutenticacionService>(AutenticacionService);
      const psyUser = db.users.get(PSYCHOLOGIST_USER_ID);
      const psySession = await (authService as any).createSessionAndTokens({
        userId: psyUser.id,
        studentId: null,
        professorId: null,
        email: psyUser.email,
        name: `${psyUser.name} ${psyUser.lastNameP}`,
        roles: [RoleType.ANALYST],
        accountNumber: null,
      });
      psychologistToken = psySession.accessToken;
    });

    it('9. Bloquea el envío de mensajes al chat si el alumno no ha otorgado TERMS_AND_NOTICE', async () => {
      await request(app.getHttpServer())
        .post('/api/chat/message')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .send({ content: 'Hola PumaIA, ¿cómo inscribo materias?' })
        .expect(403);
    });

    it('10. Permite el envío de mensajes al chat tras registrar consentimientos en /api/consents/batch', async () => {
      const noticesRes = await request(app.getHttpServer())
        .get('/api/consents/notices')
        .expect(200);

      expect(noticesRes.body.length).toBe(3);

      const batchConsents = noticesRes.body.map((n: any) => ({
        noticeId: n.id,
        kind: n.kind,
        granted: true,
      }));

      await request(app.getHttpServer())
        .post('/api/consents/batch')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .send({ consents: batchConsents })
        .expect(201);

      const chatRes = await request(app.getHttpServer())
        .post('/api/chat/message')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .send({ content: 'Hola PumaIA, necesito orientación sobre seriación.' })
        .expect(201);

      expect(chatRes.body.content).toContain('PumaIA');
      conversationId = chatRes.body.conversationId;
    });

    it('11. Excluye conversaciones sensibles de la clasificación temática y analítica', async () => {
      // Marcar conversación como sensible
      await request(app.getHttpServer())
        .patch(`/api/chat/conversations/${conversationId}/sensitive`)
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .send({ sensitive: true })
        .expect(200);

      // Intentar etiquetar conversación sensible -> rechazado con 403
      await request(app.getHttpServer())
        .post(`/api/chat/conversations/${conversationId}/labels`)
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .send({ topicId: TOPIC_ID })
        .expect(403);

      // Desmarcar sensible para permitir clasificación cuando tiene consentimiento ANALYTICS
      await request(app.getHttpServer())
        .patch(`/api/chat/conversations/${conversationId}/sensitive`)
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .send({ sensitive: false })
        .expect(200);

      await request(app.getHttpServer())
        .post(`/api/chat/conversations/${conversationId}/labels`)
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .send({ topicId: TOPIC_ID, confidence: 0.92 })
        .expect(201);
    });

    it('12. Ejecuta el ciclo completo de PsychologicalSummary: creación en DRAFT, edición, aprobación, compartición validada y revocación inmediata', async () => {
      // Crear en DRAFT
      const createRes = await request(app.getHttpServer())
        .post('/api/chat/psychological-summaries')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .send({
          content: 'Borrador inicial del estudiante sobre estrés académico.',
          conversationId,
        })
        .expect(201);

      expect(createRes.body.status).toBe(SummaryStatus.DRAFT);
      summaryId = createRes.body.id;

      // Intentar compartir en DRAFT sin aprobar -> 400 Bad Request
      await request(app.getHttpServer())
        .post(`/api/chat/psychological-summaries/${summaryId}/share`)
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .send({ recipientId: PSYCHOLOGIST_USER_ID })
        .expect(400);

      // Editar contenido del borrador
      const editRes = await request(app.getHttpServer())
        .patch(`/api/chat/psychological-summaries/${summaryId}`)
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .send({
          content:
            'Resumen revisado y editado por el estudiante para orientación psicopedagógica.',
        })
        .expect(200);

      expect(editRes.body.status).toBe(SummaryStatus.DRAFT);

      // Aprobar explícitamente (DRAFT -> APPROVED)
      const approveRes = await request(app.getHttpServer())
        .post(`/api/chat/psychological-summaries/${summaryId}/approve`)
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .expect(201);

      expect(approveRes.body.status).toBe(SummaryStatus.APPROVED);

      // Intentar compartir con destinatario inexistente -> 404
      await request(app.getHttpServer())
        .post(`/api/chat/psychological-summaries/${summaryId}/share`)
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .send({ recipientId: '00000000-0000-4000-8000-999999999999' })
        .expect(404);

      // Compartir con psicólogo válido -> SHARED
      const shareRes = await request(app.getHttpServer())
        .post(`/api/chat/psychological-summaries/${summaryId}/share`)
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .send({ recipientId: PSYCHOLOGIST_USER_ID })
        .expect(201);

      expect(shareRes.body.status).toBe(SummaryStatus.SHARED);

      // El destinatario autorizado puede leer el resumen mientras está SHARED
      await request(app.getHttpServer())
        .get(`/api/chat/psychological-summaries/shared/${summaryId}`)
        .set('Authorization', `Bearer ${psychologistToken}`)
        .expect(200);

      // El estudiante revoca el acceso -> REVOKED
      await request(app.getHttpServer())
        .post(`/api/chat/psychological-summaries/${summaryId}/revoke`)
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .expect(201);

      // El destinatario pierde acceso inmediatamente -> 403 Forbidden
      await request(app.getHttpServer())
        .get(`/api/chat/psychological-summaries/shared/${summaryId}`)
        .set('Authorization', `Bearer ${psychologistToken}`)
        .expect(403);
    });
  });

  describe('Escenario 13: Integridad de Cuestionarios (ONBOARDING)', () => {
    it('13. Rechaza preguntas inventadas, opciones ajenas o faltantes obligatorias; acepta envío válido y bloquea doble envío ONBOARDING', async () => {
      // Pregunta inexistente enviada desde el cliente -> 400
      await request(app.getHttpServer())
        .post('/api/questionnaire/save')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .send({
          answers: [
            { id: 'p1_interes', value: 'ia' },
            { id: 'pregunta_inventada_cliente', value: 'hack' },
          ],
        })
        .expect(400);

      // Opción perteneciente a otra pregunta -> 400
      await request(app.getHttpServer())
        .post('/api/questionnaire/save')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .send({
          answers: [
            {
              id: 'p1_interes',
              optionId: '99999999-9999-4999-8999-999999999994',
              value: 'foreign',
            },
          ],
        })
        .expect(400);

      // Envío válido respondiendo la pregunta obligatoria con su opción legítima -> 201
      await request(app.getHttpServer())
        .post('/api/questionnaire/save')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .send({
          answers: [
            {
              id: 'p1_interes',
              optionId: '99999999-9999-4999-8999-999999999993',
              value: 'ia',
            },
          ],
        })
        .expect(201);

      // Intentar enviar ONBOARDING por segunda vez -> 409 Conflict
      await request(app.getHttpServer())
        .post('/api/questionnaire/save')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .send({
          answers: [
            {
              id: 'p1_interes',
              optionId: '99999999-9999-4999-8999-999999999993',
              value: 'ia',
            },
          ],
        })
        .expect(409);
    });
  });

  describe('Escenarios 14, 15 y 16: Seguridad de Grupos, Titularidad Docente y Asistencia con QR Dinámico', () => {
    let adminToken = '';
    let ownerProfToken = '';
    let otherProfToken = '';
    let sectionId = '';
    let joinCode = '';
    let sessionId = '';
    let sessionSecret = '';

    beforeAll(async () => {
      const authService = app.get<AutenticacionService>(AutenticacionService);
      const adminUser = db.users.get(ADMIN_USER_ID);
      const ownerProfUser = db.users.get(PROF_OWNER_USER_ID);
      const otherProfUser = db.users.get(PROF_OTHER_USER_ID);

      adminToken = (
        await (authService as any).createSessionAndTokens({
          userId: adminUser.id,
          studentId: null,
          professorId: null,
          email: adminUser.email,
          name: `${adminUser.name} ${adminUser.lastNameP}`,
          roles: [RoleType.INSTITUTION_ADMIN],
          accountNumber: null,
        })
      ).accessToken;

      ownerProfToken = (
        await (authService as any).createSessionAndTokens({
          userId: ownerProfUser.id,
          studentId: null,
          professorId: PROF_OWNER_ID,
          email: ownerProfUser.email,
          name: `${ownerProfUser.name} ${ownerProfUser.lastNameP}`,
          roles: [RoleType.PROFESSOR],
          accountNumber: null,
        })
      ).accessToken;

      otherProfToken = (
        await (authService as any).createSessionAndTokens({
          userId: otherProfUser.id,
          studentId: null,
          professorId: PROF_OTHER_ID,
          email: otherProfUser.email,
          name: `${otherProfUser.name} ${otherProfUser.lastNameP}`,
          roles: [RoleType.PROFESSOR],
          accountNumber: null,
        })
      ).accessToken;
    });

    it('15 y 16. Impide que un profesor modifique un grupo ajeno y oculta joinCode y roster con PII a los alumnos', async () => {
      // Admin crea el grupo asignado al profesor titular (PROF_OWNER_ID)
      const secRes = await request(app.getHttpServer())
        .post('/api/sections')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          subjectId: SUBJECT_ID,
          periodId: PERIOD_ID,
          groupCode: '2601',
          professorId: PROF_OWNER_ID,
        })
        .expect(201);

      sectionId = secRes.body.id;
      joinCode = secRes.body.joinCode;

      // Profesor AJENO intenta agregar horario o alumno a la lista -> 403 Forbidden
      await request(app.getHttpServer())
        .post(`/api/sections/${sectionId}/meetings`)
        .set('Authorization', `Bearer ${otherProfToken}`)
        .send({ weekday: 1, startTime: '09:00', endTime: '11:00' })
        .expect(403);

      await request(app.getHttpServer())
        .post(`/api/sections/${sectionId}/roster`)
        .set('Authorization', `Bearer ${otherProfToken}`)
        .send({ accountNumber: 318123456, fullName: 'CARLOS PUMA' })
        .expect(403);

      // Profesor TITULAR sí puede agregar horario y alumno a la lista -> 201
      await request(app.getHttpServer())
        .post(`/api/sections/${sectionId}/meetings`)
        .set('Authorization', `Bearer ${ownerProfToken}`)
        .send({ weekday: 1, startTime: '09:00', endTime: '11:00', room: 'A-812' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/sections/${sectionId}/roster`)
        .set('Authorization', `Bearer ${ownerProfToken}`)
        .send({ accountNumber: 318123456, fullName: 'CARLOS PUMA' })
        .expect(201);

      // Alumno consulta GET /api/sections/:id -> NO debe exponer joinCode ni roster completo con PII
      const studentViewRes = await request(app.getHttpServer())
        .get(`/api/sections/${sectionId}`)
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .expect(200);

      expect(studentViewRes.body.joinCode).toBeUndefined();
      expect(studentViewRes.body.roster).toBeUndefined();
      expect(studentViewRes.body.rosterCount).toBe(1);
    });

    it('14. Rechaza asistencia con QR expirado o estático, registra con QR dinámico vigente (25s) y bloquea duplicados', async () => {
      // Profesor ajeno no puede abrir sesión -> 403
      await request(app.getHttpServer())
        .post('/api/attendance/sessions')
        .set('Authorization', `Bearer ${otherProfToken}`)
        .send({ sectionId })
        .expect(403);

      // Profesor titular abre sesión -> 201
      const openRes = await request(app.getHttpServer())
        .post('/api/attendance/sessions')
        .set('Authorization', `Bearer ${ownerProfToken}`)
        .send({ sectionId })
        .expect(201);

      sessionId = openRes.body.id;
      sessionSecret = openRes.body.secret;
      const validQrToken = openRes.body.qrToken;

      // Token QR de una ventana expirada (hace 2 minutos) -> 403 Forbidden
      const expiredQr = attendanceService.generateDynamicQrToken(
        sessionSecret,
        Date.now() - 120_000,
      );
      await request(app.getHttpServer())
        .post('/api/attendance/record')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .send({ sessionId, secret: expiredQr.qrToken })
        .expect(403);

      // Token QR dinámico vigente -> 201 Created
      const attRes = await request(app.getHttpServer())
        .post('/api/attendance/record')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .send({ sessionId, secret: validQrToken })
        .expect(201);

      expect(attRes.body.status).toBe(AttendanceStatus.PRESENT);

      // Segundo intento del mismo alumno en la misma sesión -> 409 Conflict
      await request(app.getHttpServer())
        .post('/api/attendance/record')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .send({ sessionId, secret: validQrToken })
        .expect(409);
    });
  });

  describe('Escenario 17 y Vistas SQL: K-Anonimato Estricto por Estudiantes Únicos (< 10 vs >= 10)', () => {
    let adminToken = '';

    beforeAll(async () => {
      const authService = app.get<AutenticacionService>(AutenticacionService);
      const adminUser = db.users.get(ADMIN_USER_ID);
      adminToken = (
        await (authService as any).createSessionAndTokens({
          userId: adminUser.id,
          studentId: null,
          professorId: null,
          email: adminUser.email,
          name: `${adminUser.name} ${adminUser.lastNameP}`,
          roles: [RoleType.INSTITUTION_ADMIN],
          accountNumber: null,
        })
      ).accessToken;
    });

    it('17. Enmascara métricas cuando hay < 10 estudiantes únicos (incluso con múltiples eventos) y revela agregados cuando hay >= 10 estudiantes únicos', async () => {
      // Actualmente solo 1 estudiante único tiene etiqueta en TOPIC_ID -> debe estar restringido (<10)
      const topicsSmallRes = await request(app.getHttpServer())
        .get('/api/metrics/chat-topics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(topicsSmallRes.body[0].totalStudents).toBe('<10');
      expect(topicsSmallRes.body[0].totalQueries).toBe('RESTRINGIDO');
      expect(topicsSmallRes.body[0].kAnonymityProtected).toBe(true);

      // Sembrar 9 estudiantes con consentimiento ANALYTICS y conversaciones no sensibles etiquetadas (total = 9 < 10 -> sigue protegido)
      const analyticsNotice = Array.from(db.privacyNotices.values()).find(
        (n) => n.kind === ConsentKind.ANALYTICS,
      );

      for (let i = 1; i <= 9; i++) {
        const uid = nextUuid();
        const sid = nextUuid();
        const cid = nextUuid();
        db.users.set(uid, {
          id: uid,
          email: `32000000${i}@pcpuma.acatlan.unam.mx`,
          status: UserStatus.ACTIVE,
        });
        db.students.set(sid, {
          id: sid,
          userId: uid,
          accountNumber: 320000000 + i,
          careerId: CAREER_ID,
          currentSemester: 4,
        });
        db.consents.push({
          id: nextUuid(),
          userId: uid,
          noticeId: analyticsNotice?.id || 'n-1',
          kind: ConsentKind.ANALYTICS,
          granted: true,
          createdAt: new Date(),
        });
        db.conversations.set(cid, {
          id: cid,
          studentId: sid,
          sensitive: false,
        });
        db.conversationLabels.push({
          id: nextUuid(),
          conversationId: cid,
          topicId: TOPIC_ID,
          confidence: 0.9,
        });
      }

      const topicsNineRes = await request(app.getHttpServer())
        .get('/api/metrics/chat-topics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(topicsNineRes.body[0].totalStudents).toBe('<10');
      expect(topicsNineRes.body[0].kAnonymityProtected).toBe(true);

      // Agregar el décimo estudiante único con consentimiento ANALYTICS y conversación no sensible (total = 10 >= 10 -> revela métrica agregada)
      const uid10 = nextUuid();
      const sid10 = nextUuid();
      const cid10 = nextUuid();
      db.users.set(uid10, {
        id: uid10,
        email: '320000010@pcpuma.acatlan.unam.mx',
        status: UserStatus.ACTIVE,
      });
      db.students.set(sid10, {
        id: sid10,
        userId: uid10,
        accountNumber: 320000010,
        careerId: CAREER_ID,
        currentSemester: 4,
      });
      db.consents.push({
        id: nextUuid(),
        userId: uid10,
        noticeId: analyticsNotice?.id || 'n-1',
        kind: ConsentKind.ANALYTICS,
        granted: true,
        createdAt: new Date(),
      });
      db.conversations.set(cid10, {
        id: cid10,
        studentId: sid10,
        sensitive: false,
      });
      db.conversationLabels.push({
        id: nextUuid(),
        conversationId: cid10,
        topicId: TOPIC_ID,
        confidence: 0.9,
      });

      const topicsLargeRes = await request(app.getHttpServer())
        .get('/api/metrics/chat-topics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(topicsLargeRes.body[0].totalStudents).toBe('10');
      expect(topicsLargeRes.body[0].totalQueries).toBe(10);
      expect(topicsLargeRes.body[0].kAnonymityProtected).toBe(false);
    });

    it('18. Verifica que las 7 vistas SQL en prisma/views_adapted/*.sql usen los nombres físicos reales de prisma/schema.prisma y apliquen k-anonimato', () => {
      const viewsDir = path.join(process.cwd(), 'prisma', 'views_adapted');
      const v1 = fs.readFileSync(
        path.join(viewsDir, '01_perfil_alumno_v3.sql'),
        'utf8',
      );
      const v2 = fs.readFileSync(
        path.join(viewsDir, '02_vista_metricas_rendimiento.sql'),
        'utf8',
      );
      const v3 = fs.readFileSync(
        path.join(viewsDir, '03_vista_metricas_rezago.sql'),
        'utf8',
      );
      const v4 = fs.readFileSync(
        path.join(viewsDir, '04_vista_metricas_asistencia.sql'),
        'utf8',
      );
      const v5 = fs.readFileSync(
        path.join(viewsDir, '05_vista_metricas_temas_chat.sql'),
        'utf8',
      );
      const v6 = fs.readFileSync(
        path.join(viewsDir, '06_vista_metricas_satisfaccion.sql'),
        'utf8',
      );
      const v7 = fs.readFileSync(
        path.join(viewsDir, '07_vista_metricas_trayectoria_ia.sql'),
        'utf8',
      );

      // 01: usa m.materia y ae.area_expertise, sin m.nombre ni ae.nombre en el cuerpo SQL
      const v1Body = v1.replace(/--.*$/gm, '');
      expect(v1Body).toContain('m.materia');
      expect(v1Body).toContain('ae.area_expertise');
      expect(v1Body).not.toContain('m.nombre');
      expect(v1Body).not.toContain('ae.nombre');

      // 02: usa m.materia y COUNT(DISTINCT i.id_alumno) >= 10
      expect(v2).toContain('m.materia AS materia');
      expect(v2).toContain('COUNT(DISTINCT i.id_alumno) >= 10');

      // 03: usa COUNT(DISTINCT a.id_alumno) >= 10
      expect(v3).toContain('COUNT(DISTINCT a.id_alumno) >= 10');

      // 04: usa m.materia y COUNT(DISTINCT ar.id_alumno) >= 10
      expect(v4).toContain('m.materia AS materia');
      expect(v4).toContain('COUNT(DISTINCT ar.id_alumno) >= 10');

      // 05: filtra conv.sensible = false, verifica consentimiento ANALYTICS y cuenta DISTINCT conv.id_alumno >= 10
      expect(v5).toContain('conv.sensible = false');
      expect(v5).toContain("cs.tipo = 'ANALYTICS'");
      expect(v5).toContain('COUNT(DISTINCT conv.id_alumno) >= 10');

      // 06: une envio_cuestionario y cuenta DISTINCT env.id_alumno >= 10
      expect(v6).toContain('JOIN envio_cuestionario env ON env.id_envio = ans.id_envio');
      expect(v6).toContain('COUNT(DISTINCT env.id_alumno) >= 10');

      // 07: usa opt.id_opcion_ia y enmascara total_rutas_propuestas cuando < 10
      expect(v7).toContain('opt.id_opcion_ia');
      expect(v7).not.toContain('opt.id_opcion_resultado');
      expect(v7).toContain("ELSE 'RESTRINGIDO'");
    });
  });
});
