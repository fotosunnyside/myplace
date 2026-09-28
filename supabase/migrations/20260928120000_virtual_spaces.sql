-- ============================================================================
-- PLACES · Virtual Spaces
--
-- Live places inside PLACES that people enter together (Town Hall, the
-- Accountability Room, and later course rooms, masterminds, study rooms...).
--
-- Supabase owns room configuration, presence, permissions and storage.
-- Live video/audio never passes through Supabase: a dedicated media provider
-- carries it, and the `virtual-space-token` Edge Function issues short-lived
-- provider tokens only to people this database has admitted to a room.
--
-- Nothing here is specific to a particular room: Town Hall and the
-- Accountability Room are just the first two official rows.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Admins
-- PLACES operators. Rows are added from the Supabase dashboard / SQL editor
-- (service role) only: there is no policy that lets anyone write this table
-- through the API. See README → "Virtual Spaces → Make someone an admin".
-- ---------------------------------------------------------------------------
create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  note       text,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

drop policy if exists "admin_users: read own row" on public.admin_users;
create policy "admin_users: read own row"
  on public.admin_users for select
  to authenticated
  using (user_id = (select auth.uid()));

/** True when the signed-in user is a PLACES admin. The single source of admin truth for RLS. */
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_users a where a.user_id = (select auth.uid()));
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Rooms
-- ---------------------------------------------------------------------------
create table if not exists public.virtual_spaces (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (char_length(btrim(name)) between 1 and 80),
  slug                text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 64),
  description         text not null default '' check (char_length(description) <= 280),
  room_type           text not null check (room_type in (
                        'social', 'accountability', 'course', 'membership', 'community', 'networking',
                        'mastermind', 'study', 'coworking', 'meeting', 'event', 'class')),
  -- Who may enter. Official launch rooms are 'members' (any registered PLACES user).
  visibility          text not null default 'members' check (visibility in ('public', 'members', 'private')),
  -- 'default' = the PLACES art for this room type, 'custom' = background_url, 'none' = a plain PLACES sky.
  background_style    text not null default 'default' check (background_style in ('default', 'custom', 'none')),
  background_url      text check (background_url is null or char_length(background_url) <= 2048),
  -- Object key inside the virtual-space-backgrounds bucket, so replaced images can be cleaned up.
  background_path     text check (background_path is null or char_length(background_path) <= 512),
  -- Focal point (percent) kept in view when the background is cropped to fit a screen.
  background_focus_x  smallint not null default 50 check (background_focus_x between 0 and 100),
  background_focus_y  smallint not null default 50 check (background_focus_y between 0 and 100),
  max_participants    integer not null default 20 check (max_participants between 2 and 500),
  is_active           boolean not null default true,
  allow_camera        boolean not null default true,
  allow_microphone    boolean not null default true,
  is_official         boolean not null default false,
  -- Official rooms get a special spot in the interface (lower sorts first).
  sort_order          integer not null default 100,
  -- Overflow instances ("Town Hall 2") point at their first room and are numbered.
  parent_space_id     uuid references public.virtual_spaces (id) on delete cascade,
  instance_number     integer not null default 1 check (instance_number >= 1),
  -- Room-type behaviour that doesn't need its own column yet, e.g.
  -- {"speaking_mode": "open" | "moderated", "welcome": "...", "zones": [...]}.
  settings            jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  created_by          uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint virtual_spaces_custom_background check (background_style <> 'custom' or background_url is not null)
);

