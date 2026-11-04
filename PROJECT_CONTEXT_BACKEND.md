# PROJECT_CONTEXT.md — pumaAPI (PumaIA / "trayectoriaprofesional")

Documento de contexto del backend. Describe stack, estructura, modelo de datos, endpoints e integración con el servidor externo de IA (GenAI).

## 1. Propósito

API REST que:
1. Se conecta a la **base de datos PostgreSQL (Supabase)** vía Prisma.
2. Expone endpoints para el **frontend** (alumnos UNAM: perfil, historial académico, cuestionario, cursos, becas, concursos, idiomas, etc.).
3. Hace de **puente hacia un servidor externo de IA generativa** (FastAPI en Render) para:
   - Chat conversacional de orientación profesional.
   - Análisis de perfil del alumno (5 opciones de trayectoria profesional).

## 2. Stack

| Capa | Tecnología |
|---|---|
| Framework | NestJS 11 (TypeScript) |
| ORM | Prisma 7 (`@prisma/client`, `@prisma/adapter-pg`) |
| BD | PostgreSQL en Supabase (pooler + conexión directa); Postgres 15 local con docker-compose |
| Auth | JWT (`@nestjs/jwt`, `passport-jwt`, `passport-local`), `bcrypt` |
| Validación | `class-validator`, `class-transformer` |
| Archivos | Cloudinary (avatares), `multer`; `pdf-parse-new` (parseo de historial académico PDF) |
| Calidad | ESLint 9, Prettier, Jest |

## 3. Arquitectura general

```
Frontend ──HTTP /api/*──► NestJS (pumaAPI, :3001)
                              │
                              ├─► Prisma ──► PostgreSQL (Supabase)
                              ├─► Cloudinary (avatares)
                              └─► Servidor GenAI (FastAPI en Render)
                                    https://server-genai.onrender.com
                                    ├─ POST /chat
                                    └─ POST /analyze-profile
```

- Prefijo global: `/api`. Puerto: `PORT` o `3001`.
- CORS abierto (`origin: '*'`).
- `main.ts` registra `ValidationPipe` global **después** de `app.listen` (ver Notas/Pendientes).
- Endpoints protegidos con `@UseGuards(AuthGuard('jwt'))`; el id del alumno se obtiene de `req.user.userId`.

## 4. Integración con el servidor de IA

URL base: `https://server-genai.onrender.com` (instancia en Render; puede tener *cold start*).

### 4.1 Chat — `src/chat/chat.service.ts` (`handleMessage`)
Flujo de `POST /api/chat/message`:
1. Si no hay `conversationId`, crea `Conversation` (título = primeros 40 chars).
2. Guarda el mensaje `USER` en `Message`.
3. Recupera historial de la conversación (sin el último mensaje).
4. Carga perfil del alumno (`Student` + `experiences.areaExpertise` + `answers`); usa la respuesta `p4_modalidad_trabajo`.
5. `fetch POST https://server-genai.onrender.com/chat` (URL **hardcodeada**) con:
   ```json
   { "message": "...", "student_profile": "texto con nombre, semestre, promedio, modalidad, experiencia", "history": [{"role":"USER|ASSISTANT","content":"..."}] }
   ```
6. Espera `{ "response": "..." }` y lo guarda como `Message` con rol `ASSISTANT`.
7. Errores → `InternalServerErrorException('No se pudo obtener respuesta de la IA.')`.

### 4.2 Análisis de perfil — `src/ai-result/ai-result.service.ts` (`processAndSaveAnalysis`)
Flujo de `POST /api/ai-analysis/generate`:
1. `StudentsService.getFullProfileSummary(studentId)` arma el expediente (cursos, concursos, becas, experiencia, idiomas, respuestas del cuestionario).
2. Construye `student_context` (texto plano).
3. `fetch POST` a `process.env.FASTAPI_URL` (default `https://server-genai.onrender.com/analyze-profile`) con `{ "student_context": "..." }`.
4. Respuesta esperada: `optionA..E`, `descriptionA..E`, `meta_summary`, `meta_strengths`, `meta_opportunities`.
5. Guarda en `AIResult` (upsert lógico: actualiza el último o crea uno). Categoría = primera de `AICategory` (requiere seed).
6. **Serialización:** `descriptionA` se guarda como `descA||meta_summary||meta_strengths||meta_opportunities`; `GET /api/ai-analysis/current` lo separa con `split('||')`.

