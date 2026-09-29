-- ============================================================================
-- PLACES · The shared world
--
-- Everything people make in PLACES, shared between everyone: profiles, posts,
-- courses, discussions, shops, orders, opportunities, messages, workrooms...
--
-- Rules of thumb used throughout:
--  * Ids are text (content ids look like `post_…`; a member's profile id is their auth uid).
--  * People write only their own rows. Anything that touches someone else
--    (notifications, order totals, hiring welcomes) is done by the database.
--  * Images are stored in Storage (`media` bucket); columns hold URLs, never data.
--  * Access is granted explicitly, so this works with "expose new tables" off.
-- ============================================================================

-- The signed-in member's profile id.
create or replace function public.me()
returns text
language sql
stable
set search_path = ''
as $$ select (select auth.uid())::text $$;

grant execute on function public.me() to anon, authenticated;

-- Image columns hold URLs only.
create or replace function public.is_image_url(v text)
returns boolean
language sql
immutable
set search_path = ''
as $$ select v is null or v = '' or (char_length(v) <= 2048 and v ~ '^(https?://|/)\S+$') $$;

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id              text primary key,
  -- Null for PLACES community profiles (the guide and founding creators).
  user_id         uuid unique references auth.users (id) on delete cascade,
  username        text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  name            text not null check (char_length(btrim(name)) between 1 and 80),
  avatar          text not null default '' check (public.is_image_url(avatar)),
  bio             text not null default '' check (char_length(bio) <= 500),
  location        text not null default '' check (char_length(location) <= 100),
  headline        text not null default '' check (char_length(headline) <= 120),
  interests       text[] not null default '{}',
  skills          text[] not null default '{}',
  open_to         text[] not null default '{}',
  base_followers  integer not null default 0,
  base_following  integer not null default 0,
  joined_at       timestamptz not null default now(),
  constraint profiles_member_id check (user_id is null or id = user_id::text)
);

create table if not exists public.creator_plans (
  user_id    text primary key references public.profiles (id) on delete cascade,
  status     text not null check (status in ('active', 'canceled')),
  via        text not null check (via in ('stripe', 'test')),
  since      timestamptz not null default now(),
  renews_at  timestamptz not null
);