create index if not exists virtual_spaces_listing_idx on public.virtual_spaces (is_official, sort_order);
create index if not exists virtual_spaces_parent_idx on public.virtual_spaces (parent_space_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists virtual_spaces_updated_at on public.virtual_spaces;
create trigger virtual_spaces_updated_at
  before update on public.virtual_spaces
  for each row execute function public.set_updated_at();

/**
 * Who may change a room's configuration.
 * Today: PLACES admins, for every room. When member-created rooms launch, extend this
 * (e.g. `or (not s.is_official and s.created_by = auth.uid())`) — policies and storage
 * rules below all go through it, so nothing else needs to change.
 */
create or replace function public.can_manage_virtual_space(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() and exists (select 1 from public.virtual_spaces s where s.id = p_space_id);
$$;

revoke all on function public.can_manage_virtual_space(uuid) from public;
grant execute on function public.can_manage_virtual_space(uuid) to authenticated;

/** Who may see a room exists. */
create or replace function public.can_view_virtual_space(s public.virtual_spaces)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- 'members' rooms are listed to everyone (so guests see what's on); entering them needs an account.
  -- 'private' rooms (reserved for member-created rooms) are visible to their managers only, for now.
  select s.visibility in ('public', 'members')
      or public.is_admin();
$$;

/** Who may enter a room right now (capacity is checked separately, atomically, on join). */
create or replace function public.can_enter_virtual_space(s public.virtual_spaces)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
     and s.is_active
     and (s.visibility in ('public', 'members') or public.is_admin());
  -- Visibility 'public' is reserved for rooms guests may enter once guest media is supported.
$$;

revoke all on function public.can_view_virtual_space(public.virtual_spaces) from public;
revoke all on function public.can_enter_virtual_space(public.virtual_spaces) from public;
grant execute on function public.can_view_virtual_space(public.virtual_spaces) to anon, authenticated;
grant execute on function public.can_enter_virtual_space(public.virtual_spaces) to authenticated;

alter table public.virtual_spaces enable row level security;

-- Guests can see official rooms on YourPlace (and that they're closed); entering needs an account.
drop policy if exists "virtual_spaces: read visible rooms" on public.virtual_spaces;
create policy "virtual_spaces: read visible rooms"
  on public.virtual_spaces for select
  to anon, authenticated
  using (public.can_view_virtual_space(virtual_spaces));

-- Creating rooms is admin-only until member-created rooms launch.
drop policy if exists "virtual_spaces: admins create" on public.virtual_spaces;
create policy "virtual_spaces: admins create"
  on public.virtual_spaces for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "virtual_spaces: managers update" on public.virtual_spaces;
create policy "virtual_spaces: managers update"
  on public.virtual_spaces for update
  to authenticated
  using (public.can_manage_virtual_space(id))
  with check (public.can_manage_virtual_space(id));

drop policy if exists "virtual_spaces: admins delete" on public.virtual_spaces;
create policy "virtual_spaces: admins delete"
  on public.virtual_spaces for delete
  to authenticated
  using (public.is_admin() and not is_official);

/** Nobody (admins included) can quietly flip a room official or take over its authorship via the API. */
create or replace function public.guard_virtual_space_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.role()) in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.created_by := (select auth.uid());
    else
      if new.created_by is distinct from old.created_by then
        raise exception 'created_by cannot be changed' using errcode = '42501';
      end if;
      if new.is_official is distinct from old.is_official then
        raise exception 'is_official cannot be changed from the app' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists virtual_spaces_guard_identity on public.virtual_spaces;
create trigger virtual_spaces_guard_identity
  before insert or update on public.virtual_spaces
  for each row execute function public.guard_virtual_space_identity();

-- ---------------------------------------------------------------------------
-- Presence
--
-- One row per person currently in a room. Rows are only written by the
-- security-definer functions below, which lock the room row so capacity
-- can't be overrun by simultaneous joins. A person counts as present while
-- their client keeps heartbeating; rows older than the stale window are
-- ignored everywhere and cleaned up on the next join, so a closed laptop
-- or dropped connection can't leave a ghost that fills the room.
-- ---------------------------------------------------------------------------
create table if not exists public.virtual_space_participants (
  space_id      uuid not null references public.virtual_spaces (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  display_name  text not null check (char_length(display_name) between 1 and 60),
  avatar_url    text check (avatar_url is null or char_length(avatar_url) <= 512),
  camera_on     boolean not null default false,
  mic_on        boolean not null default false,
  -- Reserved for spatial conversation circles inside a room.
  zone          text check (zone is null or char_length(zone) <= 40),
  -- Reserved for moderated rooms: 'participant' | 'speaker' | 'moderator'.
  role          text not null default 'participant' check (role in ('participant', 'speaker', 'moderator')),
  joined_at     timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  primary key (space_id, user_id)
);

create index if not exists virtual_space_participants_seen_idx on public.virtual_space_participants (space_id, last_seen_at);

alter table public.virtual_space_participants enable row level security;

-- Registered people can see who's in rooms they can see (needed for presence and live updates).
drop policy if exists "virtual_space_participants: read" on public.virtual_space_participants;
create policy "virtual_space_participants: read"
  on public.virtual_space_participants for select
  to authenticated
  using (exists (select 1 from public.virtual_spaces s where s.id = space_id and public.can_view_virtual_space(s)));
-- No insert/update/delete policies: presence changes only through the functions below.

/** How long without a heartbeat before someone no longer counts as in the room. */
create or replace function public.virtual_space_stale_after()
returns interval
language sql
immutable
as $$ select interval '45 seconds' $$;

/**
 * Enter a room. Atomic: the room row is locked for the duration, so two people
 * racing for the last place can't both get in. Re-entering (another tab, a
 * reconnect) refreshes the existing place instead of taking a second one.
 * Errors: PLC01 not signed in · PLC02 no such room · PLC03 closed · PLC04 full.
 */
create or replace function public.join_virtual_space(
  p_space_id uuid,
  p_display_name text default null,
  p_avatar_url text default null
)
returns public.virtual_space_participants
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_space public.virtual_spaces;
  v_count integer;
  v_name  text;
  v_row   public.virtual_space_participants;
begin
  if v_uid is null then
    raise exception 'Sign in to enter this room.' using errcode = 'PLC01';
  end if;

  select * into v_space from public.virtual_spaces where id = p_space_id for update;
  if not found or not public.can_view_virtual_space(v_space) then
    raise exception 'This room does not exist.' using errcode = 'PLC02';
  end if;
  if not public.can_enter_virtual_space(v_space) then
    raise exception 'This room is currently closed.' using errcode = 'PLC03';
  end if;

  delete from public.virtual_space_participants
   where space_id = p_space_id and last_seen_at < now() - public.virtual_space_stale_after();

  if not exists (select 1 from public.virtual_space_participants where space_id = p_space_id and user_id = v_uid) then
    select count(*) into v_count from public.virtual_space_participants where space_id = p_space_id;
    if v_count >= v_space.max_participants then
      raise exception 'This room is currently full.' using errcode = 'PLC04';
    end if;
  end if;

  v_name := left(btrim(coalesce(
    nullif(btrim(p_display_name), ''),
    (select auth.jwt()) -> 'user_metadata' ->> 'name',
    split_part((select auth.jwt()) ->> 'email', '@', 1),
    'Someone'
  )), 60);

  insert into public.virtual_space_participants as p (space_id, user_id, display_name, avatar_url, camera_on, mic_on, joined_at, last_seen_at)
  values (
    p_space_id, v_uid, v_name,
    case when p_avatar_url ~ '^(https://|/)[^\s]{0,500}$' then p_avatar_url end,
    false, false, now(), now()
  )
  on conflict (space_id, user_id) do update
    set display_name = excluded.display_name,
        avatar_url   = excluded.avatar_url,
        last_seen_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

/**
 * Heartbeat from someone in a room, carrying their camera/mic state.
 * Returns false when they are no longer admitted (timed out, room closed) — the client then rejoins or leaves.
 * Camera/mic can only be reported on when the room currently allows them.
 */
create or replace function public.touch_virtual_space(
  p_space_id uuid,
  p_camera_on boolean default false,
  p_mic_on boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_space public.virtual_spaces;
begin
  if v_uid is null then
    return false;
  end if;
  select * into v_space from public.virtual_spaces where id = p_space_id;
  if not found or not public.can_enter_virtual_space(v_space) then
    delete from public.virtual_space_participants where space_id = p_space_id and user_id = v_uid;
    return false;
  end if;

  update public.virtual_space_participants
     set last_seen_at = now(),
         camera_on = coalesce(p_camera_on, false) and v_space.allow_camera,
         mic_on = coalesce(p_mic_on, false) and v_space.allow_microphone
   where space_id = p_space_id
     and user_id = v_uid
     and last_seen_at >= now() - public.virtual_space_stale_after();
  return found;
end;
$$;

create or replace function public.leave_virtual_space(p_space_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.virtual_space_participants where space_id = p_space_id and user_id = (select auth.uid());
$$;

/** Who is in a room right now (fresh rows only). */
create or replace function public.virtual_space_roster(p_space_id uuid)
returns setof public.virtual_space_participants
language sql
stable
security definer
set search_path = ''
as $$
  select p.*
    from public.virtual_space_participants p
    join public.virtual_spaces s on s.id = p.space_id
   where p.space_id = p_space_id
     and (select auth.uid()) is not null
     and public.can_view_virtual_space(s)
     and p.last_seen_at >= now() - public.virtual_space_stale_after()
   order by p.joined_at;
$$;

/** Live head-counts for every room the caller can see. Counts only — no names — so guests can see them too. */
create or replace function public.virtual_space_occupancy()
returns table (space_id uuid, participant_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, count(p.user_id)::integer
    from public.virtual_spaces s
    left join public.virtual_space_participants p
      on p.space_id = s.id and p.last_seen_at >= now() - public.virtual_space_stale_after()
   where public.can_view_virtual_space(s)
   group by s.id;
$$;

/**
 * Used by the virtual-space-token Edge Function before minting a media token:
 * the caller must currently hold a place in the room, and gets only the
 * publish rights the room allows.
 */
create or replace function public.virtual_space_media_grant(p_space_id uuid)
returns table (space_id uuid, user_id uuid, display_name text, can_publish_video boolean, can_publish_audio boolean, role text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, p.user_id, p.display_name, s.allow_camera, s.allow_microphone, p.role
    from public.virtual_spaces s
    join public.virtual_space_participants p on p.space_id = s.id
   where s.id = p_space_id
     and p.user_id = (select auth.uid())
     and p.last_seen_at >= now() - public.virtual_space_stale_after()
     and public.can_enter_virtual_space(s);
$$;

revoke all on function public.join_virtual_space(uuid, text, text) from public;
revoke all on function public.touch_virtual_space(uuid, boolean, boolean) from public;
revoke all on function public.leave_virtual_space(uuid) from public;
revoke all on function public.virtual_space_roster(uuid) from public;
revoke all on function public.virtual_space_occupancy() from public;
revoke all on function public.virtual_space_media_grant(uuid) from public;
-- Supabase grants anon execute on new public functions by default: take it back where an account is required.
revoke execute on function public.join_virtual_space(uuid, text, text) from anon;
revoke execute on function public.touch_virtual_space(uuid, boolean, boolean) from anon;
revoke execute on function public.leave_virtual_space(uuid) from anon;
revoke execute on function public.virtual_space_roster(uuid) from anon;
revoke execute on function public.virtual_space_media_grant(uuid) from anon;
revoke execute on function public.can_manage_virtual_space(uuid) from anon;
revoke execute on function public.can_enter_virtual_space(public.virtual_spaces) from anon;
grant execute on function public.join_virtual_space(uuid, text, text) to authenticated;
grant execute on function public.touch_virtual_space(uuid, boolean, boolean) to authenticated;
grant execute on function public.leave_virtual_space(uuid) to authenticated;
grant execute on function public.virtual_space_roster(uuid) to authenticated;
grant execute on function public.virtual_space_occupancy() to anon, authenticated;
grant execute on function public.virtual_space_media_grant(uuid) to authenticated;

-- When a room closes, everyone inside is released (lowering capacity only stops new arrivals).
create or replace function public.release_closed_virtual_space()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_active and not new.is_active then
    delete from public.virtual_space_participants where space_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists virtual_spaces_release_closed on public.virtual_spaces;
create trigger virtual_spaces_release_closed
  after update of is_active on public.virtual_spaces
  for each row execute function public.release_closed_virtual_space();

-- ---------------------------------------------------------------------------
-- Realtime: open rooms and YourPlace cards update live when admins change
-- a room or people come and go.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'virtual_spaces') then
      alter publication supabase_realtime add table public.virtual_spaces;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'virtual_space_participants') then
      alter publication supabase_realtime add table public.virtual_space_participants;
    end if;
  end if;
end;
$$;

-- Deletes carry the full old row so clients know who left.
alter table public.virtual_space_participants replica identity full;

-- ---------------------------------------------------------------------------
-- Storage: room backgrounds
-- Public read (backgrounds are part of the room). Writes only by people who
-- can manage the room the file belongs to: objects live at `<space_id>/<file>`.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('virtual-space-backgrounds', 'virtual-space-backgrounds', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_manage_virtual_space_object(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_folder text := split_part(p_name, '/', 1);
begin
  if v_folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.can_manage_virtual_space(v_folder::uuid);
end;
$$;

revoke all on function public.can_manage_virtual_space_object(text) from public;
revoke execute on function public.can_manage_virtual_space_object(text) from anon;
grant execute on function public.can_manage_virtual_space_object(text) to authenticated;

drop policy if exists "virtual-space-backgrounds: read" on storage.objects;
create policy "virtual-space-backgrounds: read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'virtual-space-backgrounds');

drop policy if exists "virtual-space-backgrounds: managers upload" on storage.objects;
create policy "virtual-space-backgrounds: managers upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'virtual-space-backgrounds' and public.can_manage_virtual_space_object(name));

drop policy if exists "virtual-space-backgrounds: managers update" on storage.objects;
create policy "virtual-space-backgrounds: managers update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'virtual-space-backgrounds' and public.can_manage_virtual_space_object(name))
  with check (bucket_id = 'virtual-space-backgrounds' and public.can_manage_virtual_space_object(name));

drop policy if exists "virtual-space-backgrounds: managers delete" on storage.objects;
create policy "virtual-space-backgrounds: managers delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'virtual-space-backgrounds' and public.can_manage_virtual_space_object(name));

-- ---------------------------------------------------------------------------
-- Launch rooms. Capacities are defaults only: admins change them in
-- Admin → Virtual Spaces, and the app always reads them from here.
-- ---------------------------------------------------------------------------
insert into public.virtual_spaces
  (name, slug, description, room_type, visibility, max_participants, is_active, allow_camera, allow_microphone, is_official, sort_order, settings)
values
  ('Town Hall', 'town-hall', 'See who''s around. Drop in and say hello.', 'social', 'members', 20, true, true, true, true, 10,
   '{"speaking_mode": "open"}'::jsonb),
  ('Accountability Room', 'accountability-room', 'Bring your work. Stay focused together.', 'accountability', 'members', 20, true, true, true, true, 20,
   '{"speaking_mode": "open", "welcome": "Bring something you need to finish. Work quietly alongside other people and get it done."}'::jsonb)
on conflict (slug) do nothing;
