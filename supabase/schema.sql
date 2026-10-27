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
  id              uuid primary key references auth.users(id) on delete cascade,
  household_id    uuid not null references public.households(id) on delete cascade,
  display_name    text not null,
  color           text not null default '#0E8C7F',
  lang            text not null default 'fr',
  purchases_count int not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists members_household_idx on public.members(household_id);
-- Migrations : colonne langue + compteur permanent d'articles achetés.
alter table public.members add column if not exists lang text not null default 'fr';
alter table public.members add column if not exists purchases_count int not null default 0;

-- La liste de courses + les articles tout juste achetés :
--   bought_at vide   → à acheter
--   bought_at récent → acheté, compte à rebours d'une heure dans la liste
--   bought_at + 1 h  → promu dans products (l'inventaire) puis supprimé d'ici,
--                      cf. promote_bought_items. Plus de rétention de 48 h :
--                      l'inventaire ne se vide plus tout seul.
create table if not exists public.items (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  name          text not null,
  quantity      text,
  checked       boolean not null default false,
  added_by      uuid references public.members(id) on delete set null,
  bought_at     timestamptz,
  bought_by     uuid references public.members(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists items_household_idx on public.items(household_id);
-- Migration : état « acheté » (horodatage + auteur) pour les bases existantes.
alter table public.items add column if not exists bought_at timestamptz;
alter table public.items add column if not exists bought_by uuid references public.members(id) on delete set null;

-- L'inventaire du foyer : UNE ligne par produit distinct, pas par achat.
-- Alimenté à la promotion d'un article acheté (cf. promote_bought_items), il
-- devient le contenu de l'onglet « Historique » : on y repioche sans retaper.
--   name     → l'orthographe d'origine, telle qu'elle s'affiche.
--   name_key → la même, normalisée : c'est elle qui dédoublonne, pour que
--              « Pâtes », « pates » et « PATES » soient un seul produit.
--   score    → frécence (cf. promote_bought_items). Sert UNIQUEMENT au tri.
create extension if not exists unaccent with schema extensions;

create or replace function public.product_key(p_name text)
returns text
language sql
stable
set search_path = public, extensions
as $$
  select regexp_replace(lower(trim(unaccent(coalesce(p_name, '')))), '\s+', ' ', 'g')
$$;

create table if not exists public.products (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references public.households(id) on delete cascade,
  name            text not null,
  name_key        text not null,
  score           numeric not null default 0,
  last_bought_at  timestamptz,
  last_bought_by  uuid references public.members(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index if not exists products_household_idx on public.products(household_id);
-- Le dédoublonnage garanti en base : un produit n'entre pas deux fois.
create unique index if not exists products_name_key_idx
  on public.products(household_id, name_key);

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
alter table public.products            enable row level security;
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

-- L'inventaire se lit et se supprime depuis le client (sélection + bouton
-- Supprimer). Les écritures — création d'un produit et calcul du score — ne
-- passent que par promote_bought_items, en SECURITY DEFINER : aucune politique
-- d'insert ni d'update, pour qu'un client ne puisse pas fabriquer un score.
drop policy if exists products_select on public.products;
create policy products_select on public.products
  for select to authenticated
  using (household_id = public.current_household_id());

drop policy if exists products_delete on public.products;
create policy products_delete on public.products
  for delete to authenticated
  using (household_id = public.current_household_id());

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

-- Suppression d'une sortie (swipe dans l'historique) par les membres du foyer.
drop policy if exists trips_delete on public.shopping_trips;
create policy trips_delete on public.shopping_trips
  for delete to authenticated
  using (household_id = public.current_household_id());

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
--  RPC : cocher / décocher un article (« acheté »).
--  Pose/retire bought_at + bought_by ET ajuste le compteur permanent du membre
--  de façon atomique. Au décochage, on décrémente l'ACHETEUR d'origine (pas
--  forcément l'appelant). Idempotent (ne compte pas deux fois).
-- ----------------------------------------------------------------------------
create or replace function public.set_item_bought(p_item_id uuid, p_bought boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_hh    uuid := public.current_household_id();
  v_buyer uuid;
  v_was   boolean;
begin
  if v_uid is null then
    raise exception 'Non authentifié';
  end if;

  select bought_by, (bought_at is not null)
    into v_buyer, v_was
    from public.items
    where id = p_item_id and household_id = v_hh;
  if not found then
    return;
  end if;

  if p_bought then
    if v_was then return; end if; -- déjà acheté : rien à faire
    update public.items
      set bought_at = now(), bought_by = v_uid, checked = true
      where id = p_item_id;
    update public.members set purchases_count = purchases_count + 1 where id = v_uid;
  else
    if not v_was then return; end if; -- déjà « à acheter »
    update public.items
      set bought_at = null, bought_by = null, checked = false
      where id = p_item_id;
    if v_buyer is not null then
      update public.members
        set purchases_count = greatest(0, purchases_count - 1)
        where id = v_buyer;
    end if;
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
grant execute on function public.set_item_bought(uuid, boolean) to authenticated;
grant execute on function public.keepalive() to anon, authenticated;

-- ----------------------------------------------------------------------------
--  RPC : promouvoir dans l'inventaire les articles achetés il y a plus d'1 h.
--
--  C'est le moment où un article quitte la liste pour l'inventaire. L'heure de
--  battement sert à ce qu'un décochage ne laisse aucune trace : tant qu'elle
--  n'est pas écoulée, rien n'est écrit dans products.
--
--  Appelée paresseusement par le client — même esprit que l'ancien nettoyage
--  par expiration, qu'elle remplace : aucune infra serveur, pas de cron. Elle
--  est idempotente (l'upsert porte sur household_id + name_key) et sûre en
--  concurrence : deux téléphones qui la lancent ensemble aboutissent au même
--  état, le second ne trouvant plus rien à promouvoir.
--
--  Score : frécence. À chaque achat,
--      score = score × 0,5 ^ (écart / demi-vie) + 1
--  Valeur bornée — un achat par semaine plafonne vers 8,6 avec une demi-vie de
--  60 jours — et oublieuse : le produit acheté 200 fois l'an dernier puis
--  abandonné retombe tout seul derrière l'habitude du moment. L'écart se
--  mesure sur bought_at et non sur l'heure de la promotion : si personne
--  n'ouvre l'app pendant une semaine, le rattrapage reste juste.
-- ----------------------------------------------------------------------------
create or replace function public.promote_bought_items()
returns int
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hh    uuid := public.current_household_id();
  v_delay constant interval := interval '1 hour';   -- miroir de T1_MS (src/lib/config.js)
  v_half  constant interval := interval '60 days';  -- demi-vie du score
  v_n     int := 0;
  r       record;
begin
  if v_hh is null then
    return 0;
  end if;

  -- Du plus ancien au plus récent : la décroissance s'applique dans l'ordre
  -- des achats, sinon un rattrapage de plusieurs articles fausserait le score.
  for r in
    select id, name, bought_at, bought_by
      from public.items
     where household_id = v_hh
       and bought_at is not null
       and bought_at < now() - v_delay
     order by bought_at
  loop
    insert into public.products (household_id, name, name_key, score, last_bought_at, last_bought_by)
    values (v_hh, trim(r.name), public.product_key(r.name), 1, r.bought_at, r.bought_by)
    on conflict (household_id, name_key) do update
      set score =
            products.score
              * power(
                  0.5,
                  greatest(0, extract(epoch from (
                    excluded.last_bought_at - coalesce(products.last_bought_at, excluded.last_bought_at)
                  ))) / extract(epoch from v_half)
                )
              + 1,
          last_bought_at =
            greatest(coalesce(products.last_bought_at, excluded.last_bought_at), excluded.last_bought_at),
          last_bought_by =
            case
              when excluded.last_bought_at >= coalesce(products.last_bought_at, excluded.last_bought_at)
                then excluded.last_bought_by
              else products.last_bought_by
            end;
    -- `name` n'est volontairement pas remis à jour : l'orthographe d'origine
    -- reste celle du produit, le réachat ne la réécrit pas.

    delete from public.items where id = r.id;
    v_n := v_n + 1;
  end loop;

  return v_n;
end;
$$;
grant execute on function public.promote_bought_items() to authenticated;

-- ----------------------------------------------------------------------------
--  RPC : renvoyer des produits de l'inventaire dans la liste.
--
--  Copie, pas déplacement : la ligne products reste en place — c'est ce qui
--  fait de l'inventaire un catalogue réutilisable plutôt qu'une file d'attente.
--  On saute les produits déjà dans la liste et pas encore achetés, pour la même
--  raison qu'on dédoublonne l'inventaire : pas deux fois « Lait » à acheter.
--  Sans quantité : elle se règle ensuite dans la liste, article par article.
-- ----------------------------------------------------------------------------
create or replace function public.add_products_to_list(p_product_ids uuid[])
returns int
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_hh  uuid := public.current_household_id();
  v_n   int := 0;
begin
  if v_uid is null then
    raise exception 'Non authentifié';
  end if;
  if v_hh is null or p_product_ids is null then
    return 0;
  end if;

  insert into public.items (household_id, name, added_by)
  select v_hh, p.name, v_uid
    from public.products p
   where p.household_id = v_hh
     and p.id = any(p_product_ids)
     and not exists (
       select 1
         from public.items i
        where i.household_id = v_hh
          and i.bought_at is null
          and public.product_key(i.name) = p.name_key
     );

  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
grant execute on function public.add_products_to_list(uuid[]) to authenticated;

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
alter table public.products replica identity full;

do $$ begin
  alter publication supabase_realtime add table public.items;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.products;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.shopping_trips;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.members;
exception when duplicate_object then null; end $$;
