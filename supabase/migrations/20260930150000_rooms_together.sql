-- ============================================================================
-- Virtual Places, together: move your circle, chat, and see and hear the people near you.
--
--   * Where you stand: virtual_space_participants.pos_x / pos_y (0–1 across the room), changed only
--     through move_in_virtual_space().
--   * Room chat: virtual_space_messages, readable by the people in the room, written only through
--     send_virtual_space_message().
--   * Live video/audio goes person to person (WebRTC). The browsers introduce themselves through
--     virtual_space_signals: only someone in the room can send, only to someone in the same room, and
--     only the recipient can read. Media itself never touches the database.
--
-- Safe to run more than once. Adds columns and tables only.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Where you stand
-- ---------------------------------------------------------------------------
alter table public.virtual_space_participants add column if not exists pos_x real;
alter table public.virtual_space_participants add column if not exists pos_y real;
alter table public.virtual_space_participants drop constraint if exists virtual_space_participants_pos_check;
alter table public.virtual_space_participants add constraint virtual_space_participants_pos_check
  check ((pos_x is null or pos_x between 0 and 1) and (pos_y is null or pos_y between 0 and 1));

/** Move your own circle. False when you're not (or no longer) in the room. */
create or replace function public.move_in_virtual_space(p_space_id uuid, p_x real, p_y real)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or p_x is null or p_y is null then
    return false;
  end if;
  update public.virtual_space_participants
     set pos_x = least(1, greatest(0, p_x)),
         pos_y = least(1, greatest(0, p_y))
   where space_id = p_space_id
     and user_id = (select auth.uid())
     and last_seen_at >= now() - public.virtual_space_stale_after();
  return found;
end;
$$;

/** True when the caller currently holds a place in the room. */
create or replace function public.in_virtual_space(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.virtual_space_participants
     where space_id = p_space_id
       and user_id = (select auth.uid())
       and last_seen_at >= now() - public.virtual_space_stale_after()
  );
$$;

-- ---------------------------------------------------------------------------
-- Room chat
-- ---------------------------------------------------------------------------
create table if not exists public.virtual_space_messages (
  id            uuid primary key default gen_random_uuid(),
  space_id      uuid not null references public.virtual_spaces (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  display_name  text not null check (char_length(display_name) between 1 and 60),
  body          text not null check (char_length(body) between 1 and 500),
  created_at    timestamptz not null default now()
);
create index if not exists virtual_space_messages_room_idx on public.virtual_space_messages (space_id, created_at desc);

alter table public.virtual_space_messages enable row level security;

drop policy if exists "virtual_space_messages: people in the room read" on public.virtual_space_messages;
create policy "virtual_space_messages: people in the room read"
  on public.virtual_space_messages for select
  to authenticated
  using (public.in_virtual_space(space_id));
-- No insert/update/delete policies: messages are sent only through the function below.

/** Say something to the room. Your name comes from your place in the room, never from the browser. */
create or replace function public.send_virtual_space_message(p_space_id uuid, p_body text)
returns public.virtual_space_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_name text;
  v_body text := btrim(coalesce(p_body, ''));
  v_row  public.virtual_space_messages;
begin
  select display_name into v_name from public.virtual_space_participants
   where space_id = p_space_id and user_id = v_uid and last_seen_at >= now() - public.virtual_space_stale_after();
  if v_uid is null or v_name is null then
    raise exception 'Enter the room to chat.' using errcode = '42501';
  end if;
  if char_length(v_body) = 0 then
    raise exception 'Write a message first.' using errcode = '22023';
  end if;
  -- A short memory: rooms keep the last day of chat.
  delete from public.virtual_space_messages where space_id = p_space_id and created_at < now() - interval '1 day';
  insert into public.virtual_space_messages (space_id, user_id, display_name, body)
  values (p_space_id, v_uid, v_name, left(v_body, 500))
  returning * into v_row;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Introductions for person-to-person video/audio
-- ---------------------------------------------------------------------------
create table if not exists public.virtual_space_signals (
  id          bigint generated always as identity primary key,
  space_id    uuid not null references public.virtual_spaces (id) on delete cascade,
  from_user   uuid not null references auth.users (id) on delete cascade,
  to_user     uuid not null references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('offer', 'answer', 'ice', 'bye')),
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists virtual_space_signals_to_idx on public.virtual_space_signals (to_user, created_at);

alter table public.virtual_space_signals enable row level security;

drop policy if exists "virtual_space_signals: recipient reads" on public.virtual_space_signals;
create policy "virtual_space_signals: recipient reads"
  on public.virtual_space_signals for select
  to authenticated
  using (to_user = (select auth.uid()));

/** Pass a connection message to someone else in the same room. */
create or replace function public.send_virtual_space_signal(p_space_id uuid, p_to uuid, p_kind text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or p_to is null or p_to = v_uid or not public.in_virtual_space(p_space_id) then
    raise exception 'Enter the room first.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.virtual_space_participants
     where space_id = p_space_id and user_id = p_to and last_seen_at >= now() - public.virtual_space_stale_after()
  ) then
    return; -- they've gone; nothing to say
  end if;
  if octet_length(coalesce(p_payload, '{}'::jsonb)::text) > 16384 then
    raise exception 'Message too large.' using errcode = '22023';
  end if;
  delete from public.virtual_space_signals where created_at < now() - interval '2 minutes';
  insert into public.virtual_space_signals (space_id, from_user, to_user, kind, payload)
  values (p_space_id, v_uid, p_to, p_kind, coalesce(p_payload, '{}'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------
revoke all on public.virtual_space_messages, public.virtual_space_signals from anon, authenticated;
grant select on public.virtual_space_messages, public.virtual_space_signals to authenticated;

revoke all on function public.move_in_virtual_space(uuid, real, real) from public, anon;
revoke all on function public.in_virtual_space(uuid) from public, anon;
revoke all on function public.send_virtual_space_message(uuid, text) from public, anon;
revoke all on function public.send_virtual_space_signal(uuid, uuid, text, jsonb) from public, anon;
grant execute on function public.move_in_virtual_space(uuid, real, real) to authenticated;
grant execute on function public.in_virtual_space(uuid) to authenticated;
grant execute on function public.send_virtual_space_message(uuid, text) to authenticated;
grant execute on function public.send_virtual_space_signal(uuid, uuid, text, jsonb) to authenticated;

-- Live updates for chat and introductions.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'virtual_space_messages') then
      alter publication supabase_realtime add table public.virtual_space_messages;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'virtual_space_signals') then
      alter publication supabase_realtime add table public.virtual_space_signals;
    end if;
  end if;
end
$$;
