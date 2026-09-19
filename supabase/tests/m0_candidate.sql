begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner-a@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'owner-b@example.test', now(), now());

insert into public.workspaces (id, name)
values
  ('11000000-0000-4000-8000-000000000001', 'Workspace A'),
  ('11000000-0000-4000-8000-000000000002', 'Workspace B');

insert into public.workspace_members (workspace_id, user_id, role)
values
  ('11000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'owner'),
  ('11000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'owner');

insert into public.ebay_stores (id, workspace_id, ebay_user_id)
values
  ('22000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 'seller-a'),
  ('22000000-0000-4000-8000-000000000002', '11000000-0000-4000-8000-000000000002', 'seller-b');

insert into public.orders (
  id,
  store_id,
  ebay_order_id,
  creation_time,
  last_modified_time,
  currency,
  total_minor
)
values
  (
    '33000000-0000-4000-8000-000000000001',
    '22000000-0000-4000-8000-000000000001',
    'order-a',
    now(),
    now(),
    'EUR',
    1000
  ),
  (
    '33000000-0000-4000-8000-000000000002',
    '22000000-0000-4000-8000-000000000002',
    'order-b',
    now(),
    now(),
    'EUR',
    2000
  );

insert into public.tax_identifiers (order_id, identifier_type, issuing_country, value, observed_at)
values
  ('33000000-0000-4000-8000-000000000001', 'VAT', 'IT', 'TEST-A', now()),
  ('33000000-0000-4000-8000-000000000002', 'VAT', 'IT', 'TEST-B', now());

insert into public.free_cycles (id, workspace_id, starts_at, ends_at, quota)
values
  (
    '44000000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000001',
    now() - interval '1 hour',
    now() + interval '1 hour',
    1
  );

select is(
  has_table_privilege('authenticated', 'public.order_grants', 'INSERT'),
  false,
  'Il client non può inserire grant direttamente'
);
select ok(
  has_function_privilege('authenticated', 'public.grant_free_order(uuid,uuid)', 'EXECUTE'),
  'Il client autenticato può invocare lo sblocco controllato'
);
select is(
  has_function_privilege('anon', 'public.grant_free_order(uuid,uuid)', 'EXECUTE'),
  false,
  'Il ruolo anonimo non può invocare lo sblocco'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is((select count(*) from public.orders), 1::bigint, 'RLS limita gli ordini al tenant');
select is((select count(*) from public.tax_identifiers), 0::bigint, 'Gli identificativi restano bloccati');
select ok(
  public.grant_free_order(
    '33000000-0000-4000-8000-000000000001',
    '44000000-0000-4000-8000-000000000001'
  ) is not null,
  'Lo sblocco autorizzato crea un grant'
);
select is((select count(*) from public.tax_identifiers), 1::bigint, 'Il grant espone il solo identificativo autorizzato');
select is(
  (select used from public.free_cycles where id = '44000000-0000-4000-8000-000000000001'),
  1,
  'Lo sblocco consuma la quota una volta'
);
select throws_ok(
  $$select public.grant_free_order(
    '33000000-0000-4000-8000-000000000002',
    '44000000-0000-4000-8000-000000000001'
  )$$,
  '42501',
  'order_not_accessible',
  'Lo sblocco cross-tenant viene negato'
);
select throws_ok(
  $$select public.grant_free_order(
    '33000000-0000-4000-8000-000000000001',
    '44000000-0000-4000-8000-000000000001'
  )$$,
  'P0001',
  'free_quota_exhausted',
  'La quota esaurita non crea un secondo grant'
);

select * from finish();

rollback;