create table if not exists public.follows (
  follower_id  text not null references public.profiles (id) on delete cascade,
  followee_id  text not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index if not exists follows_followee_idx on public.follows (followee_id);

-- ---------------------------------------------------------------------------
-- YourPlace
-- ---------------------------------------------------------------------------
create table if not exists public.posts (
  id             text primary key,
  author_id      text not null references public.profiles (id) on delete cascade,
  body           text not null default '' check (char_length(body) <= 5000),
  image          text check (public.is_image_url(image)),
  link           text check (link is null or link ~* '^https?://'),
  location       text check (char_length(location) <= 100),
  -- [{ "id": "opt_…", "label": "…" }]; votes live in poll_votes.
  poll           jsonb check (poll is null or jsonb_typeof(poll) = 'array'),
  audience       text not null default 'public' check (audience in ('public', 'friends')),
  created_at     timestamptz not null default now(),
  base_likes     integer not null default 0,
  base_comments  integer not null default 0
);
create index if not exists posts_created_idx on public.posts (created_at desc);

create table if not exists public.post_likes (
  post_id     text not null references public.posts (id) on delete cascade,
  user_id     text not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.post_comments (
  id          text primary key,
  post_id     text not null references public.posts (id) on delete cascade,
  author_id   text not null references public.profiles (id) on delete cascade,
  body        text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at  timestamptz not null default now()
);
create index if not exists post_comments_post_idx on public.post_comments (post_id);

create table if not exists public.poll_votes (
  post_id    text not null references public.posts (id) on delete cascade,
  user_id    text not null references public.profiles (id) on delete cascade,
  option_id  text not null,
  primary key (post_id, user_id)
);

create table if not exists public.saved_items (
  user_id   text not null references public.profiles (id) on delete cascade,
  kind      text not null check (kind in ('post', 'course', 'discussion', 'product', 'shop', 'opportunity')),
  ref_id    text not null,
  saved_at  timestamptz not null default now(),
  primary key (user_id, kind, ref_id)
);

create table if not exists public.collections (
  id          text primary key,
  user_id     text not null references public.profiles (id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 1 and 80),
  items       jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- MindPlace
-- ---------------------------------------------------------------------------
create table if not exists public.courses (
  id            text primary key,
  expert_id     text not null references public.profiles (id) on delete cascade,
  title         text not null check (char_length(btrim(title)) between 3 and 120),
  subtitle      text not null default '',
  description   text not null default '' check (char_length(description) <= 4000),
  image         text not null check (public.is_image_url(image)),
  kind          text not null check (kind in ('course', 'guide', 'live')),
  topic         text not null default '',
  base_members  integer not null default 0,
  starts_at     timestamptz,
  price         integer check (price is null or price = 0 or price >= 100),
  stripe_link   text check (stripe_link is null or stripe_link ~ '^https://(buy\.stripe\.com|checkout\.stripe\.com|donate\.stripe\.com)/'),
  created_at    timestamptz not null default now()
);

-- The outline is public; lesson content is in lesson_bodies, shown only to people who may read it.
create table if not exists public.course_lessons (
  id         text primary key,
  course_id  text not null references public.courses (id) on delete cascade,
  position   integer not null,
  title      text not null check (char_length(btrim(title)) between 1 and 160),
  minutes    integer not null default 5 check (minutes between 1 and 600)
);
create index if not exists course_lessons_course_idx on public.course_lessons (course_id, position);

create table if not exists public.lesson_bodies (
  lesson_id  text primary key references public.course_lessons (id) on delete cascade,
  course_id  text not null references public.courses (id) on delete cascade,
  body       text not null check (char_length(body) <= 20000)
);

create table if not exists public.course_purchases (
  id          text primary key,
  course_id   text not null references public.courses (id) on delete cascade,
  buyer_id    text not null references public.profiles (id) on delete cascade,
  total       integer not null default 0,
  via         text not null check (via in ('stripe', 'test')),
  created_at  timestamptz not null default now(),
  unique (course_id, buyer_id)
);

create table if not exists public.enrollments (
  user_id     text not null references public.profiles (id) on delete cascade,
  course_id   text not null references public.courses (id) on delete cascade,
  started_at  timestamptz not null default now(),
  completed   text[] not null default '{}',
  primary key (user_id, course_id)
);

create table if not exists public.discussions (
  id            text primary key,
  author_id     text not null references public.profiles (id) on delete cascade,
  title         text not null check (char_length(btrim(title)) between 6 and 200),
  body          text not null default '' check (char_length(body) <= 5000),
  category      text not null default 'General',
  tone          text not null default 'sky' check (tone in ('teal', 'coral', 'sun', 'lavender', 'leaf', 'sky', 'neutral')),
  created_at    timestamptz not null default now(),
  base_upvotes  integer not null default 0,
  base_replies  integer not null default 0
);

create table if not exists public.discussion_upvotes (
  discussion_id  text not null references public.discussions (id) on delete cascade,
  user_id        text not null references public.profiles (id) on delete cascade,
  primary key (discussion_id, user_id)
);

create table if not exists public.discussion_replies (
  id             text primary key,
  discussion_id  text not null references public.discussions (id) on delete cascade,
  author_id      text not null references public.profiles (id) on delete cascade,
  body           text not null check (char_length(btrim(body)) between 1 and 5000),
  created_at     timestamptz not null default now()
);
create index if not exists discussion_replies_idx on public.discussion_replies (discussion_id);

-- ---------------------------------------------------------------------------
-- MarketPlace
-- ---------------------------------------------------------------------------
create table if not exists public.shops (
  id           text primary key,
  owner_id     text not null unique references public.profiles (id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 80),
  category     text not null default '',
  description  text not null default '' check (char_length(description) <= 1000),
  image        text not null default '' check (public.is_image_url(image)),
  created_at   timestamptz not null default now()
);

create table if not exists public.products (
  id           text primary key,
  shop_id      text not null references public.shops (id) on delete cascade,
  title        text not null check (char_length(btrim(title)) between 1 and 120),
  description  text not null default '' check (char_length(description) <= 4000),
  price        integer not null check (price >= 50),
  image        text not null check (public.is_image_url(image)),
  category     text not null check (category in ('Handmade', 'Digital', 'Home', 'Wellness', 'Services')),
  stripe_link  text check (stripe_link is null or stripe_link ~ '^https://(buy\.stripe\.com|checkout\.stripe\.com|donate\.stripe\.com)/'),
  ships        boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists products_shop_idx on public.products (shop_id);

-- Totals, fee and seller are set by the database from the product, not by the buyer's browser.
create table if not exists public.orders (
  id          text primary key,
  product_id  text not null,
  seller_id   text references public.profiles (id) on delete set null,
  buyer_id    text not null references public.profiles (id) on delete cascade,
  total       integer not null default 0,
  fee         integer not null default 0,
  via         text not null check (via in ('stripe', 'test')),
  created_at  timestamptz not null default now()
);
create index if not exists orders_buyer_idx on public.orders (buyer_id);
create index if not exists orders_seller_idx on public.orders (seller_id);

-- ---------------------------------------------------------------------------
-- WorkPlace
-- ---------------------------------------------------------------------------
create table if not exists public.opportunities (
  id           text primary key,
  posted_by    text not null references public.profiles (id) on delete cascade,
  title        text not null check (char_length(btrim(title)) between 4 and 160),
  org          text not null default '',
  icon         text not null default 'briefcase',
  icon_tone    text not null default 'teal',
  location     text not null default '',
  type         text not null check (type in ('Full Time', 'Part Time', 'Flexible', 'Project', 'Freelance')),
  kind         text not null check (kind in ('job', 'service', 'project', 'team')),
  tags         text[] not null default '{}',
  pay          text not null default '',
  description  text not null check (char_length(btrim(description)) between 20 and 5000),
  paid_via     text check (paid_via in ('stripe', 'test')),
  created_at   timestamptz not null default now()
);

create table if not exists public.applications (
  id              text primary key,
  opportunity_id  text not null references public.opportunities (id) on delete cascade,
  applicant_id    text not null references public.profiles (id) on delete cascade,
  message         text not null check (char_length(btrim(message)) between 20 and 5000),
  link            text check (link is null or link ~* '^https?://'),
  created_at      timestamptz not null default now(),
  unique (opportunity_id, applicant_id)
);

-- ---------------------------------------------------------------------------
-- Messages & notifications
-- ---------------------------------------------------------------------------
create table if not exists public.threads (
  id          text primary key,
  created_by  text not null references public.profiles (id) on delete cascade,
  context     jsonb,
  created_at  timestamptz not null default now()
);

create table if not exists public.thread_participants (
  thread_id  text not null references public.threads (id) on delete cascade,
  user_id    text not null references public.profiles (id) on delete cascade,
  read_at    timestamptz not null default now(),
  primary key (thread_id, user_id)
);
create index if not exists thread_participants_user_idx on public.thread_participants (user_id);

create table if not exists public.messages (
  id          text primary key,
  thread_id   text not null references public.threads (id) on delete cascade,
  sender_id   text not null references public.profiles (id) on delete cascade,
  body        text not null check (char_length(btrim(body)) between 1 and 5000),
  created_at  timestamptz not null default now()
);
create index if not exists messages_thread_idx on public.messages (thread_id, created_at);

create table if not exists public.notifications (
  id          text primary key default ('ntf_' || replace(gen_random_uuid()::text, '-', '')),
  user_id     text not null references public.profiles (id) on delete cascade,
  text        text not null,
  href        text not null default '/',
  district    text not null default 'yourplace' check (district in ('yourplace', 'mindplace', 'marketplace', 'workplace')),
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Ads — one sponsored banner per Place
-- ---------------------------------------------------------------------------
create table if not exists public.ads (
  id          text primary key,
  owner_id    text not null references public.profiles (id) on delete cascade,
  business    text not null check (char_length(btrim(business)) between 2 and 80),
  headline    text not null check (char_length(btrim(headline)) between 6 and 140),
  image       text not null check (public.is_image_url(image)),
  url         text not null check (url ~ '^https://\S+\.\S+'),
  district    text not null check (district in ('yourplace', 'mindplace', 'marketplace', 'workplace')),
  plan        text not null check (plan in ('week', 'month')),
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  via         text not null check (via in ('stripe', 'test')),
  created_at  timestamptz not null default now()
);
create index if not exists ads_district_idx on public.ads (district, ends_at);

-- ---------------------------------------------------------------------------
-- Workrooms, contracts & invoices
-- ---------------------------------------------------------------------------
create table if not exists public.workrooms (
  id           text primary key,
  name         text not null check (char_length(btrim(name)) between 2 and 120),
  owner_id     text not null references public.profiles (id) on delete cascade,
  contract_id  text,
  created_at   timestamptz not null default now()
);

create table if not exists public.workroom_members (
  workroom_id  text not null references public.workrooms (id) on delete cascade,
  user_id      text not null references public.profiles (id) on delete cascade,
  read_at      timestamptz not null default now(),
  primary key (workroom_id, user_id)
);
create index if not exists workroom_members_user_idx on public.workroom_members (user_id);

create table if not exists public.workroom_channels (
  id           text primary key,
  workroom_id  text not null references public.workrooms (id) on delete cascade,
  name         text not null check (name ~ '^[a-z0-9-]{1,40}$'),
  unique (workroom_id, name)
);

create table if not exists public.workroom_messages (
  id           text primary key,
  workroom_id  text not null references public.workrooms (id) on delete cascade,
  channel_id   text not null references public.workroom_channels (id) on delete cascade,
  sender_id    text not null references public.profiles (id) on delete cascade,
  body         text not null check (char_length(btrim(body)) between 1 and 5000),
  created_at   timestamptz not null default now()
);
create index if not exists workroom_messages_idx on public.workroom_messages (workroom_id, created_at);

create table if not exists public.contracts (
  id              text primary key,
  title           text not null,
  opportunity_id  text,
  employer_id     text not null references public.profiles (id) on delete cascade,
  worker_id       text not null references public.profiles (id) on delete cascade,
  rate            text not null default '',
  status          text not null default 'active' check (status in ('active', 'completed')),
  workroom_id     text references public.workrooms (id) on delete set null,
  created_at      timestamptz not null default now(),
  check (employer_id <> worker_id)
);

create table if not exists public.invoices (
  id           text primary key,
  contract_id  text not null references public.contracts (id) on delete cascade,
  amount       integer not null check (amount >= 100),
  description  text not null check (char_length(btrim(description)) between 1 and 500),
  pay_link     text check (pay_link is null or pay_link ~ '^https://'),
  status       text not null default 'open' check (status in ('open', 'paid')),
  created_at   timestamptz not null default now(),
  paid_at      timestamptz
);

-- ============================================================================
-- Helpers used by the policies (security definer, so policies don't recurse)
-- ============================================================================
create or replace function public.is_thread_participant(p_thread_id text)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.thread_participants where thread_id = p_thread_id and user_id = public.me()) $$;

create or replace function public.is_workroom_member(p_workroom_id text)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.workroom_members where workroom_id = p_workroom_id and user_id = public.me()) $$;

create or replace function public.is_workroom_owner(p_workroom_id text)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.workrooms where id = p_workroom_id and owner_id = public.me()) $$;

create or replace function public.is_contract_party(p_contract_id text)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.contracts where id = p_contract_id and public.me() in (employer_id, worker_id)) $$;

create or replace function public.can_see_post(p_post_id text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.posts p
     where p.id = p_post_id
       and (p.audience = 'public' or p.author_id = public.me()
            or exists (select 1 from public.follows f where f.follower_id = p.author_id and f.followee_id = public.me()))
  )
$$;

create or replace function public.can_read_lesson(p_lesson_id text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.course_lessons l join public.courses c on c.id = l.course_id
     where l.id = p_lesson_id
       and (coalesce(c.price, 0) = 0
            or l.position = 0 -- first lesson is a free preview
            or c.expert_id = public.me()
            or exists (select 1 from public.course_purchases p where p.course_id = c.id and p.buyer_id = public.me()))
  )
$$;

create or replace function public.can_enroll(p_course_id text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.courses c
     where c.id = p_course_id
       and (coalesce(c.price, 0) = 0 or c.expert_id = public.me()
            or exists (select 1 from public.course_purchases p where p.course_id = c.id and p.buyer_id = public.me()))
  )
$$;

create or replace function public.has_creator_plan(p_user_id text)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.creator_plans where user_id = p_user_id and status = 'active') $$;

create or replace function public.owns_shop(p_shop_id text)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.shops where id = p_shop_id and owner_id = public.me()) $$;

