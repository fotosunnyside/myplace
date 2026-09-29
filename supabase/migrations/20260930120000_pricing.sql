-- ============================================================================
-- PLACES pricing: free to join; pay to create, host, sell professionally, hire or promote.
--
--   Create in MindPlace  $7/month per published course or membership, + 5% of paid enrollments
--   Host a Space         $11/month (members' own virtual spaces)
--   PLACES Pass          $21/month: publishing, 0% course/membership fee, hosting, free job posts
--   WorkPlace post       $2 each without the Pass
--   MarketPlace          local sales free; 1% on shipped sales (Pass does not remove it)
--   Sponsored placement  $10/week, never included in the Pass
--
-- Until a Stripe webhook confirms payments, plans are trusted from the browser in test mode,
-- exactly like the creator plan before them. Everything that affects other people (fees, which
-- courses are listed, who may host) is decided here from those plans.
-- Safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Plans
-- ---------------------------------------------------------------------------
create table if not exists public.member_plans (
  user_id    text not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('create', 'host', 'pass')),
  -- Create is priced per published course or membership: quantity = how many they may publish.
  quantity   integer not null default 1 check (quantity between 1 and 50),
  status     text not null check (status in ('active', 'canceled')),
  via        text not null check (via in ('stripe', 'test')),
  since      timestamptz not null default now(),
  renews_at  timestamptz not null,
  primary key (user_id, kind),
  constraint member_plans_quantity check (kind = 'create' or quantity = 1)
);

alter table public.member_plans enable row level security;
-- Public, like the creator plan was: it decides which courses are listed and who hosts rooms.
drop policy if exists "world: read member plans" on public.member_plans;
create policy "world: read member plans" on public.member_plans for select to anon, authenticated using (true);
drop policy if exists "world: start own member plan" on public.member_plans;
create policy "world: start own member plan" on public.member_plans for insert to authenticated with check (user_id = public.me());
drop policy if exists "world: change own member plan" on public.member_plans;
create policy "world: change own member plan" on public.member_plans for update to authenticated using (user_id = public.me()) with check (user_id = public.me());
grant select on public.member_plans to anon, authenticated;
grant insert (user_id, kind, quantity, status, via, since, renews_at) on public.member_plans to authenticated;
grant update (quantity, status, via, since, renews_at) on public.member_plans to authenticated;

-- The old $3 creator plan becomes Create, covering the courses its owner already publishes.
insert into public.member_plans (user_id, kind, quantity, status, via, since, renews_at)
select p.user_id, 'create', least(50, greatest(1, (select count(*) from public.courses c where c.expert_id = p.user_id)))::integer,
       p.status, p.via, p.since, p.renews_at
  from public.creator_plans p
on conflict (user_id, kind) do nothing;

create or replace function public.has_plan(p_user_id text, p_kind text)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.member_plans where user_id = p_user_id and kind = p_kind and status = 'active') $$;

/** How many courses/memberships someone may have published: unlimited with the Pass, else their Create quantity. */
create or replace function public.course_slots(p_user_id text)
returns integer language sql stable security definer set search_path = ''
as $$
  select case
    when public.has_plan(p_user_id, 'pass') then 1000000
    else coalesce((select quantity from public.member_plans where user_id = p_user_id and kind = 'create' and status = 'active'), 0)
  end
$$;

create or replace function public.can_publish_course(p_user_id text)
returns boolean language sql stable security definer set search_path = ''
as $$ select (select count(*) from public.courses where expert_id = p_user_id) < public.course_slots(p_user_id) $$;

/** Hosting their own virtual spaces: Host a Space, or the Pass. Takes the auth user id. */
create or replace function public.can_host_spaces(p_user_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select p_user_id is not null and (public.has_plan(p_user_id::text, 'host') or public.has_plan(p_user_id::text, 'pass')) $$;

-- Listing: a member's courses are listed while they publish with Create or the Pass.
create or replace function public.has_creator_plan(p_user_id text)
returns boolean language sql stable security definer set search_path = ''
as $$ select public.has_plan(p_user_id, 'pass') or public.has_plan(p_user_id, 'create') $$;

do $$
declare f text;
begin
  foreach f in array array['has_plan(text, text)', 'course_slots(text)', 'can_publish_course(text)', 'can_host_spaces(uuid)', 'has_creator_plan(text)'] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end $$;

create or replace function public.after_member_plan()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status <> 'active') then
    perform public.notify(new.user_id,
      case new.kind
        when 'pass' then 'Your PLACES Pass is active. Create, teach and host across PLACES.'
        when 'host' then 'You can host your own spaces now. Open your first room!'
        else 'Create in MindPlace is active. Publish your course or membership!'
      end,
      case new.kind when 'host' then '/myplace' when 'pass' then '/pricing' else '/teach' end,
      case new.kind when 'host' then 'yourplace' else 'mindplace' end);
  end if;
  return new;
end;
$$;
drop trigger if exists member_plans_notify on public.member_plans;
create trigger member_plans_notify after insert or update on public.member_plans for each row execute function public.after_member_plan();
revoke all on function public.after_member_plan() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- MindPlace: free, one-time or recurring; 5% PLACES fee on paid enrollments without the Pass
-- ---------------------------------------------------------------------------
alter table public.courses add column if not exists billing text not null default 'once';
alter table public.courses drop constraint if exists courses_billing_check;
alter table public.courses add constraint courses_billing_check check (billing in ('once', 'monthly'));
grant insert (billing) on public.courses to authenticated;
grant update (billing) on public.courses to authenticated;

