-- ============================================================================
-- Videos in posts.
--
--   * posts.video holds a link to the video (like posts.image holds a photo link).
--   * Videos live in their own public bucket, `videos`: MP4, WebM or MOV up to 50 MB, each member
--     uploading only into their own folder, like photos in `media`.
--
-- Safe to run more than once. Adds a column and a bucket only.
-- ============================================================================

alter table public.posts add column if not exists video text;
alter table public.posts drop constraint if exists posts_video_check;
alter table public.posts add constraint posts_video_check check (public.is_image_url(video));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', true, 52428800, array['video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "videos: read" on storage.objects;
create policy "videos: read" on storage.objects for select to anon, authenticated using (bucket_id = 'videos');
drop policy if exists "videos: upload own" on storage.objects;
create policy "videos: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'videos' and (storage.foldername(name))[1] = public.me());
drop policy if exists "videos: replace own" on storage.objects;
create policy "videos: replace own" on storage.objects for update to authenticated
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = public.me())
  with check (bucket_id = 'videos' and (storage.foldername(name))[1] = public.me());
drop policy if exists "videos: delete own" on storage.objects;
create policy "videos: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = public.me());

-- Members may write the video link on their own posts (writes stay limited to their own rows by RLS).
grant insert (video), update (video) on public.posts to authenticated;
