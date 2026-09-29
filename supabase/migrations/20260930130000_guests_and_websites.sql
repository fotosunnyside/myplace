-- ============================================================================
-- Guests in open rooms, and websites on profiles. Safe to run more than once.
--
-- Guests: someone arriving from outside (e.g. a Skool community) can drop into a room that's open to
-- guests with just a name — no account. The app signs them in anonymously (Supabase anonymous sign-ins,
-- turned on in Authentication → Sign In / Providers). A guest:
--   * gets no PLACES profile, so they can't post, sell, message or write anything else in the world
--     (every world table points at a profile);
--   * may enter only rooms whose visibility is 'public' (open to guests);
--   * can't upload files.
-- Joining PLACES later is an ordinary sign-up.
-- ============================================================================

/** True when the caller is an anonymous (guest) session. */
create or replace function public.is_guest()
returns boolean
language sql
stable
set search_path = ''
as $$ select coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) $$;
grant execute on function public.is_guest() to anon, authenticated;

-- Guests don't become members: no profile, no welcome thread.
create or replace function public.handle_new_member()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_id text := new.id::text;
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_username text := lower(coalesce(v_meta ->> 'username', ''));
  v_name text := left(btrim(coalesce(nullif(v_meta ->> 'name', ''), split_part(new.email, '@', 1), 'New member')), 80);
  v_thread text := 'thr_' || replace(gen_random_uuid()::text, '-', '');
begin
  if coalesce(new.is_anonymous, false) then
    return new;
  end if;
  if v_username !~ '^[a-z0-9_]{3,20}$' or exists (select 1 from public.profiles where username = v_username) then
    v_username := 'member_' || substr(replace(v_id, '-', ''), 1, 8);
  end if;
  insert into public.profiles (id, user_id, username, name, location, interests, joined_at)
  values (
    v_id, new.id, v_username, v_name,
    left(coalesce(v_meta ->> 'location', ''), 100),
    coalesce((select array_agg(x) from jsonb_array_elements_text(case when jsonb_typeof(v_meta -> 'interests') = 'array' then v_meta -> 'interests' else '[]'::jsonb end) x), '{}'),
    now()
  )
  on conflict (id) do nothing;

  if exists (select 1 from public.profiles where id = 'p_guide') then
    insert into public.threads (id, created_by, created_at) values (v_thread, 'p_guide', now());
    insert into public.thread_participants (thread_id, user_id, read_at) values (v_thread, v_id, now() - interval '1 second'), (v_thread, 'p_guide', now());
    insert into public.messages (id, thread_id, sender_id, body, created_at)
    values ('msg_' || replace(gen_random_uuid()::text, '-', ''), v_thread, 'p_guide',
            'Welcome to PLACES, ' || split_part(v_name, ' ', 1) || '! This is your home across YourPlace, MindPlace, MarketPlace and WorkPlace. Ask me anything.', now());
  end if;
  return new;
end;
$$;
revoke all on function public.handle_new_member() from public, anon, authenticated;

-- Rooms: guests only where the room is open to guests ('public'); members as before.
create or replace function public.can_enter_virtual_space(s public.virtual_spaces)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
     and s.is_active
     and (s.visibility in ('public', 'members') or public.is_admin())
     and (not public.is_guest() or s.visibility = 'public')
     and (s.is_official or s.created_by is null or public.can_host_spaces(s.created_by));
$$;

-- The Accountability Department opens to guests (only if an admin hasn't changed who may enter).
update public.virtual_spaces
   set visibility = 'public'
 where slug = 'accountability-room' and is_official and visibility = 'members';

-- Guests can't upload files.
drop policy if exists "media: upload own" on storage.objects;
create policy "media: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = public.me() and not public.is_guest());

-- ---------------------------------------------------------------------------
-- Websites on profiles
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists website text;
alter table public.profiles drop constraint if exists profiles_website_check;
alter table public.profiles add constraint profiles_website_check
  check (website is null or (char_length(website) <= 200 and website ~ '^https?://[^\s/$.?#][^\s]*$'));
grant update (website) on public.profiles to authenticated;
