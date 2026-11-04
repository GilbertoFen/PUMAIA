# Documentación de Migración y Estado Actual de PUMAIA

**Fecha de corte:** Noviembre 2026  
**Rama de trabajo:** `migracion_v2`  
**Objetivo del documento:** Exponer de forma técnica, estructurada y verificable todas las modificaciones realizadas en el proyecto PUMAIA, su arquitectura, el estado de persistencia de datos (local vs. remoto), las pruebas ejecutadas, las funcionalidades activas y el trabajo pendiente.

---

## 1. Introducción

El proyecto **PUMAIA** (anteriormente identificado en repositorios y configuración como *trayectoriaprofesional* o *pumaAPI*) es una plataforma integral orientada a la comunidad de la **Facultad de Estudios Superiores Acatlán (UNAM)**. Su propósito central es brindar a los estudiantes acompañamiento académico, análisis de trayectoria profesional mediante inteligencia artificial, orientación vocacional y seguimiento curricular, así como dotar a directivos y docentes de herramientas para la supervisión y gestión académica.

El proceso de migración hacia la versión actual (`migracion_v2`) tuvo como objetivos primordiales:
1. **Normalización e Integridad de Base de Datos:** Superar un esquema monolítico plano centrado exclusivamente en el estudiante para adoptar un modelo institucional relacional (3NF), multi-rol y con integridad referencial estricta.
2. **Seguridad y Control de Acceso (RBAC):** Separar identidades (`User`), roles (`RoleType`: `STUDENT`, `PROFESSOR`, `INSTITUTION_ADMIN`, `ANALYST`) y sesiones multi-dispositivo con detección de reúso de *refresh tokens*.
3. **Privacidad Institucional y K-Anonimato:** Proteger datos personales de salud mental en el asistente de IA y garantizar que las analíticas directivas cumplan con un umbral estricto de k-anonimato ($k \ge 10$) para evitar la re-identificación de estudiantes.
4. **Desacoplamiento Operativo:** Facilitar el desarrollo y pruebas locales independientes mediante contenedores PostgreSQL con soporte para extensiones vectoriales (`pgvector`), manteniendo la capacidad de conectar al entorno gestionado en **Supabase**.

---

## 2. Arquitectura Anterior y Arquitectura Actual

### 2.1 Comparativa Tecnológica y de Infraestructura

| Dimensión | Arquitectura Anterior (`migracion_v1` / `deploy`) | Arquitectura Actual (`migracion_v2`) |
|---|---|---|
| **Framework Backend** | NestJS 11 (TypeScript) | NestJS 11 (TypeScript) modularizado con validación global anticipada y rate limiting |
| **ORM y Acceso a Datos** | Prisma 7 (`@prisma/client`, `@prisma/adapter-pg`) | Prisma 7 (`@prisma/client`, `@prisma/adapter-pg`) con resolución dinámica de destino (`local_test` vs. `Supabase`) |
| **Base de Datos** | PostgreSQL único en Supabase | Arquitectura dual: PostgreSQL 16 con `pgvector` en local (puerto 5433) y Supabase remoto (pooler transaccional en 6543 / directo en 5432) |
| **Identidad y Usuarios** | Tabla `alumno` monolítica; contenía contraseña bcrypt, correo, avatar y expediente | Entidad desacoplada `usuario` (`User`), con relación 1:N hacia `rol_usuario` (`UserRole`) y extensiones 1:1 (`Student`, `Professor`, `PersonalProfile`) |
| **Autenticación** | Login único con JWT de larga duración guardado en cliente | Autenticación híbrida: Google OAuth institucional (`@pcpuma.acatlan.unam.mx`) + Login tradicional verificado (Argon2id/bcrypt), Access Tokens (15 min) y cookies seguras `httpOnly` para Refresh Tokens (7 días) con rotación |
| **Autorización** | `AuthGuard('jwt')` genérico sin discriminación de roles | Guards compuestos (`JwtAuthGuard`, `RolesGuard`), decoradores (`@Roles`, `@CurrentUser`) y control de acceso basado en roles (RBAC) |
| **IA y Orquestación** | Llamadas directas y síncronas a un microservicio FastAPI en Render (`server-genai.onrender.com`) | Pasarela conversacional hacia webhook de **n8n** con soporte de RAG (`pgvector`), manteniendo fallback hacia FastAPI y captura de feedback (`UP`/`DOWN`) |
| **Frontend** | Next.js en proyecto independiente con rutas administrativas y docentes soportadas por bypasses mock | Next.js integrado con middleware de protección de rutas por rol, formularios reactivos reales, consumo de cookies de sesión y eliminación de mocks en autenticación |
| **Auditoría y Consentimientos** | Inexistente; sin control de versiones de avisos legales | Módulos transversales `ConsentsModule` (inmutable, *append-only*) y `AuditModule` (sanitización de credenciales y trazabilidad) |

