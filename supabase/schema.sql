-- ============================================================================
--  Liste de courses du foyer — schéma Supabase
--  À exécuter dans : Supabase Dashboard > SQL Editor > New query > Run
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
--  Tables
-- ----------------------------------------------------------------------------

-- Un foyer = un groupe partagé, rejoignable via un code court.
create table if not exists public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  join_code   text not null unique,
  created_at  timestamptz not null default now()
);

-- Un membre = un appareil/personne. Son id est l'id de l'utilisateur Supabase
-- (connexion anonyme), ce qui évite tout mot de passe.
create table if not exists public.members (
  id            uuid primary key references auth.users(id) on delete cascade,
  household_id  uuid not null references public.households(id) on delete cascade,
  display_name  text not null,
  color         text not null default '#0E8C7F',
  lang          text not null default 'fr',
  created_at    timestamptz not null default now()
);
create index if not exists members_household_idx on public.members(household_id);
-- Migration : ajoute la colonne langue aux bases déjà créées.
alter table public.members add column if not exists lang text not null default 'fr';

-- La liste de courses courante (les articles « manquants »).
create table if not exists public.items (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  name          text not null,
  quantity      text,
  checked       boolean not null default false,
  added_by      uuid references public.members(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists items_household_idx on public.items(household_id);

-- L'historique : une entrée par sortie « courses faites ».
create table if not exists public.shopping_trips (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  shopper_id    uuid references public.members(id) on delete set null,
  shopper_name  text not null,
  items         jsonb not null default '[]'::jsonb,
  item_count    int not null default 0,
  price         numeric,
  created_at    timestamptz not null default now()
);
create index if not exists trips_household_idx on public.shopping_trips(household_id);
-- Migration : ajoute le prix (facultatif) aux bases déjà créées.
alter table public.shopping_trips add column if not exists price numeric;

-- Abonnements Web Push (un par navigateur/appareil).
create table if not exists public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null references public.members(id) on delete cascade,
  household_id  uuid not null references public.households(id) on delete cascade,
  endpoint      text not null unique,
  subscription  jsonb not null,
  created_at    timestamptz not null default now()
);
create index if not exists subs_household_idx on public.push_subscriptions(household_id);

-- ----------------------------------------------------------------------------
--  Helper : le foyer de l'appelant.
--  SECURITY DEFINER => contourne RLS, ce qui évite la récursion dans les
--  politiques qui interrogent `members`.
-- ----------------------------------------------------------------------------
create or replace function public.current_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from public.members where id = auth.uid()
$$;

-- ----------------------------------------------------------------------------
--  Row Level Security : chacun ne voit/agit que dans SON foyer.
-- ----------------------------------------------------------------------------
alter table public.households          enable row level security;
alter table public.members             enable row level security;
alter table public.items               enable row level security;
alter table public.shopping_trips      enable row level security;
alter table public.push_subscriptions  enable row level security;

drop policy if exists households_select on public.households;
create policy households_select on public.households
  for select to authenticated
  using (id = public.current_household_id());

drop policy if exists members_select on public.members;
create policy members_select on public.members
  for select to authenticated
  using (household_id = public.current_household_id());

drop policy if exists members_update_self on public.members;
create policy members_update_self on public.members
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists items_all on public.items;
create policy items_all on public.items
  for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

drop policy if exists trips_select on public.shopping_trips;
create policy trips_select on public.shopping_trips
  for select to authenticated
  using (household_id = public.current_household_id());

drop policy if exists trips_insert on public.shopping_trips;
create policy trips_insert on public.shopping_trips
  for insert to authenticated
  with check (household_id = public.current_household_id());

-- Édition d'une sortie (ex. corriger le prix) par les membres du foyer.
drop policy if exists trips_update on public.shopping_trips;
create policy trips_update on public.shopping_trips
  for update to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

drop policy if exists subs_all on public.push_subscriptions;
create policy subs_all on public.push_subscriptions
  for all to authenticated
  using (member_id = auth.uid())
  with check (member_id = auth.uid());

-- ----------------------------------------------------------------------------
--  RPC : créer un foyer (renvoie le membre + le foyer).
-- ----------------------------------------------------------------------------
create or replace function public.create_household(
  p_name text,
  p_display_name text,
  p_color text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_code   text;
  v_hh     public.households;
  v_member public.members;
begin
  if v_uid is null then
    raise exception 'Non authentifié';
  end if;
  if exists (select 1 from public.members where id = v_uid) then
    raise exception 'Vous appartenez déjà à un foyer';
  end if;

  -- Code court, sans caractères ambigus (pas de 0/O/1/I/L).
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', floor(random() * 30)::int + 1, 1);
    end loop;
    exit when not exists (select 1 from public.households where join_code = v_code);
  end loop;

  insert into public.households(name, join_code)
    values (coalesce(nullif(trim(p_name), ''), 'Mon foyer'), v_code)
    returning * into v_hh;

  insert into public.members(id, household_id, display_name, color)
    values (v_uid, v_hh.id, coalesce(nullif(trim(p_display_name), ''), 'Moi'), coalesce(p_color, '#0E8C7F'))
    returning * into v_member;

  return json_build_object('member', row_to_json(v_member), 'household', row_to_json(v_hh));
end;
$$;

-- ----------------------------------------------------------------------------
--  RPC : rejoindre un foyer via son code.
-- ----------------------------------------------------------------------------
create or replace function public.join_household(
  p_code text,
  p_display_name text,
  p_color text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_hh     public.households;
  v_member public.members;
begin
  if v_uid is null then
    raise exception 'Non authentifié';
  end if;

  select * into v_hh from public.households where join_code = upper(trim(p_code));
  if v_hh.id is null then
    raise exception 'Aucun foyer trouvé avec ce code';
  end if;

  if exists (select 1 from public.members where id = v_uid) then
    raise exception 'Vous appartenez déjà à un foyer';
  end if;

  insert into public.members(id, household_id, display_name, color)
    values (v_uid, v_hh.id, coalesce(nullif(trim(p_display_name), ''), 'Moi'), coalesce(p_color, '#0E8C7F'))
    returning * into v_member;

  return json_build_object('member', row_to_json(v_member), 'household', row_to_json(v_hh));
end;
$$;

-- ----------------------------------------------------------------------------
--  RPC : quitter le foyer.
--  Supprime le membre courant ; si le foyer n'a plus aucun membre, il est
--  supprimé à son tour (ce qui efface en cascade ses articles et son historique).
--  SECURITY DEFINER => contourne RLS (il n'y a pas de politique DELETE sur members).
-- ----------------------------------------------------------------------------
create or replace function public.leave_household()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_hh  uuid;
begin
  if v_uid is null then
    raise exception 'Non authentifié';
  end if;

  select household_id into v_hh from public.members where id = v_uid;
  delete from public.members where id = v_uid;

  if v_hh is not null
     and not exists (select 1 from public.members where household_id = v_hh) then
    delete from public.households where id = v_hh;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
--  RPC keepalive : appelé chaque jour par GitHub Actions pour empêcher la
--  mise en pause du projet gratuit après 7 jours d'inactivité.
-- ----------------------------------------------------------------------------
create or replace function public.keepalive()
returns text
language sql
security definer
set search_path = public
as $$
  select 'ok'::text
$$;

grant execute on function public.current_household_id() to authenticated;
grant execute on function public.create_household(text, text, text) to authenticated;
grant execute on function public.join_household(text, text, text) to authenticated;
grant execute on function public.leave_household() to authenticated;
grant execute on function public.keepalive() to anon, authenticated;

-- ----------------------------------------------------------------------------
--  Temps réel : diffuser les changements aux autres téléphones.
--  (Idempotent : ne plante pas si la table est déjà publiée.)
--
--  REPLICA IDENTITY FULL : sans cela, un événement DELETE ne transporte que la
--  clé primaire. Le filtre temps réel « household_id=eq.… » ne pouvant pas être
--  évalué, la suppression n'est jamais diffusée aux autres appareils — c'est ce
--  qui empêchait la liste de se vider partout quand quelqu'un fait les courses.
--  Avec FULL, l'ancienne ligne complète est incluse et le filtre s'applique.
-- ----------------------------------------------------------------------------
alter table public.items replica identity full;

do $$ begin
  alter publication supabase_realtime add table public.items;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.shopping_trips;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.members;
exception when duplicate_object then null; end $$;