Otros: `GET /api/ai-analysis/current` devuelve `{hasAnalysis, data}` con el último resultado.

### 4.3 Tablas auxiliares de IA/RAG en BD
- `documents` (pgvector, `@@ignore`) y `n8n_chat_histories`: infraestructura de RAG/n8n usada por el servidor de IA; la API no las consume directamente.

## 5. Estructura del repositorio

```
pumaAPI/
├── prisma/
│   ├── schema.prisma          # Modelo de datos
│   └── migrations/            # 20260504003154_init
├── prisma.config.ts           # datasource.url = DIRECT_URL; seed: node ./prisma/seed.ts
├── docker-compose.yml         # Postgres 15 local (puerto 5499)
├── nest-cli.json, tsconfig*.json, eslint.config.mjs, .prettierrc
├── dist/                      # Build (salida: dist/src/main.js)
└── src/
    ├── main.ts, app.module.ts
    ├── prisma/                # PrismaModule / PrismaService (adapter pg, usa DIRECT_URL)
    ├── generated/prisma/      # Cliente Prisma generado
    ├── autenticacion/         # register / login (JWT)
    ├── students/              # Alumnos, perfil, avatar, asignar concurso, parseo PDF
    ├── chat/                  # Conversaciones y mensajes + llamada a IA
    ├── ai-result/             # Análisis de perfil con IA
    ├── ai-category/           # Catálogo de categorías IA
    ├── questionnaire/         # Cuestionario (respuestas JSON)
    ├── career/, students-career/
    ├── subject/, grades/, studyPlan/, category/, knowledgeArea/
    ├── courses/, certifications/, languages/, skills/
    ├── schoolarships/, contest/
    ├── professional-experience/, area-expertise/
    ├── adresses/              # Direcciones (estado/municipio/colonia)
    ├── cloudinary/            # Provider + servicio de subida
    ├── common/enums/          # cefr-level, language
    └── utils/                 # parser-pdf.ts, types.ts, historial.pdf (ejemplo)
```

