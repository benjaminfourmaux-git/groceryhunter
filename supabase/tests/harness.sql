-- ============================================================================
--  Échafaudage du banc de test : le minimum de Supabase pour que schema.sql
--  tourne sur un Postgres nu. Rien ici ne part en production.
--  Joué AVANT schema.sql.
-- ============================================================================

-- Supabase fournit ces schémas et ces rôles ; un Postgres nu, non.
create schema if not exists auth;
create schema if not exists extensions;

do $$ begin create role anon; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;

-- La table des comptes, cible de members.id (connexion anonyme côté Supabase).
create table if not exists auth.users (id uuid primary key);

-- auth.uid() : en production, l'utilisateur du jeton. Ici, une variable de
-- session que les tests positionnent avec test_as().
create or replace function auth.uid()
returns uuid
language sql
stable
as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;

-- La publication temps réel, que Supabase crée pour nous.
do $$ begin create publication supabase_realtime; exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
--  Outils de test
-- ----------------------------------------------------------------------------

-- « Se connecter » comme un utilisateur donné (crée le compte au besoin).
create or replace function test_as(p_uid uuid)
returns void
language plpgsql
as $$
begin
  insert into auth.users(id) values (p_uid) on conflict do nothing;
  perform set_config('test.uid', p_uid::text, false);
end $$;

create or replace function test_ok(p_cond boolean, p_label text)
returns void
language plpgsql
as $$
begin
  if p_cond then
    raise notice '  ok    %', p_label;
  else
    raise exception 'ÉCHEC : %', p_label;
  end if;
end $$;

create or replace function test_eq(p_got anyelement, p_want anyelement, p_label text)
returns void
language plpgsql
as $$
begin
  if p_got is not distinct from p_want then
    raise notice '  ok    %  (= %)', p_label, p_want;
  else
    raise exception 'ÉCHEC : % — attendu %, obtenu %', p_label, p_want, p_got;
  end if;
end $$;

-- Antidater un achat : les scénarios ont besoin d'articles « achetés il y a
-- deux heures » ou « il y a soixante jours » sans attendre.
-- En plpgsql et non en SQL : le corps d'une fonction SQL est résolu dès sa
-- création, or public.items n'existe pas encore à ce moment-là.
create or replace function test_backdate(p_item_id uuid, p_age interval)
returns void
language plpgsql
as $$
begin
  update public.items set bought_at = now() - p_age where id = p_item_id;
end $$;
