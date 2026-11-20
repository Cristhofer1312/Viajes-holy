-- db/schema.sql — Esquema de Viajes Holy en Postgres propio (VPS).
--
-- Reemplaza a Supabase: la tabla `usuarios` absorbe lo que antes vivía en
-- auth.users (email + hash bcrypt de la contraseña).
--
-- Idempotente: se ejecuta automáticamente al crear el volumen de Postgres
-- (docker-entrypoint-initdb.d) y puede re-ejecutarse sin perder datos:
--   docker compose exec -T db psql -U holy -d holy < db/schema.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()

-- ─── Usuarios ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text NOT NULL,
  password_hash   text NOT NULL,                 -- bcrypt ($2a$/$2b$)
  nombre          text NOT NULL,
  rol             text NOT NULL CHECK (rol IN ('admin', 'encargado', 'agente')),
  activo          boolean NOT NULL DEFAULT true,
  -- Se incrementa al cambiar la contraseña: invalida los JWT emitidos antes
  sesion_version  integer NOT NULL DEFAULT 1,
  creado_por      uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_email_uq ON usuarios (lower(email));

-- ─── Posadas (plantillas) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS posadas (
  id                    text PRIMARY KEY,        -- slug: posada-corales-lr
  nombre                text NOT NULL,
  destino               text NOT NULL,
  tipo_servicio_default text NOT NULL DEFAULT '',
  layout_fotos          integer NOT NULL DEFAULT 1,
  checkin_hora          text NOT NULL DEFAULT '15:00',
  checkout_hora         text NOT NULL DEFAULT '13:00',
  tipo_template         text NOT NULL DEFAULT 'COMPLETO',
  activa                boolean NOT NULL DEFAULT true,
  fecha_creacion        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS posada_fotos (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  posada_id   text NOT NULL REFERENCES posadas(id) ON DELETE CASCADE,
  url         text NOT NULL,                     -- /uploads/<posada>/<archivo>
  orden       integer NOT NULL DEFAULT 0,
  es_portada  boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS posada_fotos_posada_idx ON posada_fotos (posada_id, orden);

CREATE TABLE IF NOT EXISTS posada_inclusiones (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  posada_id   text NOT NULL REFERENCES posadas(id) ON DELETE CASCADE,
  texto       text NOT NULL,
  orden       integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS posada_inclusiones_posada_idx ON posada_inclusiones (posada_id, orden);

-- ─── Cotizaciones (historial) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cotizaciones (
  id                  text PRIMARY KEY,
  posada_id           text REFERENCES posadas(id) ON DELETE SET NULL,
  generado_por        uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  estado              text,
  tipo_paquete        text,
  pasajeros_adultos   integer NOT NULL DEFAULT 0,
  pasajeros_ninos     integer NOT NULL DEFAULT 0,
  pasajeros_infantes  integer NOT NULL DEFAULT 0,
  tarifa_adulto       numeric(12,2) NOT NULL DEFAULT 0,
  tarifa_nino         numeric(12,2) NOT NULL DEFAULT 0,
  moneda              text NOT NULL DEFAULT 'USD',
  monto_total         numeric(12,2) NOT NULL DEFAULT 0,
  datos_vuelo         jsonb,
  datos_hospedaje     jsonb,
  datos_cliente       jsonb,
  creado_at           timestamptz NOT NULL DEFAULT now()
);
