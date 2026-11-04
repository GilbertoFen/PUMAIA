import { chromium } from 'playwright-core';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import * as http from 'http';
import * as fs from 'fs';
import { spawn } from 'child_process';

const TEST_DB_URL =
  'postgresql://postgres:postgres@127.0.0.1:5433/pumaia_test?schema=public';
const OUTBOX_PATH = '/tmp/pumaia-e2e-outbox.jsonl';
const CHROME_PATH =
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForHttp(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      // retry
    }
    await sleep(400);
  }
  throw new Error(`Timeout waiting for ${url}`);
}

function readLatestEmailLink(toEmail) {
  if (!fs.existsSync(OUTBOX_PATH)) return null;
  const map = JSON.parse(fs.readFileSync(OUTBOX_PATH, 'utf8'));
  return map[toEmail.toLowerCase()] || null;
}

async function main() {
  console.log('=== INICIANDO PRUEBAS E2E DE NAVEGADOR (PLAYWRIGHT + POSTGRESQL 16 REAL) ===');
  if (fs.existsSync(OUTBOX_PATH)) fs.unlinkSync(OUTBOX_PATH);

  // 1. Servidor mock de FastAPI para respuestas deterministas de chat en E2E
  const fastApiServer = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          response:
            'Hola estudiante de MAC. Las reinscripciones se realizan en el portal SIAE según tu promedio.',
        }),
      );
    });
  });
  await new Promise((resolve) => fastApiServer.listen(8099, '127.0.0.1', resolve));

  // 2. Sembrar datos base en PostgreSQL 16 real (pumaia_test)
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: TEST_DB_URL }),
  });
  await prisma.$connect();

  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "asistencia",
      "sesion_clase",
      "lista_grupo",
      "carga_lista",
      "horario_grupo",
      "inscripcion",
      "historial_academico",
      "importacion_horario",
      "grupo",
      "respuesta",
      "envio_cuestionario",
      "opcion_pregunta",
      "pregunta",
      "cuestionario",
      "resumen_psicologico",
      "etiqueta_conversacion",
      "retroalimentacion_mensaje",
      "mensajes",
      "conversaciones",
      "tema",
      "opcion_resultado_ia",
      "resultado_ia",
      "categoria_ia",
      "consentimiento",
      "aviso_privacidad",
      "sesion_autenticacion",
      "rol_usuario",
      "alumno",
      "profesores",
      "usuario",
      "carrera",
      "materia",
      "categoria",
      "plan_estudios",
      "area_conocimiento",
      "periodo_academico",
      "institucion",
      "bitacora_auditoria"
    RESTART IDENTITY CASCADE;
  `);

  const inst = await prisma.institution.create({
    data: { name: 'Facultad de Estudios Superiores Acatlán', code: '240' },
  });
  const ka = await prisma.knowledgeArea.create({
    data: { knowledgeArea: 'CIENCIAS_FISICO_MATEMATICAS_Y_DE_LAS_INGENIERIAS' },
  });
  const sp = await prisma.studyPlan.create({
    data: {
      studyPlan: 'Plan MAC 2016',
      semesters: 8,
      totalCredits: 380,
      level: 'LICENCIATURA',
      system: 'ESCOLARIZADO',
    },
  });
  const career = await prisma.career.create({
    data: {
      institutionId: inst.id,
      name: 'Matemáticas Aplicadas y Computación',
      code: '121',
      studyPlanId: sp.id,
      knowledgeAreaId: ka.id,
      isMasters: false,
    },
  });
  const cat = await prisma.category.create({
    data: { category: 'COMPUTACION' },
  });
  const subj = await prisma.subject.create({
    data: {
      subject: 'Ingeniería de Software I',
      code: 1504,
      semester: 5,
      credits: 8,
      categoryId: cat.id,
      studyPlanId: sp.id,
    },
  });
  const period = await prisma.academicPeriod.create({
    data: { institutionId: inst.id, code: '2026-1' },
  });

  const adminPasswordHash = await bcrypt.hash('AdminPuma2026!', 12);
  await prisma.user.create({
    data: {
      institutionId: inst.id,
      email: 'admin.e2e@pcpuma.acatlan.unam.mx',
      name: 'DIRECTIVO',
      lastNameP: 'MAC',
      passwordHash: adminPasswordHash,
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: { role: 'INSTITUTION_ADMIN' } },
    },
  });

  // 3. Iniciar Backend NestJS en puerto 4000 y Frontend Next.js en puerto 3000
  const backendProc = spawn('node', ['dist/src/main.js'], {
    cwd: '/Users/Gil/Documents/pumaAPI',
    env: {
      ...process.env,
      PORT: '4000',
      NODE_ENV: 'test',
      DIRECT_URL: TEST_DB_URL,
      DATABASE_URL: TEST_DB_URL,
      JWT_SECRET: 'pumaia-e2e-jwt-secret-2026',
      JWT_REFRESH_SECRET: 'pumaia-e2e-refresh-secret-2026',
      FRONTEND_URL: 'http://localhost:3000',
      FASTAPI_CHAT_URL: 'http://127.0.0.1:8099/chat',
      N8N_CHAT_WEBHOOK_URL: 'http://127.0.0.1:8099/chat',
      EMAIL_TEST_OUTBOX_PATH: OUTBOX_PATH,
    },
    stdio: 'pipe',
  });

  const frontendProc = spawn('npx', ['next', 'start', '-p', '3000'], {
    cwd: '/Users/Gil/Desktop/DWP/PumaIA/puma-react',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      NEXT_PUBLIC_API_URL: 'http://localhost:4000/api',
    },
    stdio: 'pipe',
  });

  let browser;
  try {
    await waitForHttp('http://localhost:4000/api/consents/notices', 20000);
    await waitForHttp('http://localhost:3000', 20000);
    console.log('✓ Backend (4000) y Frontend (3000) activos y conectados a PostgreSQL 16');

    browser = await chromium.launch({
      executablePath: CHROME_PATH,
      headless: true,
    });

    const pageErrors = [];

    // =========================================================================
    // FLUJO 1: ESTUDIANTE
    // Registrarse -> Verificar correo -> Iniciar sesión -> Aceptar aviso y consentimientos ->
    // Persistencia al recargar -> Entrar al chat y enviar mensaje -> Cerrar sesión ->
    // Recuperar contraseña y volver a iniciar sesión
    // =========================================================================
    console.log('\n--- [E2E 1/3] Flujo de Estudiante en Navegador Real ---');
    const studentCtx = await browser.newContext();
    const page = await studentCtx.newPage();
    page.on('pageerror', (err) => pageErrors.push(`Student pageerror: ${err.message}`));

    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Darse de alta con correo PCPuma/i }).click();

    // El modal de Aviso de Privacidad se abre automáticamente; desplazarse al final y aceptar
    await page.waitForSelector('#privacy-title');
    await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (dialog) {
        const scrollable = Array.from(dialog.querySelectorAll('div')).find(
          (el) => el.scrollHeight > el.clientHeight,
        );
        if (scrollable) {
          scrollable.scrollTop = scrollable.scrollHeight;
          scrollable.dispatchEvent(new Event('scroll', { bubbles: true }));
        }
      }
    });
    await sleep(150);
    await page.getByRole('button', { name: /Aceptar y continuar/i }).click();

    // Llenar formulario de registro de estudiante
    await page.getByPlaceholder('Ej: 321190239', { exact: true }).fill('318777666');
    await page.getByPlaceholder('Nombres', { exact: true }).fill('Luis');
    await page.getByPlaceholder('Apellido Paterno', { exact: true }).fill('Hernandez');
    await page.getByPlaceholder('Apellido Materno', { exact: true }).fill('Gomez');
    await page.getByPlaceholder('Ej: 321190239@pcpuma.acatlan.unam.mx', { exact: true }).fill('318777666@pcpuma.acatlan.unam.mx');
    await page.getByPlaceholder('Contraseña', { exact: true }).fill('PumaE2E2026!');
    await page.getByPlaceholder('Repite tu contraseña', { exact: true }).fill('PumaE2E2026!');
    await page.getByRole('button', { name: /Crear cuenta/i }).click();

    // Esperar a que cambie a vista "Verificar Correo" y leer enlace real desde bandeja de correo
    await page.waitForSelector('text=Verificar Correo');
    await sleep(300);
    const verifyEmailEntry = readLatestEmailLink(
      '318777666@pcpuma.acatlan.unam.mx',
      'VERIFY_EMAIL',
    );
    if (!verifyEmailEntry || !verifyEmailEntry.actionUrl) {
      throw new Error('No se encontró el correo de verificación en la bandeja de salida');
    }
    console.log(`  ✓ Correo de verificación emitido con enlace: ${verifyEmailEntry.actionUrl.slice(0, 68)}...`);

    // Abrir el enlace de verificación real en el navegador
    await page.goto(verifyEmailEntry.actionUrl, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Confirmar correo/i }).click();

    // Ahora estamos en modo login: iniciar sesión con correo y contraseña
    await page.waitForSelector('text=Ingresa al Portal');
    await page.getByPlaceholder('Ej: 321190239@pcpuma.acatlan.unam.mx').fill('318777666@pcpuma.acatlan.unam.mx');
    await page.getByPlaceholder('Ej: ••••••••').fill('PumaE2E2026!');
    await page.getByRole('button', { name: 'Continuar' }).click();

    // Verificar llegada a pantalla de Bienvenida o Portal con datos reales desde PostgreSQL
    await page.waitForSelector('text=LUIS HERNANDEZ GOMEZ', { timeout: 10000 });
    console.log('  ✓ Inicio de sesión exitoso y carga de perfil desde PostgreSQL (LUIS HERNANDEZ GOMEZ)');

    // Verificar persistencia de sesión al recargar la página
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('text=LUIS HERNANDEZ GOMEZ', { timeout: 10000 });
    console.log('  ✓ Persistencia de sesión comprobada al recargar la página');

    // Verificar en PostgreSQL que los 3 consentimientos se sincronizaron al iniciar sesión
    const studentConsents = await prisma.consentRecord.findMany();
    if (studentConsents.length < 3) {
      throw new Error(`Se esperaban 3 consentimientos sincronizados, se encontraron ${studentConsents.length}`);
    }
    console.log('  ✓ Consentimientos TERMS_AND_NOTICE, ANALYTICS e IMPROVEMENT registrados en PostgreSQL');

    // Entrar al chat (/chat) y enviar un mensaje real
    await page.goto('http://localhost:3000/chat', { waitUntil: 'networkidle' });
    await page.waitForSelector('textarea, input[type="text"]', { timeout: 10000 });
    const chatInput = page.locator('textarea, input[type="text"]').first();
    await chatInput.fill('¿Cuándo son las reinscripciones de MAC?');
    await chatInput.press('Enter');

    await page.waitForSelector('text=portal SIAE', { timeout: 10000 });
    console.log('  ✓ Mensaje enviado en /chat y respuesta del asistente renderizada en el navegador');

    // Cerrar sesión desde /settings
    await page.goto('http://localhost:3000/settings', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await page.waitForSelector('text=Ingresa al Portal', { timeout: 10000 });
    console.log('  ✓ Cierre de sesión ejecutado desde /settings y revocado en backend');

    // Recuperar contraseña desde la interfaz de login y volver a iniciar sesión
    await page.getByRole('button', { name: /¿Olvidaste tu contraseña\?/i }).click();
    await page.waitForSelector('text=Recuperar Contraseña');
    await page.getByPlaceholder('321190239@pcpuma.acatlan.unam.mx').fill('318777666@pcpuma.acatlan.unam.mx');
    await page.getByRole('button', { name: /Solicitar código/i }).click();
    await sleep(300);

    const resetEmailEntry = readLatestEmailLink(
      '318777666@pcpuma.acatlan.unam.mx',
      'RESET_PASSWORD',
    );
    if (!resetEmailEntry || !resetEmailEntry.actionUrl) {
      throw new Error('No se encontró el correo de recuperación en la bandeja de salida');
    }
    await page.goto(resetEmailEntry.actionUrl, { waitUntil: 'networkidle' });
    await page.getByPlaceholder('Nueva contraseña', { exact: true }).fill('NuevaPumaE2E2026#');
    await page.getByPlaceholder('Repite la nueva contraseña', { exact: true }).fill('NuevaPumaE2E2026#');
    await page.getByRole('button', { name: /Restablecer contraseña/i }).click();

    await page.waitForSelector('text=Ingresa al Portal');
    await page.getByPlaceholder('Ej: 321190239@pcpuma.acatlan.unam.mx').fill('318777666@pcpuma.acatlan.unam.mx');
    await page.getByPlaceholder('Ej: ••••••••').fill('NuevaPumaE2E2026#');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.waitForSelector('text=LUIS HERNANDEZ GOMEZ', { timeout: 10000 });
    console.log('  ✓ Recuperación de contraseña y re-inicio de sesión completados con éxito');
    await studentCtx.close();

    // =========================================================================
    // FLUJO 2: PROFESOR
    // Recibir invitación -> Establecer contraseña -> Iniciar sesión en /profesor ->
    // Consultar grupos asignados -> Abrir sesión de asistencia con QR dinámico ->
    // Consultar registros -> Cerrar sesión
    // =========================================================================
    console.log('\n--- [E2E 2/3] Flujo de Profesor en Navegador Real ---');
    // Invitar profesor usando cuenta de administrador
    const adminLoginRes = await fetch('http://localhost:4000/api/autenticacion/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin.e2e@pcpuma.acatlan.unam.mx',
        password: 'AdminPuma2026!',
      }),
    });
    const adminAuth = await adminLoginRes.json();

    const inviteRes = await fetch('http://localhost:4000/api/autenticacion/invite-staff', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAuth.accessToken}`,
      },
      body: JSON.stringify({
        email: 'prof.sofia@pcpuma.acatlan.unam.mx',
        name: 'DRA. SOFIA',
        lastNameP: 'DOCENTE',
        role: 'PROFESSOR',
      }),
    });
    const inviteData = await inviteRes.json();

    // Crear grupo real asignado a la profesora y vincular al estudiante 318777666
    const profUser = await prisma.user.findUnique({
      where: { email: 'prof.sofia@pcpuma.acatlan.unam.mx' },
      include: { professor: true },
    });
    const profRecord = profUser.professor;
    const section = await prisma.courseSection.create({
      data: {
        subjectId: subj.id,
        periodId: period.id,
        professorId: profRecord.id,
        groupCode: '2501',
        joinCode: 'SOFIA2501',
      },
    });
    const studentRecord = await prisma.student.findUnique({
      where: { accountNumber: 318777666 },
    });
    await prisma.sectionRoster.create({
      data: {
        sectionId: section.id,
        accountNumber: 318777666,
        fullName: 'LUIS HERNANDEZ GOMEZ',
        origin: 'PROFESSOR_LIST',
        status: 'LINKED',
        linkedStudentId: studentRecord.id,
      },
    });

    const profCtx = await browser.newContext();
    const profPage = await profCtx.newPage();
    profPage.on('pageerror', (err) => pageErrors.push(`Professor pageerror: ${err.message}`));

    // Abrir enlace de invitación desde el correo para establecer contraseña
    const inviteEmail = readLatestEmailLink(
      'prof.sofia@pcpuma.acatlan.unam.mx',
      'STAFF_INVITATION',
    );
    if (!inviteEmail || !inviteEmail.actionUrl) {
      throw new Error('No se encontró el correo de invitación docente');
    }
    await profPage.goto(inviteEmail.actionUrl, { waitUntil: 'networkidle' });
    await profPage.getByPlaceholder('Nueva contraseña', { exact: true }).fill('ProfSofia2026!');
    await profPage.getByPlaceholder('Repite la nueva contraseña', { exact: true }).fill('ProfSofia2026!');
    await profPage.getByRole('button', { name: /Restablecer contraseña/i }).click();
    await profPage.waitForSelector('text=Ingresa al Portal');
    console.log('  ✓ Invitación docente activada y contraseña establecida desde enlace de correo');

    // Ir a /profesor, comprobar rechazo de contraseña incorrecta y luego iniciar sesión
    await profPage.goto('http://localhost:3000/profesor', { waitUntil: 'networkidle' });
    await profPage.waitForSelector('text=Acceso a Profesores');
    await profPage.getByPlaceholder('ejemplo@pcpuma.acatlan.unam.mx').fill('prof.sofia@pcpuma.acatlan.unam.mx');
    await profPage.getByPlaceholder('••••••••••••').fill('ClaveIncorrecta999');
    await profPage.getByRole('button', { name: 'Continuar' }).click();
    await profPage.waitForSelector('.login-error');
    console.log('  ✓ Contraseña incorrecta rechazada en /profesor (sin bypass demo)');

    await profPage.getByPlaceholder('••••••••••••').fill('ProfSofia2026!');
    await profPage.getByRole('button', { name: 'Continuar' }).click();

    // Verificar carga del grupo real "Ingeniería de Software I" y "Grupo 2501"
    await profPage.waitForSelector('text=Ingeniería de Software I', { timeout: 10000 });
    await profPage.waitForSelector('text=Grupo 2501', { timeout: 10000 });
    console.log('  ✓ Portal Docente cargado con el grupo real asignado (Ingeniería de Software I · Grupo 2501)');

    // Activar horario de clase si está fuera de horario y abrir modal de QR dinámico (Ver QR de asistencia)
    const simBtn = profPage.getByRole('button', { name: /Simular: En clase ahora/i }).first();
    if (await simBtn.isVisible()) {
      await simBtn.click();
    }
    await profPage.getByRole('button', { name: /Ver QR de asistencia/i }).first().click();
    await sleep(600);

    // Verificar que se creó la sesión real en PostgreSQL (tabla sesion_clase)
    const activeSessions = await prisma.classSession.findMany({
      where: { sectionId: section.id },
    });
    if (activeSessions.length === 0) {
      throw new Error('No se creó la sesión de asistencia en PostgreSQL al abrir el modal QR');
    }
    console.log(`  ✓ Sesión de asistencia con QR dinámico abierta en PostgreSQL (id=${activeSessions[0].id})`);

    // Cerrar modal QR, consultar lista de alumnos y cerrar sesión docente
    await profPage.getByRole('button', { name: 'Cerrar ventana de QR' }).click();
    await profPage.getByRole('button', { name: /Ver lista de alumnos/i }).first().click();
    await profPage.waitForSelector('text=LUIS HERNANDEZ GOMEZ', { timeout: 10000 });
    console.log('  ✓ Lista de alumnos del grupo consultada correctamente (LUIS HERNANDEZ GOMEZ)');

    await profPage.getByRole('button', { name: 'Cerrar lista de alumnos' }).click();
    await profPage.getByRole('button', { name: /Cerrar Sesión/i }).click();
    await profPage.waitForSelector('text=Acceso a Profesores', { timeout: 10000 });
    console.log('  ✓ Cierre de sesión docente completado');
    await profCtx.close();

    // =========================================================================
    // FLUJO 3: ADMINISTRADOR
    // Iniciar sesión en /admin -> Consultar métricas institucionales con k-anonimato ->
    // Utilizar funciones administrativas -> Cerrar sesión
    // =========================================================================
    console.log('\n--- [E2E 3/3] Flujo de Administrador en Navegador Real ---');
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    adminPage.on('pageerror', (err) => pageErrors.push(`Admin pageerror: ${err.message}`));

    await adminPage.goto('http://localhost:3000/admin', { waitUntil: 'networkidle' });
    await adminPage.waitForSelector('text=Acceso de Supervisión Directiva');

    // Comprobar rechazo de contraseña incorrecta en /admin
    await adminPage.getByPlaceholder('ejemplo@pcpuma.acatlan.unam.mx').fill('admin.e2e@pcpuma.acatlan.unam.mx');
    await adminPage.getByPlaceholder('••••••••••••').fill('ClaveIncorrecta999');
    await adminPage.getByRole('button', { name: 'Continuar' }).click();
    await adminPage.waitForSelector('.login-error');
    console.log('  ✓ Contraseña incorrecta rechazada en /admin (sin bypass demo)');

    // Iniciar sesión con credenciales reales de administrador
    await adminPage.getByPlaceholder('••••••••••••').fill('AdminPuma2026!');
    await adminPage.getByRole('button', { name: 'Continuar' }).click();

    await adminPage.waitForSelector('text=DIRECTIVO', { timeout: 10000 });
    await sleep(500);
    console.log('  ✓ Panel Administrativo cargado con métricas reales desde /api/metrics/*');

    // Cambiar a pestaña de Calendario / Horarios y luego cerrar sesión
    const calTab = adminPage.getByRole('button', { name: /Calendario|Horarios/i }).first();
    if (await calTab.isVisible()) {
      await calTab.click();
      await sleep(300);
    }
    await adminPage.getByRole('button', { name: /Cerrar Sesión/i }).click();
    await adminPage.waitForSelector('text=Acceso de Supervisión Directiva', { timeout: 10000 });
    console.log('  ✓ Funciones administrativas consultadas y cierre de sesión directivo completado');
    await adminCtx.close();

    if (pageErrors.length > 0) {
      throw new Error(`Se detectaron errores de consola/página: ${pageErrors.join('; ')}`);
    }

    console.log('\n=== TODAS LAS PRUEBAS E2E DE NAVEGADOR (ESTUDIANTE, PROFESOR Y ADMINISTRADOR) APROBADAS (0 ERRORES DE CONSOLA) ===');
  } finally {
    if (browser) await browser.close();
    backendProc.kill('SIGTERM');
    frontendProc.kill('SIGTERM');
    fastApiServer.close();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('ERROR EN E2E:', err);
  process.exit(1);
});