### 2.2 Diagrama Arquitectónico Actual

```
                        ┌──────────────────────────────────────────────┐
                        │             Frontend (Next.js)              │
                        │   Portal Estudiante / Profesor / Directivo   │
                        └──────────────────────┬───────────────────────┘
                                               │
                                               │ HTTP /api/* (Cookies httpOnly + Bearer)
                                               ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 Backend (NestJS 11)                                    │
│                                                                                        │
│  [Global Pipes & Security] ValidationPipe (whitelist) · CORS Restringido · Helmet      │
│  [Guards & RBAC]           JwtAuthGuard · RolesGuard (@Roles) · CurrentUser Decorator  │
│                                                                                        │
│  ┌───────────────────────┬─────────────────────────┬────────────────────────────────┐  │
│  │     Transversales     │        Académicos       │       Inteligencia Artificial  │  │
│  │ · AutenticacionModule │ · StudentsModule        │ · ChatModule (n8n Webhook/RAG) │  │
│  │ · ConsentsModule      │ · GradeModule           │ · AIResultModule (5 rutas)     │  │
│  │ · AuditModule         │ · SectionsModule        │ · AICategoryModule             │  │
│  │ · HealthModule        │ · AttendanceModule (QR) │ · KnowledgeDocumentsModule     │  │
│  │ · PersonalProfile     │ · ProfessorsModule      │ · PsychologicalSummaries       │  │
│  │ · NotificationsModule │ · MetricsModule (Vistas)│                                │  │
│  └───────────────────────┴─────────────────────────┴────────────────────────────────┘  │
│                                           │                                            │
│                                  Prisma 7 (pg adapter)                                 │
└─────────────────────┬─────────────────────┼─────────────────────┬──────────────────────┘
                      │                     │                     │
                      ▼                     ▼                     ▼
          ┌───────────────────────┐ ┌───────────────┐ ┌───────────────────────────┐
          │  PostgreSQL Local     │ │   Supabase    │ │ Servicios Externos        │
          │  (puerto 5433 - test) │ │    Remoto     │ │ · n8n Webhook (Cloud)     │
          │  · 61 modelos         │ │  · 67 tablas  │ │ · FastAPI GenAI (Render)  │
          │  · 7 vistas SQL       │ │  · Catálogos  │ │ · Cloudinary (Avatares)   │
          │  · Datos de prueba    │ │    instituc.  │ │ · Google OAuth 2.0        │
          └───────────────────────┘ └───────────────┘ └───────────────────────────┘
```

---

## 3. Cambios Realizados Durante la Migración

### 3.1 Estructura y Organización del Proyecto
- **Configuración de arranque:** `src/main.ts` se modificó para registrar `ValidationPipe({ whitelist: true, transform: true })` **antes** del inicio del servidor (`app.listen`), corrigiendo la vulnerabilidad anterior donde las peticiones iniciales podían entrar sin validar DTOs.
- **Políticas CORS:** Se reemplazó la política insegura `origin: '*'` por validación de orígenes permitidos (`ALLOWED_ORIGINS` o `http://localhost:3000`), con habilitación estricta de credenciales (`credentials: true`) requerida por las cookies de refresco.
- **Modularización:** El archivo `src/app.module.ts` creció de 18 módulos a 33 módulos organizados en bloques temáticos (Transversales, Académicos, Actividades, IA/Cuestionarios, Gestión Docente, Analítica y Salud).

### 3.2 Modelos y Esquema de Base de Datos (Prisma)
- **Normalización del Usuario:** Se extrajeron los campos de autenticación de `Student` hacia `User`. `User` almacena nombre, apellidos, correo institucional único, estado, contraseña cifrada, intentos fallidos y tokens de verificación.
- **Sesiones Multi-dispositivo (`AuthSession`):** Nueva tabla `sesion_autenticacion` que asocia sesiones a un usuario, guarda hash del refresh token, `familyId`, agente de usuario, dirección IP, fecha de expiración y estado de revocación.
- **Expediente Académico (`Enrollment`):** Se reemplazó el modelo `Grades` por `Enrollment` (`inscripcion`), que enlaza un alumno, una asignatura (`Subject`) y un periodo académico (`AcademicPeriod`), con estados de aprobación (`PASSED`, `FAILED`, `IN_PROGRESS`, `WITHDRAWN`, `NOT_PRESENTED`).
- **Cuestionario Normalizado:** Se migró del esquema no estructurado `QuestionnaireAnswer` (que almacenaba respuestas en JSON plano dentro de una sola tabla) a una estructura jerárquica: `Questionnaire` $\rightarrow$ `Question` $\rightarrow$ `QuestionOption` $\rightarrow$ `Response` $\rightarrow$ `Answer`.
- **Resultados de IA (`AIResultOption`):** Anteriormente, las opciones de trayectoria profesional se empaquetaban como cadenas de texto separadas por `||` dentro de `descriptionA`. Se creó la tabla `opcion_resultado_ia` con campos tipados (`position`, `title`, `description`).
- **Nuevos Dominios Académicos:** Se integraron modelos para la gestión de grupos (`CourseSection`), horarios (`SectionMeeting`), listas de asistencia (`SectionRoster`), sesiones de clase (`ClassSession`), registros de asistencia (`AttendanceRecord`) y documentos para RAG (`KnowledgeDocument`).

