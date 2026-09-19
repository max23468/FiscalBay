create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin')),
  primary key (workspace_id, user_id)
);

create table public.ebay_stores (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ebay_user_id text not null unique check (btrim(ebay_user_id) <> ''),
  linked_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.ebay_stores(id) on delete cascade,
  ebay_order_id text not null check (btrim(ebay_order_id) <> ''),
  creation_time timestamptz not null,
  last_modified_time timestamptz not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  total_minor bigint not null check (total_minor >= 0),
  unique (store_id, ebay_order_id)
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  line_item_id text not null check (btrim(line_item_id) <> ''),
  sku text,
  title text not null,
  quantity integer not null check (quantity > 0),
  unit_minor bigint not null check (unit_minor >= 0),
  unique (order_id, line_item_id)
);

create table public.tax_identifiers (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  identifier_type text not null check (btrim(identifier_type) <> ''),
  issuing_country text not null check (issuing_country ~ '^[A-Z]{2}$'),
  value text not null check (btrim(value) <> ''),
  observed_at timestamptz not null,
  unique (order_id, identifier_type, issuing_country, value)
);

create table public.free_cycles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  quota integer not null check (quota > 0),
  used integer not null default 0 check (used >= 0 and used <= quota),
  check (ends_at > starts_at),
  unique (workspace_id, starts_at)
);

create table public.order_grants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  cycle_id uuid references public.free_cycles(id),
  source text not null check (source in ('free_cycle', 'premium', 'trial', 'lifetime', 'admin')),
  granted_at timestamptz not null default now(),
  unique (workspace_id, order_id),
  check ((source = 'free_cycle') = (cycle_id is not null))
);

create table public.sync_state (
  store_id uuid primary key references public.ebay_stores(id) on delete cascade,
  cursor text,
  last_success_at timestamptz,
  updated_at timestamptz not null default now()
);

create index workspace_members_user_idx on public.workspace_members(user_id, workspace_id);
create index ebay_stores_workspace_idx on public.ebay_stores(workspace_id);
create index orders_store_modified_idx on public.orders(store_id, last_modified_time desc);
create index order_items_order_idx on public.order_items(order_id);
create index tax_identifiers_order_idx on public.tax_identifiers(order_id);
create index free_cycles_workspace_period_idx on public.free_cycles(workspace_id, starts_at, ends_at);
create index order_grants_order_idx on public.order_grants(order_id, workspace_id);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.ebay_stores enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.tax_identifiers enable row level security;
alter table public.free_cycles enable row level security;
alter table public.order_grants enable row level security;
alter table public.sync_state enable row level security;

revoke all on table public.workspaces from anon, authenticated;
revoke all on table public.workspace_members from anon, authenticated;
revoke all on table public.ebay_stores from anon, authenticated;
revoke all on table public.orders from anon, authenticated;
revoke all on table public.order_items from anon, authenticated;
revoke all on table public.tax_identifiers from anon, authenticated;
revoke all on table public.free_cycles from anon, authenticated;
revoke all on table public.order_grants from anon, authenticated;
revoke all on table public.sync_state from anon, authenticated;

grant select on table public.workspaces to authenticated;
grant select on table public.workspace_members to authenticated;
grant select on table public.ebay_stores to authenticated;
grant select on table public.orders to authenticated;
grant select on table public.order_items to authenticated;
grant select on table public.tax_identifiers to authenticated;
grant select on table public.free_cycles to authenticated;
grant select on table public.order_grants to authenticated;
grant select on table public.sync_state to authenticated;

create policy "members read own memberships"
on public.workspace_members for select
to authenticated
using (user_id = (select auth.uid()));

create policy "members read workspaces"
on public.workspaces for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_members membership
    where membership.workspace_id = workspaces.id
      and membership.user_id = (select auth.uid())
  )
);

create policy "members read stores"
on public.ebay_stores for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_members membership
    where membership.workspace_id = ebay_stores.workspace_id
      and membership.user_id = (select auth.uid())
  )
);

create policy "members read orders"
on public.orders for select
to authenticated
using (
  exists (
    select 1
    from public.ebay_stores store
    join public.workspace_members membership on membership.workspace_id = store.workspace_id
    where store.id = orders.store_id
      and membership.user_id = (select auth.uid())
  )
);

create policy "members read order items"
on public.order_items for select
to authenticated
using (
  exists (
    select 1
    from public.orders parent_order
    join public.ebay_stores store on store.id = parent_order.store_id
    join public.workspace_members membership on membership.workspace_id = store.workspace_id
    where parent_order.id = order_items.order_id
      and membership.user_id = (select auth.uid())
  )
);

create policy "members read unlocked tax identifiers"
on public.tax_identifiers for select
to authenticated
using (
  exists (
    select 1
    from public.orders parent_order
    join public.ebay_stores store on store.id = parent_order.store_id
    join public.workspace_members membership on membership.workspace_id = store.workspace_id
    join public.order_grants access_grant
      on access_grant.workspace_id = store.workspace_id
     and access_grant.order_id = parent_order.id
    where parent_order.id = tax_identifiers.order_id
      and membership.user_id = (select auth.uid())
  )
);

create policy "members read free cycles"
on public.free_cycles for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_members membership
    where membership.workspace_id = free_cycles.workspace_id
      and membership.user_id = (select auth.uid())
  )
);

create policy "members read grants"
on public.order_grants for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_members membership
    where membership.workspace_id = order_grants.workspace_id
      and membership.user_id = (select auth.uid())
  )
);

create policy "members read sync state"
on public.sync_state for select
to authenticated
using (
  exists (
    select 1
    from public.ebay_stores store
    join public.workspace_members membership on membership.workspace_id = store.workspace_id
    where store.id = sync_state.store_id
      and membership.user_id = (select auth.uid())
  )
);

create or replace function public.grant_free_order(p_order_id uuid, p_cycle_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_workspace_id uuid;
  created_grant_id uuid;
begin
  if caller_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select store.workspace_id
  into target_workspace_id
  from public.orders target_order
  join public.ebay_stores store on store.id = target_order.store_id
  join public.workspace_members membership on membership.workspace_id = store.workspace_id
  where target_order.id = p_order_id
    and membership.user_id = caller_id;

  if target_workspace_id is null then
    raise exception 'order_not_accessible' using errcode = '42501';
  end if;

  perform 1
  from public.free_cycles cycle
  where cycle.id = p_cycle_id
    and cycle.workspace_id = target_workspace_id
    and cycle.starts_at <= now()
    and cycle.ends_at > now()
    and cycle.used < cycle.quota
  for update;

  if not found then
    raise exception 'free_quota_exhausted' using errcode = 'P0001';
  end if;

  insert into public.order_grants (workspace_id, order_id, cycle_id, source)
  values (target_workspace_id, p_order_id, p_cycle_id, 'free_cycle')
  returning id into created_grant_id;

  update public.free_cycles
  set used = used + 1
  where id = p_cycle_id;

  return created_grant_id;
end;
$$;

revoke all on function public.grant_free_order(uuid, uuid) from public, anon;
grant execute on function public.grant_free_order(uuid, uuid) to authenticated;
