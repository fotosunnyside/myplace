-- ============================================================================
-- Room music from PLACES's own library instead of YouTube.
--
--   * room_tracks: songs PLACES admins upload (with the licence they're used under) to the public
--     room-music bucket. Everyone signed in can see the active ones; only admins change them.
--   * virtual_space_music gains track_id; set_virtual_space_track() plays one of them for a room
--     (PLACES Pass members, the room's host and admins, as before). YouTube playback is switched off.
--
-- Safe to run more than once. No member content is dropped: what's playing in a room is live state.
-- ============================================================================

create table if not exists public.room_tracks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(btrim(title)) between 1 and 120),
  artist      text not null default '' check (char_length(artist) <= 120),
  -- Where the track comes from and under what terms PLACES may play it in rooms.
  license     text not null default '' check (char_length(license) <= 300),
  path        text not null unique check (char_length(path) between 1 and 512),
  url         text not null check (char_length(url) between 1 and 2048),
  duration_s  integer check (duration_s is null or duration_s between 1 and 36000),
  is_active   boolean not null default true,
  sort_order  integer not null default 100,
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);

alter table public.room_tracks enable row level security;

drop policy if exists "room_tracks: members see active tracks" on public.room_tracks;
create policy "room_tracks: members see active tracks"
  on public.room_tracks for select
  to authenticated
  using (is_active or public.is_admin());

drop policy if exists "room_tracks: admins add" on public.room_tracks;
create policy "room_tracks: admins add"
  on public.room_tracks for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "room_tracks: admins change" on public.room_tracks;
create policy "room_tracks: admins change"
  on public.room_tracks for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "room_tracks: admins remove" on public.room_tracks;
create policy "room_tracks: admins remove"
  on public.room_tracks for delete
  to authenticated
  using (public.is_admin());

revoke all on public.room_tracks from anon, authenticated;
grant select, delete on public.room_tracks to authenticated;
grant insert (title, artist, license, path, url, duration_s, is_active, sort_order) on public.room_tracks to authenticated;
grant update (title, artist, license, duration_s, is_active, sort_order) on public.room_tracks to authenticated;

-- ---------------------------------------------------------------------------
-- The files: public to play, admins upload
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('room-music', 'room-music', true, 20971520, array['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/webm'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "room-music: read" on storage.objects;
create policy "room-music: read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'room-music');

drop policy if exists "room-music: admins upload" on storage.objects;
create policy "room-music: admins upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'room-music' and public.is_admin());

drop policy if exists "room-music: admins update" on storage.objects;
create policy "room-music: admins update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'room-music' and public.is_admin())
  with check (bucket_id = 'room-music' and public.is_admin());

drop policy if exists "room-music: admins delete" on storage.objects;
create policy "room-music: admins delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'room-music' and public.is_admin());

-- ---------------------------------------------------------------------------
-- What a room plays: a library track
-- ---------------------------------------------------------------------------
alter table public.virtual_space_music add column if not exists track_id uuid references public.room_tracks (id) on delete cascade;
alter table public.virtual_space_music alter column video_id drop not null;
-- YouTube is gone: stop anything still playing from it.
delete from public.virtual_space_music where track_id is null;

/** Play (or, with a null track, stop) a library track for the room. PLACES Pass members, the room's host and admins may. */
create or replace function public.set_virtual_space_track(p_space_id uuid, p_track_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_title text;
begin
  if v_uid is null or not public.in_virtual_space(p_space_id) then
    raise exception 'Step into the room first.' using errcode = '42501';
  end if;
  if not (
    public.has_plan(v_uid::text, 'pass')
    or public.is_admin()
    or exists (select 1 from public.virtual_spaces s where s.id = p_space_id and s.created_by = v_uid)
  ) then
    raise exception 'PLACES Pass members can play music for the room.' using errcode = '42501';
  end if;
  if p_track_id is null then
    delete from public.virtual_space_music where space_id = p_space_id;
    return;
  end if;
  select t.title into v_title from public.room_tracks t where t.id = p_track_id and t.is_active;
  if v_title is null then
    raise exception 'That track isn’t available.' using errcode = 'P0002';
  end if;
  insert into public.virtual_space_music (space_id, video_id, track_id, title, started_by, started_at)
  values (p_space_id, null, p_track_id, v_title, v_uid, now())
  on conflict (space_id) do update
    set video_id = null, track_id = excluded.track_id, title = excluded.title, started_by = excluded.started_by, started_at = excluded.started_at;
end;
$$;

revoke all on function public.set_virtual_space_track(uuid, uuid) from public, anon;
grant execute on function public.set_virtual_space_track(uuid, uuid) to authenticated;

-- The YouTube way in is closed.
revoke execute on function public.set_virtual_space_music(uuid, text, text) from authenticated;