### 3.3 Conexión y Resolución Dinámica de Base de Datos
- **Mecanismo Dual:** Se adaptaron `prisma.config.ts` y `src/prisma/prisma.service.ts` para leer la variable `PUMAIA_DB_TARGET`.
  - Cuando es `local_test`, utiliza `TEST_DIRECT_URL` (puerto local 5433).
  - En cualquier otro caso, conecta a Supabase mediante `DIRECT_URL` o `DATABASE_URL`.
- **Inspección de Conexión:** `PrismaService` implementa `describeDatabaseTarget()`, extrayendo en el arranque el host, puerto, base de datos, esquema y tipo de conexión (Pooler de sesión, Pooler transaccional, Directo o Local) para certificar en bitácora a qué servidor se están enviando las consultas.

### 3.4 Autenticación, Sesiones y Seguridad
- **Políticas de Correo Estrictas:** Se implementó `isValidStudentInstitutionalEmail()`, validando que los alumnos utilicen exclusivamente correos con terminación exacta `@pcpuma.acatlan.unam.mx`.
- **Protección contra Fuerza Bruta:** Se añadieron columnas `intentos_fallidos` y `bloqueado_hasta` en `User`. Tras 5 intentos erróneos, la cuenta queda temporalmente bloqueada por 15 minutos.
- **Flujo de Verificación y Recuperación:** Registro con generación de token de verificación criptográfico (SHA-256), envío simulado o real por correo, confirmación vía endpoint `POST /api/autenticacion/verify-email`, y recuperación de contraseña vía `forgot-password` y `reset-password`.
- **Rotación de Refresh Tokens:** Cada invocación a `POST /api/autenticacion/refresh` invalida el token previo y genera uno nuevo. Si un token revocado vuelve a presentarse (indicador de ataque de repetición o robo de credenciales), se revoca inmediatamente toda la familia de sesiones (`familyId`).

### 3.5 Consentimientos y Privacidad
- **Cumplimiento Legal (LGPDPPSO):** El módulo `ConsentsModule` exige que el estudiante otorgue consentimientos de manera explícita antes de operar módulos sensibles.
- **Tipos de Consentimiento:**
  - `TERMS_AND_NOTICE`: Aceptación de términos y aviso de privacidad general (obligatorio).
  - `ANALYTICS`: Consentimiento para métricas agregadas anonimizadas.
  - `IMPROVEMENT`: Consentimiento para fines de optimización del servicio.
  - `PSYCHOLOGICAL_DATA`: Consentimiento para tratamiento de datos sensibles en el chat.
- **Guard en Chat:** `ChatService` consulta el estado de consentimientos del alumno antes de admitir cualquier mensaje. Si no existe consentimiento vigente, rechaza la operación con código HTTP 403 (`ForbiddenException`).

### 3.6 Chat e Integración con IA
- **Detección de Contenido Sensible:** Se introdujo un motor de expresiones regulares en `ChatService` que analiza en tiempo real frases asociadas a crisis, autolesión, depresión o violencia. Al detectarlas, marca la conversación como `sensitive = true` y bloquea la inclusión de fragmentos sensibles en resúmenes psicológicos sin consentimiento explícito.
- **Gateway n8n / FastAPI:**
  - Se habilitó la ruta `POST /api/chat/message/n8n`, la cual envía el historial conversacional y contexto al webhook de n8n.
  - Se mantiene la compatibilidad con el endpoint previo `POST /api/chat/message` apuntando a FastAPI.
- **Retroalimentación y Resúmenes:**
  - `POST /api/chat/messages/:id/feedback`: Calificación de respuestas (`UP` / `DOWN`) con comentario opcional.
  - Gestión de resúmenes psicológicos en estado `DRAFT`, `APPROVED` y `REVOKED`, bajo control exclusivo del estudiante.

