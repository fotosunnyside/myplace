-- ============================================================================
-- Virtual Places (formerly Virtual Spaces) fixes. Safe to run more than once.
--
-- 1. Entering a room failed for members with a profile photo: the photo-link check used a regular
--    expression repetition count over 255 ("invalid repetition count(s)"). Same rule, written so Postgres accepts it.
-- 2. Customer-facing wording: PLACES FOR US, Virtual Places, and YourPlace (MyPlace is gone) in messages
--    the database sends. Table and function names stay as they are.
-- ============================================================================

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
    case when char_length(p_avatar_url) <= 500 and p_avatar_url ~ '^(https://|/)\S+$' then p_avatar_url end,
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

-- New members are welcomed to PLACES FOR US. Guests (anonymous sessions) still get no profile.
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
            'Welcome to PLACES FOR US, ' || split_part(v_name, ' ', 1) || '! This is your home across YourPlace, MindPlace, MarketPlace and WorkPlace. Ask me anything.', now());
  end if;
  return new;
end;
$$;
revoke all on function public.handle_new_member() from public, anon, authenticated;

create or replace function public.after_member_plan()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status <> 'active') then
    perform public.notify(new.user_id,
      case new.kind
        when 'pass' then 'Your PLACES Pass is active. Create, teach and host across PLACES FOR US.'
        when 'host' then 'You can create your own Virtual Places now. Open your first one!'
        else 'Create in MindPlace is active. Publish your course or membership!'
      end,
      case new.kind when 'host' then '/yourplace/?tab=places' when 'pass' then '/pricing' else '/teach' end,
      case new.kind when 'host' then 'yourplace' else 'mindplace' end);
  end if;
  return new;
end;
$$;
revoke all on function public.after_member_plan() from public, anon, authenticated;
