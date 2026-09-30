-- ============================================================================
-- Virtual Places: bubble size and status notes, and music for the room.
--
--   * virtual_spaces.allow_bubble_resize: the room's creator decides whether people may resize their bubble.
--   * virtual_space_participants.bubble_scale / status: your bubble's size (0.6–1.8) and a short note
--     shown on it, changed only through set_virtual_space_look().
--   * virtual_space_music: what's playing in the room (a YouTube video). PLACES Pass members (and the
--     room's host or an admin) start or stop it through set_virtual_space_music(); everyone in the room
--     can see it and listen if they like.
--
-- Safe to run more than once. Adds columns and a table only.
-- ============================================================================

alter table public.virtual_spaces add column if not exists allow_bubble_resize boolean not null default true;

alter table public.virtual_space_participants add column if not exists bubble_scale real;
alter table public.virtual_space_participants add column if not exists status text;
alter table public.virtual_space_participants drop constraint if exists virtual_space_participants_look_check;
alter table public.virtual_space_participants add constraint virtual_space_participants_look_check
  check ((bubble_scale is null or bubble_scale between 0.6 and 1.8) and (status is null or char_length(status) between 1 and 60));

/** Your bubble's size and status note. Size resets to normal where the room doesn't allow resizing. */
create or replace function public.set_virtual_space_look(p_space_id uuid, p_scale real, p_status text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_resize boolean;
  v_status text := nullif(btrim(coalesce(p_status, '')), '');
begin
  if (select auth.uid()) is null then
    return false;
  end if;
  select allow_bubble_resize into v_resize from public.virtual_spaces where id = p_space_id;
  update public.virtual_space_participants
     set bubble_scale = case when coalesce(v_resize, false) and p_scale is not null then least(1.8, greatest(0.6, p_scale)) end,
         status = left(v_status, 60)
   where space_id = p_space_id
     and user_id = (select auth.uid())
     and last_seen_at >= now() - public.virtual_space_stale_after();
  return found;
end;
$$;

-- ---------------------------------------------------------------------------
-- Music in the room
-- ---------------------------------------------------------------------------
create table if not exists public.virtual_space_music (
  space_id    uuid primary key references public.virtual_spaces (id) on delete cascade,
  video_id    text not null check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  title       text not null default '' check (char_length(title) <= 120),
  started_by  uuid references auth.users (id) on delete set null,
  started_at  timestamptz not null default now()
);

alter table public.virtual_space_music enable row level security;

drop policy if exists "virtual_space_music: people in the room see it" on public.virtual_space_music;
create policy "virtual_space_music: people in the room see it"
  on public.virtual_space_music for select
  to authenticated
  using (public.in_virtual_space(space_id));
-- No insert/update/delete policies: music changes only through the function below.

/** Play (or, with a null video, stop) music for the room. PLACES Pass members, the room's host and admins may. */
create or replace function public.set_virtual_space_music(p_space_id uuid, p_video_id text, p_title text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not public.in_virtual_space(p_space_id) then
    raise exception 'Enter the room first.' using errcode = '42501';
  end if;
  if not (
    public.has_plan(v_uid::text, 'pass')
    or public.is_admin()
    or exists (select 1 from public.virtual_spaces where id = p_space_id and created_by = v_uid)
  ) then
    raise exception 'PLACES Pass members can play music for the room.' using errcode = '42501';
  end if;
  if p_video_id is null then
    delete from public.virtual_space_music where space_id = p_space_id;
    return;
  end if;
  if p_video_id !~ '^[A-Za-z0-9_-]{11}$' then
    raise exception 'That doesn’t look like a YouTube video.' using errcode = '22023';
  end if;
  insert into public.virtual_space_music (space_id, video_id, title, started_by, started_at)
  values (p_space_id, p_video_id, left(coalesce(p_title, ''), 120), v_uid, now())
  on conflict (space_id) do update
    set video_id = excluded.video_id, title = excluded.title, started_by = excluded.started_by, started_at = excluded.started_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------
revoke all on public.virtual_space_music from anon, authenticated;
grant select on public.virtual_space_music to authenticated;

revoke all on function public.set_virtual_space_look(uuid, real, text) from public, anon;
revoke all on function public.set_virtual_space_music(uuid, text, text) from public, anon;
grant execute on function public.set_virtual_space_look(uuid, real, text) to authenticated;
grant execute on function public.set_virtual_space_music(uuid, text, text) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'virtual_space_music') then
    alter publication supabase_realtime add table public.virtual_space_music;
  end if;
end
$$;