### 3.7 Vistas SQL y Analítica Institucional
- Se crearon y adaptaron 7 vistas SQL institucionales en `prisma/views_adapted/`:
  1. `01_perfil_alumno_v3.sql`: Consolidación del perfil académico y personal.
  2. `02_vista_metricas_rendimiento.sql`: Aprobación, reprobación y promedios por asignatura.
  3. `03_vista_metricas_rezago.sql`: Identificación de materias críticas de alto índice de reprobación.
  4. `04_vista_metricas_asistencia.sql`: Asistencia agregada por asignatura y periodo.
  5. `05_vista_metricas_temas_chat.sql`: Distribución temática de consultas al asistente.
  6. `06_vista_metricas_satisfaccion.sql`: Nivel de satisfacción según encuestas.
  7. `07_vista_metricas_trayectoria_ia.sql`: Resultados de orientación profesional generados.
- **Regla Estricta de K-Anonimato:** Todas las vistas agregadas exigen `COUNT(DISTINCT id_alumno) >= 10`. Si la muestra tiene menos de 10 estudiantes únicos, los valores numéricos se ocultan y devuelven `<10` o `RESTRINGIDO`.

---

## 4. Base de Datos y Migración a Supabase

### 4.1 Historial de Migraciones SQL Ejecutadas

| Migración | Ubicación | Descripción y Estado |
|---|---|---|
| `20260504003154_init` | `prisma/migrations/` | Esquema base inicial heredado. Aplicada en local y en Supabase. |
| `20261020030659_materia_profesores` | `prisma/migrations/` | Adición de profesores y relación con materias. Aplicada en ambos entornos. |
| `20261103003124_posible_cagada_v1` | `prisma/migrations/` | Normalización masiva: `User`, `UserRole`, `Institution`, `AcademicPeriod`, `Enrollment`, `Sections`, `Attendance`, `Consents`. Aplicada en ambos entornos. *(Nota: nombre informal registrado en la rama original)*. |
| `20261103005109` | `prisma/migrations/` | Ajustes de integridad en llaves foráneas. Aplicada en ambos entornos. |
| `20261103021100_otra_migracion` | `prisma/migrations/` | Corrección de índices en tablas de cuestionario. Aplicada en ambos entornos. |
| `20261103022110_otro_error` | `prisma/migrations/` | Ajustes de tipos en columnas académicas. Aplicada en ambos entornos. |
| `20261103160000_auth_traditional_and_sessions` | `prisma/migrations/` | Añade campos de autenticación tradicional en `usuario` y crea la tabla `sesion_autenticacion`. **Aplicada en base de datos local; pendiente de aplicación formal en Supabase.** |

### 4.2 Comparativa de Datos: Base Local vs. Supabase Remoto

La evidencia física obtenida del respaldo `backups/supabase_pre_fase10_snapshot.json` y del estado actual de la base local arroja la siguiente distribución real de información:

| Entidad / Catálogo | Estado en Supabase Remoto | Estado en PostgreSQL Local (`pumaia_test`) | Clasificación |
|---|---|---|---|
| `institucion` | 1 registro (FES Acatlán, código `240`) | 1 registro | Dato Institucional Real |
| `carrera` | 1 registro (MAC, clave `121`) | 1 registro | Dato Institucional Real |
| `plan_estudios` | 1 registro (Plan MAC 2016, 8 semestres, 380 créditos) | 1 registro | Dato Institucional Real |
| `periodo_academico` | 1 registro (`2026-1`) | 1 registro | Dato Institucional Real |
| `area_conocimiento` | 4 registros (Áreas UNAM) | 4 registros | Catálogo Institucional Real |
| `categoria` | 10 registros (Categorías curriculares) | 10 registros | Catálogo Institucional Real |
| `materia` | 69 asignaturas del plan de estudios de MAC | 69 asignaturas | Catálogo Institucional Real |
| `materia_seriacion` | 53 relaciones de prerrequisito curricular | 53 relaciones | Catálogo Institucional Real |
| `tema` | 27 temas de asignaturas | 27 temas | Catálogo Institucional Real |
| `usuario` / `alumno` | 0 registros (tabla vacía) | Múltiples usuarios de prueba sembrados | Datos de Prueba |
| `rol_usuario` | 0 registros | Roles asignados para pruebas RBAC | Datos de Prueba |
| `sesion_autenticacion` | Tabla no creada aún en Supabase | Creada y con registros de sesión activos | Pendiente en Supabase |
| `aviso_privacidad` | 0 registros | 3 avisos sembrados (`TERMS_AND_NOTICE`, etc.) | Pendiente en Supabase |
| `consentimiento` | 0 registros | Registros de aceptación en pruebas | Datos de Prueba |
| `cuestionario`, `pregunta`, `opcion_pregunta` | 0 registros | Cuestionario ONBOARDING sembrado | Pendiente en Supabase |
| `categoria_ia` | 0 registros | Sembrado en pruebas | Pendiente en Supabase |
| `grupo` (`CourseSection`), `sesion_clase` | 0 registros | Grupos de prueba sembrados (ej. Grupo 2501) | Datos de Prueba |
| `inscripcion` (`Enrollment`) | 0 registros | Registros con calificaciones numéricas | Datos de Prueba |
| `conversaciones`, `mensajes` | 0 registros | Conversaciones de prueba registradas | Datos de Prueba |