create or replace function public.owns_course(p_course_id text)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.courses where id = p_course_id and expert_id = public.me()) $$;

create or replace function public.posted_opportunity(p_opportunity_id text)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.opportunities where id = p_opportunity_id and posted_by = public.me()) $$;

do $$
declare f text;
begin
  foreach f in array array[
    'is_thread_participant(text)', 'is_workroom_member(text)', 'is_workroom_owner(text)', 'is_contract_party(text)',
    'can_see_post(text)', 'can_read_lesson(text)', 'can_enroll(text)', 'has_creator_plan(text)', 'owns_shop(text)',
    'owns_course(text)', 'posted_opportunity(text)'
  ] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end $$;

-- ============================================================================
-- Row Level Security
-- ============================================================================
do $$
declare t text; pol text;
begin
  foreach t in array array[
    'profiles', 'creator_plans', 'follows', 'posts', 'post_likes', 'post_comments', 'poll_votes', 'saved_items',
    'collections', 'courses', 'course_lessons', 'lesson_bodies', 'course_purchases', 'enrollments', 'discussions',
    'discussion_upvotes', 'discussion_replies', 'shops', 'products', 'orders', 'opportunities', 'applications',
    'threads', 'thread_participants', 'messages', 'notifications', 'ads', 'workrooms', 'workroom_members',
    'workroom_channels', 'workroom_messages', 'contracts', 'invoices'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
  -- Drop this migration's own policies so it can be re-run.
  for t, pol in select tablename, policyname from pg_policies where schemaname = 'public' and policyname like 'world: %' loop
    execute format('drop policy if exists %I on public.%I', pol, t);
  end loop;
end $$;

-- Profiles: everyone can see people; you edit your own (the row is created for you at sign-up).
create policy "world: read profiles" on public.profiles for select to anon, authenticated using (true);
create policy "world: edit own profile" on public.profiles for update to authenticated using (id = public.me()) with check (id = public.me());
grant select on public.profiles to anon, authenticated;
grant update (name, avatar, bio, location, headline, interests, skills, open_to) on public.profiles to authenticated;

-- Creator plans: public status (it decides which courses are listed); you manage your own.
-- Until a Stripe webhook confirms payments, plans are trusted from the browser (as today).
create policy "world: read plans" on public.creator_plans for select to anon, authenticated using (true);
create policy "world: start own plan" on public.creator_plans for insert to authenticated with check (user_id = public.me());
create policy "world: change own plan" on public.creator_plans for update to authenticated using (user_id = public.me()) with check (user_id = public.me());
grant select on public.creator_plans to anon, authenticated;
grant insert, update on public.creator_plans to authenticated;

create policy "world: read follows" on public.follows for select to anon, authenticated using (true);
create policy "world: follow" on public.follows for insert to authenticated with check (follower_id = public.me());
create policy "world: unfollow" on public.follows for delete to authenticated using (follower_id = public.me());
grant select on public.follows to anon, authenticated;
grant insert, delete on public.follows to authenticated;

-- Posts: public posts for all; "friends" posts for the author and people the author follows.
create policy "world: read posts" on public.posts for select to anon, authenticated using (public.can_see_post(id));
create policy "world: write own posts" on public.posts for insert to authenticated with check (author_id = public.me());
create policy "world: edit own posts" on public.posts for update to authenticated using (author_id = public.me()) with check (author_id = public.me());
create policy "world: delete own posts" on public.posts for delete to authenticated using (author_id = public.me());
grant select on public.posts to anon, authenticated;
grant insert (id, author_id, body, image, link, location, poll, audience, created_at) on public.posts to authenticated;
grant update (body, image, link, location, poll, audience) on public.posts to authenticated;
grant delete on public.posts to authenticated;

create policy "world: read likes" on public.post_likes for select to anon, authenticated using (public.can_see_post(post_id));
create policy "world: like" on public.post_likes for insert to authenticated with check (user_id = public.me() and public.can_see_post(post_id));
create policy "world: unlike" on public.post_likes for delete to authenticated using (user_id = public.me());
grant select on public.post_likes to anon, authenticated;
grant insert (post_id, user_id), delete on public.post_likes to authenticated;

create policy "world: read comments" on public.post_comments for select to anon, authenticated using (public.can_see_post(post_id));
create policy "world: comment" on public.post_comments for insert to authenticated with check (author_id = public.me() and public.can_see_post(post_id));
create policy "world: delete comments" on public.post_comments for delete to authenticated
  using (author_id = public.me() or exists (select 1 from public.posts p where p.id = post_id and p.author_id = public.me()));
grant select on public.post_comments to anon, authenticated;
grant insert (id, post_id, author_id, body, created_at), delete on public.post_comments to authenticated;

create policy "world: read votes" on public.poll_votes for select to anon, authenticated using (public.can_see_post(post_id));
create policy "world: vote" on public.poll_votes for insert to authenticated with check (user_id = public.me() and public.can_see_post(post_id));
create policy "world: change vote" on public.poll_votes for update to authenticated using (user_id = public.me()) with check (user_id = public.me());
create policy "world: clear vote" on public.poll_votes for delete to authenticated using (user_id = public.me());
grant select on public.poll_votes to anon, authenticated;
grant insert, update (option_id), delete on public.poll_votes to authenticated;

-- Saved items and collections are private.
create policy "world: own saved" on public.saved_items for all to authenticated using (user_id = public.me()) with check (user_id = public.me());
grant select, insert, delete on public.saved_items to authenticated;
create policy "world: own collections" on public.collections for all to authenticated using (user_id = public.me()) with check (user_id = public.me());
grant select, insert, update (title, items), delete on public.collections to authenticated;

-- Courses: members with an active creator plan publish; lesson content only for people who may read it.
create policy "world: read courses" on public.courses for select to anon, authenticated using (true);
create policy "world: publish courses" on public.courses for insert to authenticated
  with check (expert_id = public.me() and public.has_creator_plan(public.me()) and kind in ('course', 'guide'));
create policy "world: edit own courses" on public.courses for update to authenticated using (expert_id = public.me()) with check (expert_id = public.me() and kind in ('course', 'guide'));
create policy "world: delete own courses" on public.courses for delete to authenticated using (expert_id = public.me());
grant select on public.courses to anon, authenticated;
grant insert (id, expert_id, title, subtitle, description, image, kind, topic, price, stripe_link, created_at) on public.courses to authenticated;
grant update (title, subtitle, description, image, kind, topic, price, stripe_link) on public.courses to authenticated;
grant delete on public.courses to authenticated;

create policy "world: read outlines" on public.course_lessons for select to anon, authenticated using (true);
create policy "world: write own outlines" on public.course_lessons for all to authenticated using (public.owns_course(course_id)) with check (public.owns_course(course_id));
grant select on public.course_lessons to anon, authenticated;
grant insert, update (position, title, minutes), delete on public.course_lessons to authenticated;

create policy "world: read lessons you may" on public.lesson_bodies for select to anon, authenticated using (public.can_read_lesson(lesson_id));
create policy "world: write own lessons" on public.lesson_bodies for all to authenticated using (public.owns_course(course_id)) with check (public.owns_course(course_id));
grant select on public.lesson_bodies to anon, authenticated;
grant insert, update (body), delete on public.lesson_bodies to authenticated;

-- Purchases: seen by the buyer and the course's creator. (Trusted from the browser until Stripe Connect webhooks.)
create policy "world: read purchases" on public.course_purchases for select to authenticated
  using (buyer_id = public.me() or public.owns_course(course_id));
create policy "world: buy" on public.course_purchases for insert to authenticated with check (buyer_id = public.me());
grant select, insert (id, course_id, buyer_id, via, created_at) on public.course_purchases to authenticated;

create policy "world: own enrollments" on public.enrollments for select to authenticated using (user_id = public.me());
create policy "world: enroll" on public.enrollments for insert to authenticated with check (user_id = public.me() and public.can_enroll(course_id));
create policy "world: progress" on public.enrollments for update to authenticated using (user_id = public.me()) with check (user_id = public.me());
create policy "world: unenroll" on public.enrollments for delete to authenticated using (user_id = public.me());
grant select, insert, update (completed), delete on public.enrollments to authenticated;

create policy "world: read discussions" on public.discussions for select to anon, authenticated using (true);
create policy "world: start discussions" on public.discussions for insert to authenticated with check (author_id = public.me());
create policy "world: edit own discussions" on public.discussions for update to authenticated using (author_id = public.me()) with check (author_id = public.me());
create policy "world: delete own discussions" on public.discussions for delete to authenticated using (author_id = public.me());
grant select on public.discussions to anon, authenticated;
grant insert (id, author_id, title, body, category, tone, created_at) on public.discussions to authenticated;
grant update (title, body, category, tone), delete on public.discussions to authenticated;

create policy "world: read upvotes" on public.discussion_upvotes for select to anon, authenticated using (true);
create policy "world: upvote" on public.discussion_upvotes for insert to authenticated with check (user_id = public.me());
create policy "world: un-upvote" on public.discussion_upvotes for delete to authenticated using (user_id = public.me());
grant select on public.discussion_upvotes to anon, authenticated;
grant insert, delete on public.discussion_upvotes to authenticated;

create policy "world: read replies" on public.discussion_replies for select to anon, authenticated using (true);
create policy "world: reply" on public.discussion_replies for insert to authenticated with check (author_id = public.me());
create policy "world: delete replies" on public.discussion_replies for delete to authenticated
  using (author_id = public.me() or exists (select 1 from public.discussions d where d.id = discussion_id and d.author_id = public.me()));
grant select on public.discussion_replies to anon, authenticated;
grant insert (id, discussion_id, author_id, body, created_at), delete on public.discussion_replies to authenticated;

-- Shops & products
create policy "world: read shops" on public.shops for select to anon, authenticated using (true);
create policy "world: open shop" on public.shops for insert to authenticated with check (owner_id = public.me());
create policy "world: edit own shop" on public.shops for update to authenticated using (owner_id = public.me()) with check (owner_id = public.me());
create policy "world: close own shop" on public.shops for delete to authenticated using (owner_id = public.me());
grant select on public.shops to anon, authenticated;
grant insert, update (name, category, description, image), delete on public.shops to authenticated;

create policy "world: read products" on public.products for select to anon, authenticated using (true);
create policy "world: list products" on public.products for insert to authenticated with check (public.owns_shop(shop_id));
create policy "world: edit own products" on public.products for update to authenticated using (public.owns_shop(shop_id)) with check (public.owns_shop(shop_id));
create policy "world: remove own products" on public.products for delete to authenticated using (public.owns_shop(shop_id));
grant select on public.products to anon, authenticated;
grant insert, update (title, description, price, image, category, stripe_link, ships), delete on public.products to authenticated;

create policy "world: read own orders and sales" on public.orders for select to authenticated using (buyer_id = public.me() or seller_id = public.me());
create policy "world: order" on public.orders for insert to authenticated with check (buyer_id = public.me());
grant select, insert (id, product_id, buyer_id, via, created_at) on public.orders to authenticated;

-- Opportunities & applications
create policy "world: read opportunities" on public.opportunities for select to anon, authenticated using (true);
create policy "world: post opportunities" on public.opportunities for insert to authenticated with check (posted_by = public.me());
create policy "world: edit own opportunities" on public.opportunities for update to authenticated using (posted_by = public.me()) with check (posted_by = public.me());
create policy "world: remove own opportunities" on public.opportunities for delete to authenticated using (posted_by = public.me());
grant select on public.opportunities to anon, authenticated;
grant insert, update (title, org, icon, icon_tone, location, type, kind, tags, pay, description), delete on public.opportunities to authenticated;

create policy "world: read applications" on public.applications for select to authenticated
  using (applicant_id = public.me() or public.posted_opportunity(opportunity_id));
create policy "world: apply" on public.applications for insert to authenticated with check (applicant_id = public.me());
grant select, insert on public.applications to authenticated;

-- Threads: only participants. The person who starts a conversation adds the other person.
create policy "world: read threads" on public.threads for select to authenticated using (public.is_thread_participant(id) or created_by = public.me());
create policy "world: start threads" on public.threads for insert to authenticated with check (created_by = public.me());
grant select, insert on public.threads to authenticated;

create policy "world: read participants" on public.thread_participants for select to authenticated using (public.is_thread_participant(thread_id));
-- Only the person who started a conversation adds people to it (nobody can join a conversation by knowing its id).
create policy "world: add participants" on public.thread_participants for insert to authenticated
  with check (exists (select 1 from public.threads t where t.id = thread_id and t.created_by = public.me()));
create policy "world: mark read" on public.thread_participants for update to authenticated using (user_id = public.me()) with check (user_id = public.me());
grant select, insert (thread_id, user_id, read_at), update (read_at) on public.thread_participants to authenticated;

create policy "world: read messages" on public.messages for select to authenticated using (public.is_thread_participant(thread_id));
create policy "world: send messages" on public.messages for insert to authenticated with check (sender_id = public.me() and public.is_thread_participant(thread_id));
grant select, insert on public.messages to authenticated;

-- Notifications: yours to read and mark read. Only the database creates them.
create policy "world: read notifications" on public.notifications for select to authenticated using (user_id = public.me());
create policy "world: mark notifications read" on public.notifications for update to authenticated using (user_id = public.me()) with check (user_id = public.me());
grant select, update (read) on public.notifications to authenticated;

-- Ads: everyone sees banners; you book and cancel your own. Scheduling is done by the database.
create policy "world: read ads" on public.ads for select to anon, authenticated using (true);
create policy "world: book ads" on public.ads for insert to authenticated with check (owner_id = public.me());
create policy "world: cancel own ads" on public.ads for delete to authenticated using (owner_id = public.me());
grant select on public.ads to anon, authenticated;
grant insert (id, owner_id, business, headline, image, url, district, plan, via, created_at, starts_at, ends_at), delete on public.ads to authenticated;

-- Workrooms: members only.
create policy "world: read workrooms" on public.workrooms for select to authenticated using (public.is_workroom_member(id) or owner_id = public.me());
create policy "world: create workrooms" on public.workrooms for insert to authenticated with check (owner_id = public.me());
create policy "world: rename workrooms" on public.workrooms for update to authenticated using (owner_id = public.me()) with check (owner_id = public.me());
grant select, insert, update (name) on public.workrooms to authenticated;

create policy "world: read members" on public.workroom_members for select to authenticated using (public.is_workroom_member(workroom_id));
create policy "world: add members" on public.workroom_members for insert to authenticated
  with check (public.is_workroom_member(workroom_id) or public.is_workroom_owner(workroom_id));
create policy "world: mark room read" on public.workroom_members for update to authenticated using (user_id = public.me()) with check (user_id = public.me());
grant select, insert (workroom_id, user_id, read_at), update (read_at) on public.workroom_members to authenticated;

create policy "world: read channels" on public.workroom_channels for select to authenticated using (public.is_workroom_member(workroom_id));
create policy "world: add channels" on public.workroom_channels for insert to authenticated
  with check (public.is_workroom_member(workroom_id) or public.is_workroom_owner(workroom_id));
grant select, insert on public.workroom_channels to authenticated;

create policy "world: read room messages" on public.workroom_messages for select to authenticated using (public.is_workroom_member(workroom_id));
create policy "world: post room messages" on public.workroom_messages for insert to authenticated
  with check (sender_id = public.me() and public.is_workroom_member(workroom_id));
grant select, insert on public.workroom_messages to authenticated;

-- Contracts: the two parties. Only the employer hires (for someone who applied) and completes.
create policy "world: read contracts" on public.contracts for select to authenticated using (public.me() in (employer_id, worker_id));
create policy "world: hire" on public.contracts for insert to authenticated
  with check (
    employer_id = public.me()
    and (workroom_id is null or public.is_workroom_owner(workroom_id))
    and exists (select 1 from public.applications a join public.opportunities o on o.id = a.opportunity_id
                 where a.applicant_id = contracts.worker_id and o.posted_by = public.me()
                   and (contracts.opportunity_id is null or o.id = contracts.opportunity_id))
  );
create policy "world: complete contracts" on public.contracts for update to authenticated using (employer_id = public.me()) with check (employer_id = public.me());
grant select, insert, update (status) on public.contracts to authenticated;

-- Invoices: the person hired requests payment; the employer marks it paid.
create policy "world: read invoices" on public.invoices for select to authenticated using (public.is_contract_party(contract_id));
create policy "world: request payment" on public.invoices for insert to authenticated
  with check (status = 'open' and paid_at is null
              and exists (select 1 from public.contracts c where c.id = contract_id and c.worker_id = public.me() and c.status = 'active'));
create policy "world: mark paid" on public.invoices for update to authenticated
  using (exists (select 1 from public.contracts c where c.id = contract_id and c.employer_id = public.me()))
  with check (exists (select 1 from public.contracts c where c.id = contract_id and c.employer_id = public.me()));
grant select, insert (id, contract_id, amount, description, pay_link, status, created_at, paid_at), update (status, paid_at) on public.invoices to authenticated;

-- ============================================================================
-- Things the database does on people's behalf
-- ============================================================================
create or replace function public.notify(p_user_id text, p_text text, p_href text, p_district text)
returns void language sql security definer set search_path = ''
as $$
  insert into public.notifications (user_id, text, href, district)
  select p_user_id, p_text, p_href, p_district
   where exists (select 1 from public.profiles where id = p_user_id and user_id is not null);
$$;
revoke all on function public.notify(text, text, text, text) from public, anon, authenticated;

-- A new member gets a profile and a welcome message from the PLACES guide.
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

drop trigger if exists on_auth_user_created_places on auth.users;
create trigger on_auth_user_created_places
  after insert on auth.users
  for each row execute function public.handle_new_member();

-- Existing members (who joined before this migration) get their profile too.
insert into public.profiles (id, user_id, username, name, joined_at)
select u.id::text, u.id,
       case when coalesce(u.raw_user_meta_data ->> 'username', '') ~ '^[a-z0-9_]{3,20}$'
             and not exists (select 1 from public.profiles p where p.username = u.raw_user_meta_data ->> 'username')
            then u.raw_user_meta_data ->> 'username' else 'member_' || substr(replace(u.id::text, '-', ''), 1, 8) end,
       left(coalesce(nullif(u.raw_user_meta_data ->> 'name', ''), split_part(u.email, '@', 1)), 80),
       u.created_at
  from auth.users u
 where not exists (select 1 from public.profiles p where p.user_id = u.id)
on conflict do nothing;

create or replace function public.username_available(p_username text)
returns boolean language sql stable security definer set search_path = ''
as $$ select lower(p_username) ~ '^[a-z0-9_]{3,20}$' and not exists (select 1 from public.profiles where username = lower(p_username)) $$;
revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

-- Deleting your account removes everything you made (profiles cascade to all your content).
-- The app removes your photos from Storage (through the Storage API) just before calling this.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  delete from auth.users where id = (select auth.uid());
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Orders: price, fee and seller come from the product itself.
create or replace function public.fill_order()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_product public.products; v_owner text;
begin
  select * into v_product from public.products where id = new.product_id;
  if not found then
    raise exception 'That product is no longer available.' using errcode = 'P0001';
  end if;
  select owner_id into v_owner from public.shops where id = v_product.shop_id;
  new.total := v_product.price;
  new.fee := case when v_product.ships then round(v_product.price * 0.01) else 0 end;
  new.seller_id := v_owner;
  return new;
end;
$$;
drop trigger if exists orders_fill on public.orders;
create trigger orders_fill before insert on public.orders for each row execute function public.fill_order();

create or replace function public.after_order()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_title text;
begin
  select title into v_title from public.products where id = new.product_id;
  perform public.notify(new.buyer_id, 'Order confirmed: ' || v_title || '.', '/activity', 'marketplace');
  if new.seller_id is not null and new.seller_id <> new.buyer_id then
    perform public.notify(new.seller_id, 'New order for ' || v_title || '!', '/activity', 'marketplace');
  end if;
  return new;
end;
$$;
drop trigger if exists orders_notify on public.orders;
create trigger orders_notify after insert on public.orders for each row execute function public.after_order();

-- Course purchases: price from the course; buyer and creator hear about it.
create or replace function public.fill_course_purchase()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  new.total := coalesce((select price from public.courses where id = new.course_id), 0);
  return new;
end;
$$;
drop trigger if exists course_purchases_fill on public.course_purchases;
create trigger course_purchases_fill before insert on public.course_purchases for each row execute function public.fill_course_purchase();

create or replace function public.after_course_purchase()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_course public.courses;
begin
  select * into v_course from public.courses where id = new.course_id;
  perform public.notify(new.buyer_id, 'You now have ' || v_course.title || '. Enjoy!', '/mindplace/course/?id=' || v_course.id, 'mindplace');
  if v_course.expert_id <> new.buyer_id then
    perform public.notify(v_course.expert_id, 'Someone bought your course ' || v_course.title || '!', '/teach', 'mindplace');
  end if;
  return new;
end;
$$;
drop trigger if exists course_purchases_notify on public.course_purchases;
create trigger course_purchases_notify after insert on public.course_purchases for each row execute function public.after_course_purchase();

create or replace function public.after_creator_plan()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status <> 'active') then
    perform public.notify(new.user_id, 'Your creator plan is active. Publish your first course!', '/teach', 'mindplace');
  end if;
  return new;
