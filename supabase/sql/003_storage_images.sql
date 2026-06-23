-- Ejecutar si ya habias aplicado 001_schema.sql antes de incorporar la subida de imagenes.
-- Anade miniaturas de portada/elemento y configura el bucket guia-media.

alter table public.guia_projects
add column if not exists cover_thumbnail_url text;

alter table public.guia_elements
add column if not exists main_thumbnail_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'guia-media',
  'guia-media',
  true,
  5242880,
  array['image/webp', 'image/jpeg', 'image/png', 'audio/mpeg', 'audio/mp4']
)
on conflict (id) do update
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read guia media" on storage.objects;
create policy "Public can read guia media"
on storage.objects for select
using (bucket_id = 'guia-media');

drop policy if exists "Authenticated admins can upload guia media" on storage.objects;
create policy "Authenticated admins can upload guia media"
on storage.objects for insert
with check (bucket_id = 'guia-media' and auth.role() = 'authenticated');

drop policy if exists "Authenticated admins can update guia media" on storage.objects;
create policy "Authenticated admins can update guia media"
on storage.objects for update
using (bucket_id = 'guia-media' and auth.role() = 'authenticated')
with check (bucket_id = 'guia-media' and auth.role() = 'authenticated');

drop policy if exists "Authenticated admins can delete guia media" on storage.objects;
create policy "Authenticated admins can delete guia media"
on storage.objects for delete
using (bucket_id = 'guia-media' and auth.role() = 'authenticated');