> **IMPORTANTE:** El catálogo académico de la carrera de MAC (materias, créditos, áreas y seriación) ya se encuentra completo y validado en Supabase. Sin embargo, Supabase no contiene cuentas de usuario, avisos de privacidad, cuestionarios ni categorías de IA. Antes de apuntar el backend de producción a Supabase, se debe ejecutar un script de *seed* que traslade estos catálogos base.

---

## 5. Cambios en el Backend (NestJS)

El backend expone operaciones a través de 33 controladores. A continuación se resumen los módulos más relevantes y sus cambios técnicos:

### 5.1 Módulos Transversales y de Seguridad
- **`AutenticacionModule` (`src/autenticacion/`):**
  - Controladores y servicios ampliados significativamente (más de 2,000 líneas incorporadas).
  - Endpoints principales: `POST /register`, `POST /verify-email`, `POST /resend-verification`, `POST /login`, `POST /forgot-password`, `POST /reset-password`, `POST /invite-staff`, `POST /google`, `POST /dev-login`, `POST /refresh`, `POST /logout`, `GET /me`.
  - Inclusión de `JwtAuthGuard` y `RolesGuard` verificando roles en base de datos.
- **`ConsentsModule` (`src/consents/`):**
  - Gestión inmutable de consentimientos: `GET /notices`, `GET /status`, `GET /history`, `POST /`, `POST /batch`.
- **`AuditModule` (`src/audit/`):**
  - Bitácora inmutable en `bitacora_auditoria` con método `log()` que purga llaves con nombres sensibles (`password`, `token`, `secret`, `hash`) antes de persistir.
- **`HealthModule` (`src/health/`):**
  - Endpoint `GET /health` que ejecuta `SELECT 1` y retorna latencia, tipo de conexión, host, puerto, base de datos y estado de seguridad.

### 5.2 Módulos Académicos y de Alumnos
- **`StudentsModule` (`src/students/`):**
  - `GET /students`: Restringido exclusivamente al rol `INSTITUTION_ADMIN`.
  - `GET /students/profile-summary`: Retorna el expediente consolidado del estudiante autenticado.
  - `POST /students/avatar`: Subida de imágenes hacia Cloudinary con verificación de tipo MIME.
- **`GradeModule` (`src/grades/`):**
  - Migración a `Enrollment`. Introduce cálculo transaccional atómico en `recalculateStudentAverage()`.
  - `POST /grade/confirm-import`: Permite la importación por lotes de materias cursadas.
- **`SectionsModule` (`src/sections/`) y `AttendanceModule` (`src/attendance/`):**
  - Apertura de sesiones de clase (`POST /attendance/sessions`).
  - Generación de token temporal firmado para códigos QR dinámicos (`GET /attendance/sessions/:id/qr-token`).
  - Registro de asistencia del alumno con validación de expiración (`POST /attendance/record`).
- **`ProfessorsModule` (`src/professors/`):**
  - Mantenimiento del cuerpo docente, áreas de especialidad, estudios académicos y publicaciones.

### 5.3 Módulos de IA, Analítica y Cuestionarios
- **`ChatModule` (`src/chat/`):**
  - Historial conversacional, detección de patrones sensibles, integración con n8n (`POST /chat/message/n8n`), retroalimentación (`POST /chat/messages/:id/feedback`) y gestión de resúmenes psicológicos.
- **`QuestionnaireModule` (`src/questionnaire/`):**
  - Administración jerárquica de cuestionarios, preguntas y opciones. Adaptadores de compatibilidad para endpoints históricos (`POST /questionnaire/save`, `GET /questionnaire/my-responses`).
- **`MetricsModule` (`src/metrics/`):**
  - Consumo directo de las vistas SQL institucionales: `academic-performance`, `retention-risk`, `attendance`, `chat-topics`, `satisfaction`. Restringido a administradores y analistas.

---

## 6. Cambios en el Frontend (Next.js)

El frontend reside en un repositorio/proyecto Next.js desacoplado (`puma-react`). Durante el proceso de migración, se llevaron a cabo adaptaciones clave para integrarlo con la nueva arquitectura del backend:

### 6.1 Integración y Manejo de Sesiones
- **Eliminación de Bypasses:** Se retiraron credenciales fijas y accesos simulados en `/admin` y `/profesor`. El acceso ahora exige autenticación formal contra el backend NestJS.
- **Manejo de Tokens en Cookies:** El frontend fue adaptado para omitir el almacenamiento de *refresh tokens* en `localStorage`, consumiendo en su lugar la cookie `httpOnly` gestionada por el navegador.
- **Middleware de Rutas:** Se implementó protección a nivel de middleware en Next.js. Las rutas no autenticadas en `/admin` o `/profesor` redirigen con HTTP 307 hacia la página principal.

