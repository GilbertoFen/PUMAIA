-- AlterTable: Add traditional authentication, verification, password recovery and brute-force protection fields to "usuario"
ALTER TABLE "usuario"
ADD COLUMN IF NOT EXISTS "password_hash" TEXT,
ADD COLUMN IF NOT EXISTS "intentos_fallidos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "bloqueado_hasta" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "token_verificacion_hash" TEXT,
ADD COLUMN IF NOT EXISTS "verificacion_expira_en" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "token_recuperacion_hash" TEXT,
ADD COLUMN IF NOT EXISTS "recuperacion_expira_en" TIMESTAMP(3);

-- CreateTable: Multi-device independent sessions with refresh token rotation & reuse detection
CREATE TABLE IF NOT EXISTS "sesion_autenticacion" (
    "id_sesion" TEXT NOT NULL,
    "id_usuario" TEXT NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "previous_token_hash" TEXT,
    "id_familia" TEXT NOT NULL,
    "agente_usuario" TEXT,
    "direccion_ip" TEXT,
    "expira_en" TIMESTAMP(3) NOT NULL,
    "revocado_en" TIMESTAMP(3),
    "motivo_revocacion" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sesion_autenticacion_pkey" PRIMARY KEY ("id_sesion")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sesion_autenticacion_id_usuario_idx" ON "sesion_autenticacion"("id_usuario");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sesion_autenticacion_id_familia_idx" ON "sesion_autenticacion"("id_familia");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'sesion_autenticacion_id_usuario_fkey'
    ) THEN
        ALTER TABLE "sesion_autenticacion"
        ADD CONSTRAINT "sesion_autenticacion_id_usuario_fkey"
        FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