end;
$$;
drop trigger if exists creator_plans_notify on public.creator_plans;
create trigger creator_plans_notify after insert or update on public.creator_plans for each row execute function public.after_creator_plan();

create or replace function public.after_enrollment_progress()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_total integer; v_title text;
begin
  select count(*) into v_total from public.course_lessons where course_id = new.course_id;
  if v_total > 0 and cardinality(new.completed) >= v_total and cardinality(coalesce(old.completed, '{}')) < v_total then
    select title into v_title from public.courses where id = new.course_id;
    perform public.notify(new.user_id, 'You completed ' || v_title || '. Beautiful work!', '/mindplace/course/?id=' || new.course_id, 'mindplace');
  end if;
  return new;
end;
$$;
drop trigger if exists enrollments_notify on public.enrollments;
create trigger enrollments_notify after update of completed on public.enrollments for each row execute function public.after_enrollment_progress();

create or replace function public.after_comment()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_author text;
begin
  select author_id into v_author from public.posts where id = new.post_id;
  if v_author is not null and v_author <> new.author_id then
    perform public.notify(v_author, 'Someone commented on your post.', '/yourplace', 'yourplace');
  end if;
  return new;
end;
$$;
drop trigger if exists post_comments_notify on public.post_comments;
create trigger post_comments_notify after insert on public.post_comments for each row execute function public.after_comment();