### 6.2 Flujos de Usuario Conectados y Probados
1. **Flujo del Estudiante:**
   - Registro con correo `@pcpuma.acatlan.unam.mx`.
   - Diálogo modal obligatorio del Aviso de Privacidad con desplazamiento requerido antes de habilitar aceptación.
   - Envío de enlace de verificación y activación de cuenta.
   - Inicio de sesión con credenciales tradicionales.
   - Sincronización automática de consentimientos iniciales en backend.
   - Interacción en la interfaz de chat (`/chat`).
   - Cierre de sesión desde `/settings` y recuperación de contraseña.
2. **Flujo del Docente (`/profesor`):**
   - Recepción de invitación por correo, configuración de contraseña vía enlace.
   - Acceso al portal docente con visualización de asignaturas asignadas (ej. *Ingeniería de Software I · Grupo 2501*).
   - Modal para proyección de código QR dinámico de asistencia.
   - Consulta de listas de alumnos matriculados.
3. **Flujo Administrativo (`/admin`):**
   - Acceso directivo restringido por credenciales reales.
   - Visualización de indicadores y métricas de rendimiento con k-anonimato.

### 6.3 Módulos con Datos Simulados (Mocks)
- **Comunidad / Intercambio (`/exchange`):** La vista existe en el frontend pero continúa operando al 100% con datos simulados locales (`mockExchangeData.ts`). No existen tablas ni endpoints correspondientes en el backend.

---

## 7. Integraciones Externas

| Servicio / Integración | Estado Real | Detalle de Operatividad y Diagnóstico |
|---|---|---|
| **Supabase (PostgreSQL)** | PARCIAL | Conexión directa y por pooler configuradas y probadas. Catálogos base cargados. Migración final de autenticación y seed institucional pendientes. |
| **n8n Webhook (Cloud)** | PROBADO CON ERROR CONTROLADO | URL real probada: `https://n8n-it2v.srv1803922.hstgr.cloud/webhook/v1/pumaIA/chat`. **Diagnóstico técnico:** El webhook responde en menos de 400 ms con HTTP 200 y cuerpo vacío (0 bytes). Esto evidencia que el nodo en n8n está configurado en *Response Immediately*, cerrando la conexión antes de generar la respuesta. NestJS maneja la falla emitiendo `BadGatewayException` y preserva el mensaje del usuario en base de datos. |
| **FastAPI GenAI (Render)** | CONFIGURADO / PARCIAL | Microservicio en Render (`server-genai.onrender.com`). Expone `/chat` y `/analyze-profile`. Sufre de latencia por *cold start* en plan gratuito. Probado mediante suite unitaria y mocks de simulación HTTP. |
| **Google OAuth 2.0** | CONFIGURADO | Validación de token criptográfico implementada en `AutenticacionService.loginWithGoogle()`. Requiere configuración del `GOOGLE_CLIENT_ID` definitivo en el entorno de despliegue. |
| **Servicio de Correo (SMTP / Webhook)** | FUNCIONAL EN LOCAL | En entorno de prueba utiliza la bandeja local `./tmp/email-outbox.json` para validar tokens sin depender de servidores de correo externos. Soporta configuración SMTP estándar. |
| **Cloudinary** | FUNCIONAL | Configurado en `src/cloudinary/` para la recepción de archivos en memoria (`Multer`) y subida de avatares a través de stream. |

---

## 8. Pruebas Realizadas

Se ejecutaron múltiples niveles de prueba documentados en scripts y suites de Jest:

### 8.1 Pruebas Unitarias y de Seguridad (Jest)
- **Seguridad y Autenticación (`autenticacion-security.spec.ts`):** 11 pruebas aprobadas (100%). Valida rechazo de tokens con audiencia incorrecta, tokens expirados, correos no verificados, dominios ajenos, protección contra uso cruzado de refresh/access tokens, y detección de colisiones de identidad.
- **Módulos Funcionales (Fases 2 a 8):** 84 pruebas unitarias aprobadas (100%) que cubren autorización cruzada de estudiantes, recálculo atómico de promedio en `GradeService`, normalización de cuestionarios, adaptador de resultados de IA, aislamiento de conversaciones sensibles, módulos de asistencia, k-anonimato y módulo de profesores.
- **Integración n8n (`phase13-chat-n8n-integration.spec.ts`):** 11 pruebas unitarias aprobadas cubriendo normalización de contratos JSON de n8n, manejo de cuerpos vacíos, timeouts y aislamiento de datos.

