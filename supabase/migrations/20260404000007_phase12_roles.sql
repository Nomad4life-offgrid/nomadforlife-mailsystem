-- ============================================================
-- NOMAD FOR LIFE — Fase 12: Admin authenticatie & autorisatie
-- Migration: 20260404000007_phase12_roles
--
-- Voegt een rollenstructuur toe op basis van Supabase Auth:
--   admin  — volledige toegang inclusief verzenden en verwijderen
--   editor — kan alles voorbereiden, maar niet live verzenden
--
-- Bewust ontwerp:
--   - user_roles koppelt een Supabase-gebruiker aan een rol
--   - De service client (service role key) bypast RLS en mag schrijven
--   - Authenticated users mogen alleen hun eigen rol lezen (RLS policy)
--   - Roles worden server-side gecontroleerd in server actions (niet client-side)
--
-- Verdere hardening aanbevolen (zie opmerkingen onderaan).
-- ============================================================


-- ── 1. user_roles tabel ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_roles (
  user_id    uuid        PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  role       text        NOT NULL CHECK (role IN ('admin', 'editor')),
  created_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid        REFERENCES auth.users (id) ON DELETE SET NULL
);

COMMENT ON TABLE  user_roles              IS 'Koppelt Supabase Auth-gebruikers aan een beheerdersrol (admin of editor).';
COMMENT ON COLUMN user_roles.user_id      IS 'FK naar auth.users.id — cascade-delete bij verwijdering account.';
COMMENT ON COLUMN user_roles.role         IS 'admin: volledige toegang. editor: kan voorbereiden, niet verzenden.';
COMMENT ON COLUMN user_roles.granted_by   IS 'Welke admin de rol heeft verleend. NULL = systeem of eerste setup.';


-- ── 2. Row Level Security ─────────────────────────────────────────────────────

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Gebruikers mogen hun eigen rol lezen (voor client-side rolweergave)
CREATE POLICY "user_roles_own_read"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Schrijfacties verlopen uitsluitend via de service client (bypast RLS)
-- — geen INSERT/UPDATE/DELETE policies nodig voor normale gebruikers


-- ── 3. Index ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_user_roles_role
  ON user_roles (role);


-- ============================================================
-- HARDENING AANBEVELINGEN
-- ============================================================
--
-- 1. EERSTE ADMIN VIA SUPABASE DASHBOARD
--    Voer handmatig in na deployment:
--      INSERT INTO user_roles (user_id, role)
--      VALUES ('<uid-van-eerste-admin>', 'admin');
--    Daarna kan de admin via de beheerinterface andere gebruikers rollen geven.
--
-- 2. ROL-CACHING
--    Voor hoge traffic: cache getUserRole() in een korte in-memory cache
--    of JWT custom claims (via Supabase Auth Hook) om DB-queries per request
--    te vermijden. Eerste versie: directe DB-query per action is acceptabel.
--
-- 3. JWT CUSTOM CLAIMS (verdere hardening)
--    Voeg de rol toe als custom claim aan het Supabase JWT via een
--    Auth Hook (Database Webhook of Edge Function). Dan is de rol
--    beschikbaar zonder extra DB-query en controleerbaar in RLS policies
--    op andere tabellen.
--
-- 4. AUDIT LOG
--    Overweeg een trigger op user_roles om rol-wijzigingen te loggen
--    in activity_logs, zodat traceerbaar is wie wanneer welke rol had.
--
-- 5. EIGEN ADMIN-BESCHERMING
--    Voorkom dat een admin zijn eigen rol intrekt via een DB CHECK of
--    application-level guard (anders kun je jezelf buitensluiten).
-- ============================================================