create or replace function public.after_reply()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_d public.discussions;
begin
  select * into v_d from public.discussions where id = new.discussion_id;
  if v_d.author_id <> new.author_id then
    perform public.notify(v_d.author_id, 'New reply on “' || v_d.title || '”.', '/mindplace/discussion/?id=' || v_d.id, 'mindplace');
  end if;
  return new;
end;
$$;
drop trigger if exists discussion_replies_notify on public.discussion_replies;
create trigger discussion_replies_notify after insert on public.discussion_replies for each row execute function public.after_reply();

create or replace function public.after_message()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform public.notify(p.user_id, 'You have a new message.', '/messages/?t=' || new.thread_id, 'yourplace')
     from public.thread_participants p
    where p.thread_id = new.thread_id and p.user_id <> new.sender_id;
  update public.thread_participants set read_at = greatest(read_at, new.created_at)
   where thread_id = new.thread_id and user_id = new.sender_id;
  return new;
end;
$$;
drop trigger if exists messages_notify on public.messages;
create trigger messages_notify after insert on public.messages for each row execute function public.after_message();

create or replace function public.after_application()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_o public.opportunities;
begin
  select * into v_o from public.opportunities where id = new.opportunity_id;
  perform public.notify(new.applicant_id, 'Application sent: ' || v_o.title || ' at ' || v_o.org || '.', '/activity', 'workplace');
  if v_o.posted_by <> new.applicant_id then
    perform public.notify(v_o.posted_by, 'New applicant for ' || v_o.title || '.', '/activity', 'workplace');
  end if;
  return new;