Convención por módulo: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`, `entities/` y un archivo `*.http` (REST Client) con requests de ejemplo.

## 6. Endpoints (prefijo `/api`)

| Controller | Ruta base | Notas |
|---|---|---|
| Autenticación | `/autenticacion` | `POST register` (crea alumno y hace login), `POST login` — públicos |
| Students | `/students` | `GET /`, `/profile-summary`, `/:email`, `/account/:accountNumber`; `POST /`, `/assign-contest`, `/avatar` (multipart → Cloudinary) |
| Chat (JWT) | `/chat` | `GET conversations`, `GET conversations/:id/messages`, `POST message`, `PATCH conversations/:id`, `DELETE conversations/:id` |
| AI Analysis (JWT) | `/ai-analysis` | `GET current`, `POST generate` |
| AI Category | `/ai-category` | Catálogo |
| Questionnaire (JWT) | `/questionnaire` | `POST save`, `GET my-answers`, `PATCH update` |
| Career / Student career | `/career`, `/student-career` | |
| Subjects / Grades / Study plan | `/subjects`, `/grade`, `/study-plan` | |
| Category / Knowledge area | `/category`, `/knowledge-area` | |
| Courses / Certifications / Languages / Skills | `/courses`, `/certifications`, `/languages`, `/skills` | |
| Schoolarships / Contests | `/schoolarships`, `/contests` | |
| Experience / Area expertise | `/professional-experience`, `/areas-expertise` | |
| Addresses | `/addresses` | |

## 7. Modelo de datos (Prisma, `prisma/schema.prisma`)

Tablas mapeadas a español con `@map`. IDs UUID (excepto `Document`, `n8n_chat_histories`).

- **Student** (`alumno`): numero_cuenta (único), nombre, apellidos, interes, semestre_actual, promedio, correo (único), contrasena (bcrypt), avatar_url, cuestionario_completado, dirección. Relaciones: answers, chats, schoolarships, grades, careers, contests, courses, experiences, languages, aiResults.
- **QuestionnaireAnswer** (`respuestas_cuestionario`): `@@unique([studentId, questionId])`, `categoria` (enum `CategoriaPregunta`), `answer` JSON.
- **Conversation** (`conversaciones`) 1—N **Message** (`mensajes`; rol `USER|ASSISTANT`; cascade).
- **AICategory** (`categoria_ia`) 1—N **AIResult** (`resultado_ia`): 5 opciones (A–E) con descripción, ligado a alumno.
- **Académico:** Career, StudentCareer, StudyPlan, Subject, Grades, Category (`CategoryEnum`), KnowledgeArea (`KnowledgeAreaEnum`).
- **Perfil:** Course/StudentCourse, Certification, Language/StudentLanguage, Skill, Schoolarship/StudentSchoolarship, Contest/StudentContest, AreaExpertise, ProfessionalExperience.
- **Ubicación:** Address, State, Municipio, Colonia.
- **Infra IA:** `Document` (pgvector, ignorado), `n8n_chat_histories`.
- **Vista:** `perfil_alumno` (perfil consolidado; requiere `previewFeatures = ["views"]`).

Enums: `KnowledgeAreaEnum`, `CategoryEnum`, `CategoriaPregunta` (INTERESES, HABILIDADES, EXPECTATIVAS, EXPERIENCIA), `RolMensaje`.

## 8. Variables de entorno (`.env`, no versionar)

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Conexión Supabase vía pooler |
| `DIRECT_URL` | Conexión directa (migraciones; también la usa `PrismaService` y `prisma.config.ts`) |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Firma/expiración de tokens |
| `CLOUDINARY_URL`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Subida de avatares |
| `FASTAPI_URL` | (opcional) endpoint `/analyze-profile` del servidor IA |
| `PORT` | (opcional) por defecto 3001 |

## 9. Comandos

```bash
npm install                 # postinstall: prisma generate
npm run start:dev           # desarrollo con watch
npm run build               # prisma generate && nest build
npm run start:prod          # node dist/src/main
npx prisma migrate dev      # migraciones (usa DIRECT_URL)
npx prisma db seed          # seed (node ./prisma/seed.ts; el archivo no existe aún en el repo)
docker compose up -d        # Postgres local en :5499 (alternativa a Supabase)
npm run lint / test
```

## 10. Notas y pendientes detectados

- `ValidationPipe` se registra tras `app.listen()` en `main.ts`; conviene moverlo antes para asegurar validación de DTOs.
- La URL de `/chat` está hardcodeada en `chat.service.ts`; unificar con una variable de entorno (p. ej. `GENAI_BASE_URL`).
- `prisma.config.ts` referencia `prisma/seed.ts`, pero no existe; `ai-result` exige categorías IA pre-sembradas.
- `README.md` es la plantilla de NestJS y contiene un marcador de merge residual (`>>>>>>> origin/saulKing`).
- `.env` contiene secretos reales: asegurarse de que esté en `.gitignore` y rotar credenciales si se expusieron.
- Servidor en Render (plan gratuito) puede tardar en responder por cold start; no hay timeout/reintentos en los `fetch`.
- `AIResult.descriptionA` se usa como campo multiuso con separador `||`; frágil si el texto contiene `||`.
- `docker-compose.yml` declara el volumen `db_data` pero el servicio no lo monta.
