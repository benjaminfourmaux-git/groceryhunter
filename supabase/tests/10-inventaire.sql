-- ============================================================================
--  Scénarios : l'inventaire (table products)
--  Ce fichier vaut aussi spécification : chaque assertion dit une règle.
-- ============================================================================

\echo ''
\echo '-- A. Promotion : rien avant l''heure, tout après -----------------------'

do $$
declare
  v_cam  uuid := '11111111-1111-1111-1111-111111111111';
  v_hh   uuid;
  v_lait uuid := gen_random_uuid();
  v_n    int;
begin
  perform test_as(v_cam);
  perform create_household('Maison', 'Camille', '#0E8C7F');
  select household_id into v_hh from members where id = v_cam;

  insert into items (id, household_id, name, added_by) values (v_lait, v_hh, 'Lait', v_cam);
  perform set_item_bought(v_lait, true);

  select promote_bought_items() into v_n;
  perform test_eq(v_n, 0, 'acheté à l''instant : rien n''est promu');
  perform test_eq((select count(*)::int from products), 0, 'l''inventaire est encore vide');
  perform test_eq((select count(*)::int from items where id = v_lait), 1, 'l''article est resté dans la liste');

  perform test_backdate(v_lait, interval '2 hours');
  select promote_bought_items() into v_n;
  perform test_eq(v_n, 1, 'acheté il y a 2 h : promu');
  perform test_eq((select count(*)::int from items where id = v_lait), 0, 'il a quitté la liste');
  perform test_eq((select name from products), 'Lait'::text, 'le produit porte son nom');
  perform test_eq((select round(score, 6) from products), 1.0, 'premier achat : score 1');
  perform test_eq((select last_bought_by from products), v_cam, 'dernier acheteur mémorisé');
end $$;

\echo ''
\echo '-- B. Décocher avant l''heure ne laisse aucune trace ---------------------'

do $$
declare
  v_cam  uuid := '11111111-1111-1111-1111-111111111111';
  v_hh   uuid;
  v_pain uuid := gen_random_uuid();
  v_n    int;
begin
  perform test_as(v_cam);
  select household_id into v_hh from members where id = v_cam;

  insert into items (id, household_id, name, added_by) values (v_pain, v_hh, 'Pain', v_cam);
  perform set_item_bought(v_pain, true);
  perform set_item_bought(v_pain, false); -- « finalement non »

  select promote_bought_items() into v_n;
  perform test_eq(v_n, 0, 'rien n''est promu');
  perform test_eq((select count(*)::int from products where name_key = 'pain'), 0, 'aucun produit « Pain »');
  perform test_ok((select bought_at is null from items where id = v_pain), 'l''article est revenu « à acheter »');
end $$;

\echo ''
\echo '-- C. Dédoublonnage, orthographe, frécence -----------------------------'

do $$
declare
  v_cam uuid := '11111111-1111-1111-1111-111111111111';
  v_hh  uuid;
  v_a   uuid := gen_random_uuid();
  v_b   uuid := gen_random_uuid();
  v_n   int;
begin
  perform test_as(v_cam);
  select household_id into v_hh from members where id = v_cam;

  -- Deux achats du même produit, écrits différemment, 60 jours d'écart.
  insert into items (id, household_id, name, added_by, bought_at, bought_by) values
    (v_a, v_hh, 'Pâtes', v_cam, now() - interval '62 days', v_cam),
    (v_b, v_hh, 'pates', v_cam, now() - interval '2 days', v_cam);

  select promote_bought_items() into v_n;
  perform test_eq(v_n, 2, 'les deux achats sont promus');
  perform test_eq((select count(*)::int from products where name_key = 'pates'), 1,
                  'une seule ligne pour « Pâtes » et « pates »');
  perform test_eq((select name from products where name_key = 'pates'), 'Pâtes'::text,
                  'l''orthographe d''origine est conservée');
  perform test_eq((select round(score, 6) from products where name_key = 'pates'), 1.5,
                  '60 jours d''écart, demi-vie 60 jours : 1 × 0,5 + 1');
  perform test_ok((select last_bought_at > now() - interval '3 days' from products where name_key = 'pates'),
                  'la date retenue est celle du dernier achat');
end $$;

\echo ''
\echo '-- D. « Ajouter à la liste » copie, sans vider l''inventaire -------------'

do $$
declare
  v_cam  uuid := '11111111-1111-1111-1111-111111111111';
  v_hh   uuid;
  v_prod uuid;
  v_n    int;
begin
  perform test_as(v_cam);
  select household_id into v_hh from members where id = v_cam;
  select id into v_prod from products where name_key = 'lait';

  select add_products_to_list(array[v_prod]) into v_n;
  perform test_eq(v_n, 1, 'un article est créé dans la liste');
  perform test_eq((select count(*)::int from items
                    where household_id = v_hh and name = 'Lait' and bought_at is null), 1,
                  'il est « à acheter »');
  perform test_ok((select quantity is null from items
                    where name = 'Lait' and bought_at is null), 'sans quantité');
  perform test_eq((select count(*)::int from products where id = v_prod), 1,
                  'le produit est resté dans l''inventaire');
  perform test_eq((select round(score, 6) from products where id = v_prod), 1.0,
                  'et son score n''a pas bougé');

  select add_products_to_list(array[v_prod]) into v_n;
  perform test_eq(v_n, 0, 'déjà à acheter : pas de doublon dans la liste');
end $$;

\echo ''
\echo '-- E. Isolation entre foyers, vue par un vrai client --------------------'

do $$
declare
  v_ben uuid := '22222222-2222-2222-2222-222222222222';
  v_hh2 uuid;
  v_it  uuid := gen_random_uuid();
begin
  perform test_as(v_ben);
  perform create_household('Autre', 'Ben', '#5B6CD9');
  select household_id into v_hh2 from members where id = v_ben;

  insert into items (id, household_id, name, added_by, bought_at, bought_by)
    values (v_it, v_hh2, 'Lessive', v_ben, now() - interval '3 hours', v_ben);
  perform promote_bought_items();
  perform test_eq((select count(*)::int from products where name_key = 'lessive'), 1,
                  'Ben a son produit dans son foyer');
end $$;

-- On redevient Camille, puis on quitte le superutilisateur : RLS s'applique.
do $$ begin perform test_as('11111111-1111-1111-1111-111111111111'); end $$;
set role authenticated;

do $$
declare
  v_n int;
begin
  perform test_ok((select count(*) from products) > 0, 'Camille voit l''inventaire de son foyer');
  perform test_eq((select count(*)::int from products where name_key = 'lessive'), 0,
                  'le produit de l''autre foyer lui est invisible');

  delete from products where name_key = 'lessive';
  get diagnostics v_n = row_count;
  perform test_eq(v_n, 0, 'et elle ne peut pas le supprimer');

  delete from products where name_key = 'pates';
  get diagnostics v_n = row_count;
  perform test_eq(v_n, 1, 'alors que le sien, oui');
end $$;

reset role;