end;
$$;
drop trigger if exists applications_notify on public.applications;
create trigger applications_notify after insert on public.applications for each row execute function public.after_application();

-- Ads start when their Place's banner slot is free. Serialized per Place so bookings never overlap.
create or replace function public.schedule_ad()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_start timestamptz;
begin
  perform pg_advisory_xact_lock(hashtext('places_ads_' || new.district));
  select greatest(now(), coalesce(max(ends_at), now())) into v_start from public.ads where district = new.district;
  new.starts_at := v_start;
  new.ends_at := v_start + case new.plan when 'week' then interval '7 days' else interval '30 days' end;
  return new;
end;
$$;
drop trigger if exists ads_schedule on public.ads;
create trigger ads_schedule before insert on public.ads for each row execute function public.schedule_ad();

create or replace function public.after_ad()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform public.notify(new.owner_id, 'Your ad in ' || new.district || ' is booked.', '/advertise', new.district);
  return new;
end;
$$;
drop trigger if exists ads_notify on public.ads;
create trigger ads_notify after insert on public.ads for each row execute function public.after_ad();

-- Someone added to a workroom hears about it (hires get their own "you're hired" note instead).
create or replace function public.after_workroom_member()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_w public.workrooms;
begin
  select * into v_w from public.workrooms where id = new.workroom_id;
  if new.user_id <> public.me() and v_w.contract_id is null then
    perform public.notify(new.user_id, 'You were added to the workroom “' || v_w.name || '”.', '/workroom/?id=' || v_w.id, 'workplace');
  end if;
  return new;