### 8.2 Pruebas de Integración y Persistencia (PostgreSQL Local)
- **Suite Fases 9 y 12 (`scripts/phase12-complete-e2e.mjs`):** Verificación integral de 12 bloques sobre PostgreSQL local (puerto 5433).
  - Verificación física de integridad referencial y conteo de registros persistidos en 11 tablas físicas: `usuario`, `alumno`, `consentimiento`, `perfil_personal`, `metodo_contacto`, `idioma_alumno`, `curso_alumno`, `concurso_alumno`, `beca_alumno`, `experiencia_profesional`, `inscripcion`.
  - Recálculo exitoso de calificaciones numéricas (10, 9, 10, 9, 8) para asignaturas de primer semestre.

### 8.3 Pruebas de Navegador Real (Playwright)
- Ejecutadas en modo automatizado mediante `scripts/phase9-browser-e2e.mjs` y `phase12-complete-e2e.mjs`.
- Comprobó renderizado, navegación, modales de privacidad, flujo completo de registro, verificación de correo, login, carga de datos desde base de datos, simulación de QR docente y cierre de sesión con 0 errores de consola.

---

## 9. Estado Actual del Proyecto

| Área o Módulo | Estado | Qué funciona | Qué falta |
|---|---|---|---|
| **Infraestructura Base y Conectividad** | COMPLETADO | Selector dinámico de base de datos (`local_test` vs. `Supabase`), Health check con diagnóstico de conexión y CORS seguro. | Unificar variables de entorno definitivas en despliegue. |
| **Autenticación Tradicional y Sesiones** | COMPLETADO | Registro con correo institucional, verificación por token, login seguro, bloqueo por fuerza bruta, refresh tokens rotativos y sesiones multi-dispositivo. | Activar servicio SMTP productivo (SendGrid, Mailgun o relay UNAM). |
| **Autenticación Google OAuth** | PARCIAL | Lógica de backend completa y validada contra tokens institucionales. | Configuración de credenciales de producción en Google Cloud Console. |
| **Control de Roles y Autorización (RBAC)** | COMPLETADO | Guards globales, decorador `@Roles`, discriminación estricta entre alumno, profesor, analista y administrador. | Asignación masiva inicial de roles institucionales reales. |
| **Consentimientos y Privacidad** | COMPLETADO | Registro *append-only*, bloqueo de chat sensible sin consentimiento y consulta de avisos activos. | Publicación del texto legal definitivo validado por el área jurídica de la FES. |
| **Expediente Académico del Alumno** | COMPLETADO | Registro de inscripciones, recálculo atómico de promedio, historial de materias, idiomas, cursos, becas y concursos. | Carga masiva del historial real de alumnos desde sistemas escolares (SIAE). |
| **Cuestionario Vocacional** | COMPLETADO | Modelos normalizados, endpoints jerárquicos y compatibilidad con interfaces existentes. | Población en Supabase del catálogo formal de preguntas del cuestionario. |
| **Asistente de IA (Chat)** | PARCIAL | Persistencia de mensajes, aislamiento por usuario, retroalimentación y detección de contenido sensible. | Corregir la configuración del nodo de respuesta en n8n (evitar respuesta inmediata vacía). |
| **Orientación Profesional (AI Result)** | PARCIAL | Lógica de generación de 5 rutas de carrera estructuradas en `AIResultOption` y guardado relacional. | Optimizar tiempos de respuesta o cold-start del microservicio FastAPI en Render. |
| **Gestión Docente y Asistencia** | COMPLETADO | Creación de grupos, listas de alumnos, sesiones de clase y generación de código QR dinámico temporal. | Lector QR nativo en aplicación móvil o escaneo integrado en frontend web. |
| **Métricas Institucionales y Analítica** | COMPLETADO | Endpoints directivos funcionando con k-anonimato estricto ($k \ge 10$) a través de vistas SQL adaptadas. | Integración de gráficas avanzadas en el panel web directivo. |
| **Comunidad e Intercambio (`/exchange`)** | NO IMPLEMENTADO | Interfaz visual en frontend disponible. | Diseño de tablas en backend, modelos de Prisma, controladores y servicios. |
| **Base de Datos Supabase Remota** | PARCIAL | Catálogo de MAC (69 materias, plan 2016, seriación) completamente estructurado. | Aplicar migración `20261103160000`, sembrar datos base y configurar políticas RLS. |

---

## 10. Problemas Conocidos y Pendientes

1. **Configuración del Webhook en n8n:**
   - *Problema:* El webhook remoto (`https://n8n-it2v.srv1803922.hstgr.cloud/webhook/v1/pumaIA/chat`) devuelve HTTP 200 pero 0 bytes.
   - *Causa:* Configuración del nodo Webhook en n8n en modalidad *Immediately* en lugar de *Using 'Respond to Webhook' Node*.
   - *Acción requerida:* Modificar el flujo de n8n para que el nodo final responda formalmente con `{ "output": "..." }` tras concluir el pipeline de IA/RAG.
