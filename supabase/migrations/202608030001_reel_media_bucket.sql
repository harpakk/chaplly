insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('reel-media','reel-media',true,104857600,array['video/mp4','video/webm','video/quicktime'])
on conflict(id) do update set
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists reel_media_public_read on storage.objects;
create policy reel_media_public_read on storage.objects
for select to anon,authenticated
using(bucket_id='reel-media');
