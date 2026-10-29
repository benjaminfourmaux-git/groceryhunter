-- ============================================================================
--  Droits que Supabase accorde au rôle `authenticated` sur le schéma public.
--  Joué APRÈS schema.sql : sans eux, les scénarios RLS testeraient l'absence
--  de GRANT au lieu de tester les politiques.
-- ============================================================================
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
