-- ============================================================================
-- Link previews for posts: what the link-preview edge function found at a web address (title,
-- description, image), kept for a week so each site is read once, not on every view.
-- Written only by the edge function (service role); anyone may read.
--
-- Safe to run more than once. Adds a table only.
-- ============================================================================

create table if not exists public.link_previews (
  url          text primary key check (char_length(url) <= 2048),
  final_url    text check (final_url is null or char_length(final_url) <= 2048),
  title        text check (title is null or char_length(title) <= 200),
  description  text check (description is null or char_length(description) <= 300),
  image        text check (image is null or char_length(image) <= 2048),
  site_name    text check (site_name is null or char_length(site_name) <= 80),
  fetched_at   timestamptz not null default now()
);

alter table public.link_previews enable row level security;

drop policy if exists "link_previews: read" on public.link_previews;
create policy "link_previews: read" on public.link_previews for select to anon, authenticated using (true);
-- No insert/update/delete policies: only the edge function (service role) writes.

revoke all on public.link_previews from anon, authenticated;
grant select on public.link_previews to anon, authenticated;