2. **Migración `20261103160000` en Supabase:**
   - La tabla `sesion_autenticacion` y las columnas de autenticación tradicional en `usuario` existen en la base de datos local de pruebas pero aún no se han ejecutado contra Supabase remoto.
3. **Catálogos Base Faltantes en Supabase:**
   - Las tablas `aviso_privacidad`, `cuestionario`, `pregunta`, `opcion_pregunta` y `categoria_ia` están vacías en Supabase. Si el backend arranca apuntando a Supabase, `AIResultService` y `ConsentsModule` requerirán estos registros iniciales.
4. **Dependencia del Contenedor Local de Pruebas:**
   - Las suites de integración que ejecutan consultas SQL directas (`phase13` bloque 3 y `phase9`) requieren que el contenedor local en el puerto 5433 esté encendido.
5. **Configuración de RLS en Supabase:**
   - Al utilizar Prisma desde el backend, las consultas acceden con privilegios administrativos del servicio (`postgres` / `service_role`). Si en el futuro se habilita acceso directo desde clientes móviles o web vía SDK de Supabase, será indispensable definir políticas de Row Level Security (RLS).
6. **Módulo de Comunidad (`/exchange`):**
   - No existe correspondencia de backend; el frontend usa únicamente `mockExchangeData.ts`.

---

## 11. Próximos Pasos

A continuación se detalla la secuencia recomendada para dar continuidad al proyecto:

### Paso 1: Pendientes de Base de Datos y Supabase
1. Realizar respaldo preventivo del esquema actual de Supabase.
2. Aplicar la migración `prisma/migrations/20261103160000_auth_traditional_and_sessions` en Supabase.
3. Crear un script oficial `prisma/seed.ts` que inserte:
   - Los avisos de privacidad vigentes en `aviso_privacidad`.
   - Las categorías iniciales en `categoria_ia`.
   - El cuestionario base de orientación en `cuestionario`, `pregunta` y `opcion_pregunta`.
   - Cuentas maestras iniciales para directivos y docentes.
4. Ejecutar las 7 vistas SQL adaptadas (`prisma/views_adapted/`) directamente en Supabase.

### Paso 2: Corrección y Cierre de Integraciones Externas
1. Ajustar el nodo de respuesta del flujo en n8n para devolver la carga útil generada por el agente RAG.
2. Configurar el proyecto oficial en Google Cloud Console para obtener el `GOOGLE_CLIENT_ID` institucional de la UNAM y configurar los dominios autorizados.
3. Evaluar la estabilidad del servicio FastAPI en Render; implementar un mecanismo de sondeo previo (*warm-up ping*) para amortiguar el arranque en frío.

### Paso 3: Configuración y Despliegue de Backend
1. Configurar variables de entorno productivas (`.env.production`): secretos JWT criptográficos de 256 bits, proveedor SMTP real (o webhook de correo institucional) y credenciales de Cloudinary.
2. Verificar que `ValidationPipe` y el limitador de tasa de peticiones operen con métricas en producción.

### Paso 4: Cierre de Integración en Frontend
1. Sincronizar el cliente Next.js con los nuevos contratos de DTOs normalizados.
2. Decidir si el módulo `/exchange` se implementa en backend o se oculta temporalmente de la navegación principal para la primera versión funcional.
3. Verificar la gestión de cookies seguras (`SameSite=Strict`, `Secure=true`) en entornos HTTPS.

### Paso 5: Pruebas E2E Finales y Auditoría de Seguridad
1. Ejecutar las pruebas automatizadas de Playwright apuntando al backend conectado a Supabase.
2. Validar que ninguna consulta exponga datos de estudiantes en las vistas con menos de 10 registros (k-anonimato).
3. Realizar simulacro de cierre de sesión multi-dispositivo y revocación de tokens.

---

## 12. Conclusión

La migración desarrollada en la rama `migracion_v2` ha transformado sustancialmente a PUMAIA, llevándolo de un prototipo centrado en una sola tabla no estructurada a una plataforma académica con arquitectura empresarial, modelo de datos relacional (3NF), soporte multi-rol, control de sesiones robusto y estrictas garantías de privacidad institucional.

La lógica de negocio del backend y los flujos centrales de autenticación, expedientes académicos, cuestionarios y supervisión docente se encuentran **completamente implementados y verificados con pruebas automatizadas**.

Para dar por concluida la migración y avanzar al despliegue en producción, únicamente resta:
1. Sincronizar la última migración y catálogos semilla en Supabase remoto.
2. Corregir el nodo de respuesta del webhook en n8n.
3. Conectar el servicio de correo institucional definitivo.
4. Definir el alcance o implementación del módulo de intercambio.

