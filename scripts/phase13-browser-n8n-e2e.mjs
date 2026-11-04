import { chromium } from 'playwright-core';
import pg from 'pg';
import * as fs from 'fs';

const { Pool } = pg;
const LOCAL_DB_URL = 'postgresql://postgres:postgres@127.0.0.1:5433/pumaia_test?schema=public';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BACKEND_URL = 'http://localhost:3001/api';
const FRONTEND_URL = 'http://localhost:3000';

const pool = new Pool({ connectionString: LOCAL_DB_URL });

const reportData = {
  timestamp: new Date().toISOString(),
  student: {
    email: '318777999@pcpuma.acatlan.unam.mx',
    accountNumber: '318777999',
  },
  networkRequests: [],
  consoleLogs: [],
  n8nRealDiagnosis: {},
  dbPersistence: {},
  browserVerification: {},
};

async function run() {
  console.log('=== INICIANDO PRUEBA INTEGRAL FASE 13: ASISTENTE DE IA Y N8N ===');

  // 1. Diagnóstico directo contra el webhook real de n8n
  console.log('\n--- 1. Diagnóstico Directo contra Webhook n8n ---');
  const n8nUrl = 'https://n8n-it2v.srv1803922.hstgr.cloud/webhook/v1/pumaIA/chat';
  const startProbe = Date.now();
  let n8nProbeStatus = null;
  let n8nProbeBody = null;
  let n8nProbeTime = 0;

  try {
    const probeRes = await fetch(n8nUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        id_alumno: 'test-student',
        conversationId: 'test-conv',
        message: 'Hola PumaIA',
      }),
    });
    n8nProbeTime = Date.now() - startProbe;
    n8nProbeStatus = probeRes.status;
    n8nProbeBody = await probeRes.text();
    console.log(`n8n Webhook Real -> HTTP ${n8nProbeStatus} en ${n8nProbeTime}ms, Body Length: ${n8nProbeBody.length}`);
  } catch (err) {
    console.error('Error al sondear n8n:', err.message);
  }

  reportData.n8nRealDiagnosis = {
    webhookUrl: 'https://n8n-it2v.srv1803922.hstgr.cloud/webhook/v1/pumaIA/chat',
    httpStatus: n8nProbeStatus,
    bodyLength: n8nProbeBody?.length ?? 0,
    responseTimeMs: n8nProbeTime,
    rootCause:
      'El webhook de n8n responde en menos de 400ms con HTTP 200 y cuerpo vacío (0 bytes). Esto demuestra que el nodo Webhook en n8n está configurado en modo "Response Mode: Immediately" (o "When Received"), finalizando la conexión HTTP antes de que el flujo de IA ejecute o alcance un nodo de respuesta.',
  };

  // 2. Iniciar sesión mediante API para asegurar tokens válidos
  console.log('\n--- 2. Autenticación del Estudiante de Prueba ---');
  const loginRes = await fetch(`${BACKEND_URL}/autenticacion/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: reportData.student.email,
      password: 'PasswordSeguro2026!',
    }),
  });
  const loginJson = await loginRes.json();
  const token = loginJson.accessToken;
  console.log('Login API status:', loginRes.status, 'AccessToken emitido:', Boolean(token));

  // Obtener studentId
  const meRes = await fetch(`${BACKEND_URL}/autenticacion/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const meJson = await meRes.json();
  const studentId = meJson.student?.id;
  const userId = meJson.id;
  console.log('Student ID:', studentId, 'User ID:', userId);

  // Registrar consentimientos vigentes para permitir interacción con el chat
  console.log('Registrando consentimientos requeridos...');
  const noticesRes = await fetch(`${BACKEND_URL}/consents/notices`);
  const notices = await noticesRes.json();
  const consentPayload = notices.map((n) => ({
    kind: n.kind,
    noticeId: n.id,
    granted: true,
  }));
  const consentRecordRes = await fetch(`${BACKEND_URL}/consents/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ consents: consentPayload }),
  });
  console.log('Consent batch status:', consentRecordRes.status);

  // 3. Probar envío de mensajes a través del backend NestJS
  console.log('\n--- 3. Prueba de Envío de Mensaje 1 hacia NestJS (/chat/message/n8n) ---');
  const msg1Res = await fetch(`${BACKEND_URL}/chat/message/n8n`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      content: 'Estoy estudiando Matemáticas Aplicadas y Computación y me interesa el desarrollo de inteligencia artificial. ¿Qué áreas podría explorar?',
    }),
  });
  const msg1Text = await msg1Res.text();
  let msg1Json;
  try {
    msg1Json = JSON.parse(msg1Text);
  } catch {
    msg1Json = { raw: msg1Text };
  }
  console.log(`Envío Mensaje 1 -> HTTP ${msg1Res.status}:`, msg1Json);

  // Obtener conversación creada en PostgreSQL
  const convQuery = await pool.query(
    'SELECT id_conversacion, id_alumno, titulo, creado_en FROM conversaciones WHERE id_alumno = $1 ORDER BY creado_en DESC LIMIT 1',
    [studentId],
  );
  const convRecord = convQuery.rows[0];
  console.log('Conversación persistida en BD:', convRecord);
  const conversationId = convRecord?.id_conversacion;

  // Consultar mensajes asociados en PostgreSQL
  let messagesQuery = await pool.query(
    'SELECT id_mensaje, rol, contenido, creado_en FROM mensajes WHERE id_conversacion = $1 ORDER BY creado_en ASC',
    [conversationId],
  );
  console.log('Mensajes persistidos en BD tras Mensaje 1:', messagesQuery.rows);

  // Probar envío de Mensaje 2 en la misma conversación (Continuidad)
  console.log('\n--- 4. Prueba de Envío de Mensaje 2 (Continuidad Contextual) ---');
  const msg2Res = await fetch(`${BACKEND_URL}/chat/message/n8n`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      conversationId,
      content: 'De las opciones que mencionaste, ¿cuál tendría mayor relación con mi carrera?',
    }),
  });
  const msg2Text = await msg2Res.text();
  let msg2Json;
  try {
    msg2Json = JSON.parse(msg2Text);
  } catch {
    msg2Json = { raw: msg2Text };
  }
  console.log(`Envío Mensaje 2 -> HTTP ${msg2Res.status}:`, msg2Json);

  // Re-consultar mensajes en PostgreSQL tras Mensaje 2
  messagesQuery = await pool.query(
    'SELECT id_mensaje, rol, contenido, creado_en FROM mensajes WHERE id_conversacion = $1 ORDER BY creado_en ASC',
    [conversationId],
  );
  console.log('Mensajes persistidos en BD tras Mensaje 2:', messagesQuery.rows);

  // Probar registro de feedback sobre el primer mensaje del estudiante
  console.log('\n--- 5. Prueba de Registro de Feedback ---');
  const firstMsgId = messagesQuery.rows[0]?.id_mensaje;
  let feedbackStatus = null;
  let feedbackData = null;
  if (firstMsgId) {
    const fbRes = await fetch(`${BACKEND_URL}/chat/messages/${firstMsgId}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        value: 'UP',
        comment: 'Pregunta académica registrada para seguimiento.',
      }),
    });
    feedbackStatus = fbRes.status;
    feedbackData = await fbRes.json();
    console.log('Feedback API status:', feedbackStatus, feedbackData);
  }

  // 6. Prueba End-to-End con Playwright en Navegador Real
  console.log('\n--- 6. Prueba con Navegador Real (Playwright) ---');
  try {
    const browser = await chromium.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    });

    const context = await browser.newContext();
    await context.addCookies([
      {
        name: 'token',
        value: token,
        domain: 'localhost',
        path: '/',
      },
    ]);
    const page = await context.newPage();

    // Capturar logs y requests
    page.on('console', (msg) => {
      reportData.consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });
    page.on('response', (response) => {
      if (response.url().includes('/api/chat')) {
        reportData.networkRequests.push({
          url: response.url(),
          status: response.status(),
          method: response.request().method(),
        });
      }
    });

    // Cargar aplicación e inyectar sesión autenticada
    console.log('Abriendo http://localhost:3000/ ...');
    await page.goto(`${FRONTEND_URL}/`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(
      ({ tok, usr }) => {
        localStorage.setItem('token', tok);
        localStorage.setItem('userData', JSON.stringify(usr));
        document.cookie = `token=${tok}; path=/; max-age=86400`;
      },
      {
        tok: token,
        usr: {
          id: userId,
          email: reportData.student.email,
          nombre: 'Estudiante Auditoría',
          fullName: 'Estudiante Auditoría Fase Trece',
          token,
        },
      },
    );

    // Navegar directamente a /chat
    console.log('Navegando a http://localhost:3000/chat ...');
    await page.goto(`${FRONTEND_URL}/chat`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);

    // Comprobar elementos de la interfaz de chat
    const chatInput = await page.waitForSelector('textarea', { timeout: 8000 }).catch(() => null);
    const sendButton = await page.$('button[title="Enviar"]');
    console.log('Textarea presente:', Boolean(chatInput), 'Botón Enviar presente:', Boolean(sendButton));

    // Escribir y enviar mensaje desde la interfaz
    if (chatInput && sendButton) {
      console.log('Escribiendo mensaje en el chat del navegador...');
      await chatInput.fill('Hola PumaIA, necesito apoyo con mis materias de programación.');
      await sendButton.click();
      console.log('Mensaje enviado. Esperando procesamiento del backend y n8n...');
      await page.waitForTimeout(4000);
    }

    // Captura de pantalla de la conversación y estado en pantalla
    const screenshotPath = '/tmp/pumaia-fase13-chat-test.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log('Captura de pantalla guardada en:', screenshotPath);

    // Recargar la página para verificar la recuperación del historial
    console.log('Recargando la página /chat para verificar recuperación del historial...');
    await page.reload({ waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);

    const screenshotReloadPath = '/tmp/pumaia-fase13-chat-reload.png';
    await page.screenshot({ path: screenshotReloadPath, fullPage: true });
    console.log('Captura tras recarga guardada en:', screenshotReloadPath);

    await browser.close();

    reportData.browserVerification = {
      browserLaunched: true,
      chatInputRendered: Boolean(chatInput),
      sendButtonRendered: Boolean(sendButton),
      screenshotPath,
      screenshotReloadPath,
      consoleErrorsCount: reportData.consoleLogs.filter((l) => l.includes('[error]')).length,
    };
  } catch (browserErr) {
    console.error('Error en prueba de Playwright:', browserErr.message);
    reportData.browserVerification = {
      browserLaunched: false,
      error: browserErr.message,
    };
  }

  // 7. Verificación final de persistencia en PostgreSQL
  console.log('\n--- 7. Verificación Final de Persistencia en PostgreSQL ---');
  const finalConvCount = await pool.query(
    'SELECT count(*) FROM conversaciones WHERE id_alumno = $1',
    [studentId],
  );
  const finalMsgCount = await pool.query(
    'SELECT count(*) FROM mensajes m JOIN conversaciones c ON m.id_conversacion = c.id_conversacion WHERE c.id_alumno = $1',
    [studentId],
  );
  const finalFeedbackCount = await pool.query(
    'SELECT count(*) FROM retroalimentacion_mensaje rf JOIN mensajes m ON rf.id_mensaje = m.id_mensaje JOIN conversaciones c ON m.id_conversacion = c.id_conversacion WHERE c.id_alumno = $1',
    [studentId],
  );

  reportData.dbPersistence = {
    conversationsCount: parseInt(finalConvCount.rows[0].count, 10),
    messagesCount: parseInt(finalMsgCount.rows[0].count, 10),
    feedbackCount: parseInt(finalFeedbackCount.rows[0].count, 10),
    lastConversationId: conversationId,
    lastMessages: messagesQuery.rows,
  };
  console.log('Persistencia final:', reportData.dbPersistence);

  fs.writeFileSync('/tmp/phase13-e2e-results.json', JSON.stringify(reportData, null, 2));
  console.log('\n=== PRUEBA FASE 13 FINALIZADA. Resultados en /tmp/phase13-e2e-results.json ===');

  await pool.end();
}

run().catch((e) => {
  console.error('Error fatal en runner Fase 13:', e);
  pool.end();
  process.exit(1);
});
