import { PrismaClient, RoleType, SessionStatus, AttendanceStatus, AttendanceMethod } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { AttendanceService } from '../src/attendance/attendance.service';
import { AuditService } from '../src/audit/audit.service';
import { resolveDatabaseConnectionString } from '../src/prisma/prisma.service';

async function runTests() {
  console.log('🚀 INICIANDO PRUEBAS DE VERIFICACIÓN INTEGRAL DE PUMAIA...\n');

  const connectionString = resolveDatabaseConnectionString();
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
  await prisma.$connect();

  const auditService = new AuditService(prisma as any);
  const attendanceService = new AttendanceService(prisma as any, auditService);

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (detail) console.error(`   Detalle: ${detail}`);
    }
  }

  try {
    // ══════════════════════════════════════════════════════════════
    // BLOQUE 1: PRUEBAS DE ROTACIÓN Y VALIDACIÓN DEL QR (CADA 5s)
    // ══════════════════════════════════════════════════════════════
    console.log('--- 1. Pruebas de Rotación Automática y Sincronización del QR (5s) ---');

    assert(
      AttendanceService.QR_WINDOW_SECONDS === 5,
      'Ventana de QR configurada estrictamente a 5 segundos',
      `Esperado 5, obtenido: ${AttendanceService.QR_WINDOW_SECONDS}`,
    );

    const secret = 'TEST_SESSION_SECRET_KEY_12345';
    const baseTime = 1700000000000; // Marca fija para cálculo determinista

    const tokenStep0 = attendanceService.computeQrTokenForStep(secret, 100);
    const tokenStep1 = attendanceService.computeQrTokenForStep(secret, 101);
    const tokenStep2 = attendanceService.computeQrTokenForStep(secret, 102);

    assert(
      tokenStep0.startsWith('QR-') && tokenStep1.startsWith('QR-') && tokenStep0 !== tokenStep1,
      'El QR rota y genera tokens distintos en pasos consecutivos de 5s',
      `tokenStep0=${tokenStep0}, tokenStep1=${tokenStep1}`,
    );

    // Validación temporal con tolerancia de red (ventana actual + ventana anterior de 5s)
    const stepMs = 5000;
    const nowMs = 101 * stepMs + 2000; // En medio del step 101

    assert(
      attendanceService.isDynamicQrTokenValid(secret, tokenStep1, nowMs),
      'El token de la ventana vigente actual (step 101) es aceptado',
    );

    assert(
      attendanceService.isDynamicQrTokenValid(secret, tokenStep0, nowMs),
      'El token de la ventana inmediata anterior (step 100) es aceptado por latencia de red',
    );

    const expiredToken = attendanceService.computeQrTokenForStep(secret, 98);
    assert(
      !attendanceService.isDynamicQrTokenValid(secret, expiredToken, nowMs),
      'Un token de hace más de 10 segundos es estrictamente rechazado por expiración',
    );

    assert(
      !attendanceService.isDynamicQrTokenValid(secret, 'INVALID_TOKEN_XYZ', nowMs),
      'Un token con formato no válido o secreto estático es rechazado',
    );

    // ══════════════════════════════════════════════════════════════
    // BLOQUE 2: PRUEBAS DE ASISTENCIA POR DÍA Y MATERIA
    // ══════════════════════════════════════════════════════════════
    console.log('\n--- 2. Pruebas de Asistencias Individuales por Día y Materia ---');

    // Buscar una sección académica de prueba
    const section = await prisma.courseSection.findFirst({
      include: { subject: true, professor: true, enrollments: true, roster: true },
    });

    if (!section) {
      console.warn('⚠️ No se encontró sección académica en la BD. Saltando prueba con base de datos.');
    } else {
      console.log(`Grupo seleccionado para prueba: ${section.groupCode} - ${section.subject?.subject}`);

      // Obtener o crear estudiante de prueba
      let student = await prisma.student.findFirst({
        where: {
          OR: [
            { enrollments: { some: { sectionId: section.id } } },
            { rosterEntries: { some: { sectionId: section.id } } },
          ],
        },
      });

      if (!student) {
        student = await prisma.student.findFirst();
        if (student) {
          // Inscribir al estudiante en la sección para la prueba
          await prisma.sectionRoster.upsert({
            where: {
              sectionId_accountNumber: {
                sectionId: section.id,
                accountNumber: student.accountNumber,
              },
            },
            create: {
              sectionId: section.id,
              accountNumber: student.accountNumber,
              fullName: 'Alumno de Prueba Integral',
              linkedStudentId: student.id,
              origin: 'JOIN_CODE',
            },
            update: { linkedStudentId: student.id },
          });
        }
      }

      if (student) {
        // Simular horario activo para permitir apertura
        await attendanceService.setSectionScheduleSimulation(section.id, true, {
          userId: section.professor?.userId || 'admin',
          roles: [RoleType.INSTITUTION_ADMIN],
        } as any);

        // FECHA 1: Lunes 9 de Noviembre
        const date1 = '2026-11-09T10:00:00.000Z';
        const session1 = await attendanceService.openSession(
          section.id,
          'prof-test-user',
          { userId: section.professor?.userId || 'admin', roles: [RoleType.INSTITUTION_ADMIN] } as any,
          date1,
        );

        assert(Boolean(session1 && session1.id), 'Se abre exitosamente la sesión para la Fecha 1 (9 Nov)');

        // Registrar asistencia en Fecha 1
        const record1 = await attendanceService.markAttendance(student.id, {
          sessionId: session1.id,
          secret: session1.qrToken,
        });

        assert(
          record1.status === AttendanceStatus.PRESENT && record1.sessionId === session1.id,
          'Se registra exitosamente la asistencia del alumno en la Fecha 1 con QR',
        );

        // Intentar registrar duplicado en la misma sesión
        let duplicateCaught = false;
        try {
          await attendanceService.markAttendance(student.id, {
            sessionId: session1.id,
            secret: session1.qrToken,
          });
        } catch (err: any) {
          duplicateCaught = err.status === 409 || err.message?.includes('Ya has registrado');
        }
        assert(
          duplicateCaught,
          'Se bloquea intento de registrar asistencia duplicada en la misma sesión/fecha',
        );

        // FECHA 2: Lunes 16 de Noviembre
        const date2 = '2026-11-16T10:00:00.000Z';
        const session2 = await attendanceService.openSession(
          section.id,
          'prof-test-user',
          { userId: section.professor?.userId || 'admin', roles: [RoleType.INSTITUTION_ADMIN] } as any,
          date2,
        );

        assert(
          session2.id !== session1.id,
          'La Fecha 2 genera una sesión independiente y no sobrescribe la Fecha 1',
        );

        // Registrar asistencia en Fecha 2
        const record2 = await attendanceService.markAttendance(student.id, {
          sessionId: session2.id,
          secret: session2.qrToken,
        });

        assert(
          record2.status === AttendanceStatus.PRESENT && record2.sessionId === session2.id,
          'Se registra exitosamente la asistencia del alumno en la Fecha 2 de manera independiente',
        );

        // Consultar historial del estudiante
        const myAttendances = await attendanceService.getMyAttendance(student.id, section.id);
        const hasDate1 = myAttendances.some((r) => r.sessionId === session1.id);
        const hasDate2 = myAttendances.some((r) => r.sessionId === session2.id);

        assert(
          hasDate1 && hasDate2 && myAttendances.length >= 2,
          'El alumno puede consultar sus asistencias individuales en ambas fechas para la misma materia',
        );

        // Consultar historial desde el profesor
        const teacherSessions = await attendanceService.getSectionSessions(section.id, {
          userId: section.professor?.userId || 'admin',
          roles: [RoleType.INSTITUTION_ADMIN],
        } as any);

        assert(
          teacherSessions.some((s) => s.id === session1.id) &&
            teacherSessions.some((s) => s.id === session2.id),
          'El profesor puede consultar el catálogo de sesiones por fecha de la asignatura',
        );

        const studentHistory = await attendanceService.getSectionStudentAttendanceHistory(
          section.id,
          student.id,
          { userId: section.professor?.userId || 'admin', roles: [RoleType.INSTITUTION_ADMIN] } as any,
        );

        assert(
          studentHistory.length >= 2,
          'El profesor puede consultar el historial individual del alumno por fecha',
        );

        // ══════════════════════════════════════════════════════════════
        // BLOQUE 3: PRUEBAS DE SEGURIDAD Y RESTRICCIONES DE ACCESO
        // ══════════════════════════════════════════════════════════════
        console.log('\n--- 3. Pruebas de Seguridad y Restricciones de Acceso ---');

        // Un profesor no autorizado no puede consultar el grupo
        let unauthorizedCaught = false;
        try {
          await attendanceService.getSectionSessions(section.id, {
            userId: 'prof-unauthorized-random-user',
            roles: [RoleType.PROFESSOR],
            professorId: 'unauthorized-prof-id',
          } as any);
        } catch (err: any) {
          unauthorizedCaught = err.status === 403;
        }

        assert(
          unauthorizedCaught,
          'Un profesor no puede consultar grupos o asistencias que no tiene asignados (403 Forbidden)',
        );

        // Limpieza de datos de prueba
        await prisma.attendanceRecord.deleteMany({
          where: { sessionId: { in: [session1.id, session2.id] } },
        });
        await prisma.classSession.deleteMany({
          where: { id: { in: [session1.id, session2.id] } },
        });
        await attendanceService.setSectionScheduleSimulation(section.id, false, {
          userId: section.professor?.userId || 'admin',
          roles: [RoleType.INSTITUTION_ADMIN],
        } as any);
      }
    }

    console.log(`\n========================================`);
    console.log(`RESULTADO FINAL DE PRUEBAS: ${passedTests}/${totalTests} superadas.`);
    console.log(`========================================\n`);
  } finally {
    await prisma.$disconnect();
  }
}

runTests().catch((e) => {
  console.error('Error durante la ejecución de pruebas:', e);
  process.exit(1);
});

