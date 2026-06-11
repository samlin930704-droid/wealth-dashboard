create schema if not exists private;

drop function if exists public.get_wealth_snapshot(text);
drop function if exists public.upsert_wealth_snapshot(text, jsonb);
drop function if exists private.get_wealth_snapshot(text);
drop function if exists private.upsert_wealth_snapshot(text, jsonb);

create table if not exists private.wealth_snapshots (
  sync_space_id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

do $$
begin
  if to_regclass('public.wealth_snapshots') is not null then
    insert into private.wealth_snapshots (sync_space_id, payload, updated_at)
    select sync_space_id, payload, updated_at
    from public.wealth_snapshots
    on conflict (sync_space_id)
    do update set
      payload = excluded.payload,
      updated_at = excluded.updated_at;

    drop table public.wealth_snapshots;
  end if;
end $$;

alter table private.wealth_snapshots enable row level security;

revoke all on schema private from public, anon, authenticated;
revoke all on table private.wealth_snapshots from public, anon, authenticated;

create or replace function private.get_wealth_snapshot(p_sync_space_id text)
returns table(payload jsonb, updated_at timestamptz)
language plpgsql
security definer
set search_path = private
as $$
begin
  if length(trim(p_sync_space_id)) < 24 then
    raise exception 'sync_space_id must be at least 24 characters';
  end if;

  return query
  select ws.payload, ws.updated_at
  from private.wealth_snapshots as ws
  where ws.sync_space_id = p_sync_space_id
  limit 1;
end;
$$;

create or replace function private.upsert_wealth_snapshot(p_sync_space_id text, p_payload jsonb)
returns table(payload jsonb, updated_at timestamptz)
language plpgsql
security definer
set search_path = private
as $$
begin
  if length(trim(p_sync_space_id)) < 24 then
    raise exception 'sync_space_id must be at least 24 characters';
  end if;

  return query
  insert into private.wealth_snapshots as ws (sync_space_id, payload, updated_at)
  values (p_sync_space_id, p_payload, now())
  on conflict (sync_space_id)
  do update set
    payload = excluded.payload,
    updated_at = excluded.updated_at
  returning ws.payload, ws.updated_at;
end;
$$;

create or replace function public.get_wealth_snapshot(p_sync_space_id text)
returns table(payload jsonb, updated_at timestamptz)
language sql
security invoker
set search_path = public, private
as $$
  select * from private.get_wealth_snapshot(p_sync_space_id);
$$;

create or replace function public.upsert_wealth_snapshot(p_sync_space_id text, p_payload jsonb)
returns table(payload jsonb, updated_at timestamptz)
language sql
security invoker
set search_path = public, private
as $$
  select * from private.upsert_wealth_snapshot(p_sync_space_id, p_payload);
$$;

revoke execute on function private.get_wealth_snapshot(text) from public;
revoke execute on function private.upsert_wealth_snapshot(text, jsonb) from public;
revoke execute on function public.get_wealth_snapshot(text) from public;
revoke execute on function public.upsert_wealth_snapshot(text, jsonb) from public;

grant usage on schema private to anon;
grant execute on function private.get_wealth_snapshot(text) to anon;
grant execute on function private.upsert_wealth_snapshot(text, jsonb) to anon;
grant execute on function public.get_wealth_snapshot(text) to anon;
grant execute on function public.upsert_wealth_snapshot(text, jsonb) to anon;

notify pgrst, 'reload schema';