end;
$$;
drop trigger if exists workroom_members_notify on public.workroom_members;
create trigger workroom_members_notify after insert on public.workroom_members for each row execute function public.after_workroom_member();

create or replace function public.after_room_message()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update public.workroom_members set read_at = greatest(read_at, new.created_at)
   where workroom_id = new.workroom_id and user_id = new.sender_id;
  return new;
end;
$$;
drop trigger if exists workroom_messages_read on public.workroom_messages;
create trigger workroom_messages_read after insert on public.workroom_messages for each row execute function public.after_room_message();

-- Hiring: the guide welcomes everyone in the new workroom, and the hire hears the news.
create or replace function public.after_hire()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_channel text; v_worker text;
begin
  select name into v_worker from public.profiles where id = new.worker_id;
  if new.workroom_id is not null then
    select id into v_channel from public.workroom_channels where workroom_id = new.workroom_id order by (name = 'general') desc, id limit 1;
    if v_channel is not null and exists (select 1 from public.profiles where id = 'p_guide') then
      insert into public.workroom_messages (id, workroom_id, channel_id, sender_id, body, created_at)
      values ('wm_' || replace(gen_random_uuid()::text, '-', ''), new.workroom_id, v_channel, 'p_guide',
              'Welcome to your workroom for “' || new.title || '”. ' || coalesce(v_worker, 'Your new teammate') ||
              ' was hired. Use #general to chat and #updates for progress. Invoices live in the contract panel.', now());
    end if;
  end if;
  perform public.notify(new.worker_id, 'You’re hired for ' || new.title || '! Your workroom is ready.', '/workroom/?id=' || coalesce(new.workroom_id, ''), 'workplace');
  return new;