drop policy if exists "world: publish courses" on public.courses;
create policy "world: publish courses" on public.courses for insert to authenticated
  with check (expert_id = public.me() and public.can_publish_course(public.me()) and kind in ('course', 'guide'));

alter table public.course_purchases add column if not exists fee integer not null default 0;

create or replace function public.fill_course_purchase()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_course public.courses;
begin
  select * into v_course from public.courses where id = new.course_id;
  new.total := coalesce(v_course.price, 0);
  -- 5% PLACES platform fee on paid enrollments and membership payments; 0% for PLACES Pass creators.
  new.fee := case when new.total > 0 and not public.has_plan(v_course.expert_id, 'pass') then round(new.total * 0.05)::integer else 0 end;
  return new;
end;
$$;
revoke all on function public.fill_course_purchase() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- WorkPlace: $2 per post, included with the Pass
-- ---------------------------------------------------------------------------
alter table public.opportunities drop constraint if exists opportunities_paid_via_check;
alter table public.opportunities add constraint opportunities_paid_via_check check (paid_via in ('stripe', 'test', 'pass'));

drop policy if exists "world: post opportunities" on public.opportunities;
create policy "world: post opportunities" on public.opportunities for insert to authenticated
  with check (posted_by = public.me() and (paid_via is distinct from 'pass' or public.has_plan(public.me(), 'pass')));

-- ---------------------------------------------------------------------------
-- Sponsored placements: $10 a week. The longer booking is 4 weeks.
-- ---------------------------------------------------------------------------
create or replace function public.schedule_ad()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_start timestamptz;
begin
  perform pg_advisory_xact_lock(hashtext('places_ads_' || new.district));
  select greatest(now(), coalesce(max(ends_at), now())) into v_start from public.ads where district = new.district;
  new.starts_at := v_start;
  new.ends_at := v_start + case new.plan when 'week' then interval '7 days' else interval '28 days' end;
  return new;
end;
$$;
revoke all on function public.schedule_ad() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Virtual Spaces: members with Host a Space (or the Pass) open their own rooms
-- ---------------------------------------------------------------------------
create or replace function public.hosted_space_limits()
returns jsonb language sql immutable set search_path = ''
as $$ select '{"max_participants": 12, "rooms_per_host": 5}'::jsonb $$;
grant execute on function public.hosted_space_limits() to anon, authenticated;

create or replace function public.can_manage_virtual_space(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.virtual_spaces s
     where s.id = p_space_id
       and (public.is_admin() or (not s.is_official and s.created_by = (select auth.uid())))
  );
$$;

-- A hosted room is open while its host still hosts (official rooms follow is_active alone).
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
     and (s.is_official or s.created_by is null or public.can_host_spaces(s.created_by));
$$;

drop policy if exists "virtual_spaces: hosts create" on public.virtual_spaces;
create policy "virtual_spaces: hosts create"
  on public.virtual_spaces for insert
  to authenticated
  with check (
    not is_official
    and parent_space_id is null
    and visibility = 'members'
    and public.can_host_spaces((select auth.uid()))
    and (select count(*) from public.virtual_spaces v where v.created_by = (select auth.uid()))
        < (public.hosted_space_limits() ->> 'rooms_per_host')::integer
  );

drop policy if exists "virtual_spaces: admins delete" on public.virtual_spaces;
create policy "virtual_spaces: admins delete"
  on public.virtual_spaces for delete
  to authenticated
  using (not is_official and (public.is_admin() or created_by = (select auth.uid())));

/** Hosts keep their rooms within the hosted limits; only PLACES admins go beyond them. */
create or replace function public.guard_hosted_space()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.role()) in ('anon', 'authenticated') and not new.is_official and not public.is_admin() then
    if new.max_participants > (public.hosted_space_limits() ->> 'max_participants')::integer then
      raise exception 'Hosted rooms hold up to % people for now.', public.hosted_space_limits() ->> 'max_participants' using errcode = '23514';
    end if;
    if new.parent_space_id is not null or new.visibility <> 'members' then
      raise exception 'Hosted rooms are open to PLACES members.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists virtual_spaces_guard_hosted on public.virtual_spaces;
create trigger virtual_spaces_guard_hosted
  before insert or update on public.virtual_spaces
  for each row execute function public.guard_hosted_space();

-- ---------------------------------------------------------------------------
-- The official rooms, as PLACES now describes them (only where an admin hasn't already changed them).
-- ---------------------------------------------------------------------------
update public.virtual_spaces
   set name = 'Accountability Department',
       description = 'Bring something you need to finish. Camera on. Work quietly alongside other people and get it done.'
 where slug = 'accountability-room' and name = 'Accountability Room' and description = 'Bring your work. Stay focused together.';

update public.virtual_spaces
   set description = 'Come in. Meet people. Talk about what''s happening around PLACES.'
 where slug = 'town-hall' and description = 'See who''s around. Drop in and say hello.';

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'member_plans') then
    alter publication supabase_realtime add table public.member_plans;
  end if;
end $$;