end;
$$;
drop trigger if exists contracts_hire on public.contracts;
create trigger contracts_hire after insert on public.contracts for each row execute function public.after_hire();

create or replace function public.after_contract_update()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'completed' and old.status <> 'completed' then
    perform public.notify(new.worker_id, new.title || ' is complete. Great work!', '/workroom/?id=' || coalesce(new.workroom_id, ''), 'workplace');
  end if;
  return new;
end;
$$;
drop trigger if exists contracts_update on public.contracts;
create trigger contracts_update after update on public.contracts for each row execute function public.after_contract_update();

create or replace function public.after_invoice()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_c public.contracts;
begin
  select * into v_c from public.contracts where id = new.contract_id;
  if tg_op = 'INSERT' then
    perform public.notify(v_c.employer_id, 'Payment requested for ' || v_c.title || '.', '/workroom/?id=' || coalesce(v_c.workroom_id, ''), 'workplace');
  elsif new.status = 'paid' and old.status <> 'paid' then
    perform public.notify(v_c.worker_id, 'You were paid for ' || v_c.title || '.', '/workroom/?id=' || coalesce(v_c.workroom_id, ''), 'workplace');
  end if;
  return new;
end;
$$;
drop trigger if exists invoices_notify on public.invoices;
create trigger invoices_notify after insert or update on public.invoices for each row execute function public.after_invoice();

-- Payment status only moves open → paid, and only with a paid date.
create or replace function public.guard_invoice()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.status = 'paid' and old.status = 'open' then
    new.paid_at := coalesce(new.paid_at, now());
  elsif new.status <> old.status then
    raise exception 'Invoices can only be marked paid.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists invoices_guard on public.invoices;
create trigger invoices_guard before update on public.invoices for each row execute function public.guard_invoice();

do $$
declare f text;
begin
  foreach f in array array[
    'handle_new_member()', 'fill_order()', 'after_order()', 'fill_course_purchase()', 'after_course_purchase()',
    'after_creator_plan()', 'after_enrollment_progress()', 'after_comment()', 'after_reply()', 'after_message()',
    'after_application()', 'schedule_ad()', 'after_ad()', 'after_workroom_member()', 'after_room_message()',
    'after_hire()', 'after_contract_update()', 'after_invoice()', 'guard_invoice()'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

-- ============================================================================
-- Realtime: the world updates live for everyone (each person only receives
-- changes their row-level security lets them see).
-- ============================================================================
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then return; end if;
  foreach t in array array[
    'profiles', 'creator_plans', 'follows', 'posts', 'post_likes', 'post_comments', 'poll_votes', 'courses',
    'course_lessons', 'course_purchases', 'discussions', 'discussion_upvotes', 'discussion_replies', 'shops',
    'products', 'orders', 'opportunities', 'applications', 'threads', 'thread_participants', 'messages',
    'notifications', 'ads', 'workrooms', 'workroom_members', 'workroom_channels', 'workroom_messages',
    'contracts', 'invoices'
  ] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ============================================================================
-- Storage: photos people add (avatars, posts, products, shops, courses, ads).
-- Public to read; each member writes only inside their own folder `<user id>/…`.
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "media: read" on storage.objects;
create policy "media: read" on storage.objects for select to anon, authenticated using (bucket_id = 'media');
drop policy if exists "media: upload own" on storage.objects;
create policy "media: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = public.me());
drop policy if exists "media: replace own" on storage.objects;
create policy "media: replace own" on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = public.me())
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = public.me());
drop policy if exists "media: delete own" on storage.objects;
create policy "media: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = public.me());
