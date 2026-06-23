-- GuiaAbierta: esquema inicial para un proyecto Supabase nuevo.
-- Ejecutar en SQL Editor. No requiere claves privadas.

create extension if not exists pgcrypto;

create or replace function public.guia_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.guia_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  short_description text,
  cover_image_url text,
  cover_thumbnail_url text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.guia_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  icon text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.guia_elements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.guia_projects(id) on delete cascade,
  category_id uuid references public.guia_categories(id) on delete set null,
  title text not null,
  slug text not null,
  short_description text,
  long_description text,
  main_image_url text,
  main_thumbnail_url text,
  maps_url text,
  active boolean not null default true,
  featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guia_elements_project_slug_unique unique (project_id, slug)
);

create table if not exists public.guia_element_images (
  id uuid primary key default gen_random_uuid(),
  element_id uuid not null references public.guia_elements(id) on delete cascade,
  image_url text not null,
  thumbnail_url text,
  title text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.guia_element_audios (
  id uuid primary key default gen_random_uuid(),
  element_id uuid not null references public.guia_elements(id) on delete cascade,
  title text,
  language text,
  audio_url text not null,
  duration integer,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.guia_element_links (
  id uuid primary key default gen_random_uuid(),
  element_id uuid not null references public.guia_elements(id) on delete cascade,
  title text not null,
  url text not null,
  type text default 'Otro',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists guia_projects_active_sort_idx on public.guia_projects(active, sort_order);
create index if not exists guia_categories_active_sort_idx on public.guia_categories(active, sort_order);
create index if not exists guia_elements_project_active_sort_idx on public.guia_elements(project_id, active, sort_order);
create index if not exists guia_element_images_element_sort_idx on public.guia_element_images(element_id, sort_order);
create index if not exists guia_element_audios_element_sort_idx on public.guia_element_audios(element_id, sort_order);
create index if not exists guia_element_links_element_sort_idx on public.guia_element_links(element_id, sort_order);

drop trigger if exists guia_projects_updated_at on public.guia_projects;
create trigger guia_projects_updated_at
before update on public.guia_projects
for each row execute function public.guia_set_updated_at();

drop trigger if exists guia_elements_updated_at on public.guia_elements;
create trigger guia_elements_updated_at
before update on public.guia_elements
for each row execute function public.guia_set_updated_at();

alter table public.guia_projects enable row level security;
alter table public.guia_categories enable row level security;
alter table public.guia_elements enable row level security;
alter table public.guia_element_images enable row level security;
alter table public.guia_element_audios enable row level security;
alter table public.guia_element_links enable row level security;

alter table public.guia_projects
add column if not exists cover_thumbnail_url text;

alter table public.guia_elements
add column if not exists main_thumbnail_url text;

drop policy if exists "Public can read active guia projects" on public.guia_projects;
create policy "Public can read active guia projects"
on public.guia_projects for select
using (active = true or auth.role() = 'authenticated');

drop policy if exists "Public can read active guia categories" on public.guia_categories;
create policy "Public can read active guia categories"
on public.guia_categories for select
using (active = true or auth.role() = 'authenticated');

drop policy if exists "Public can read active guia elements" on public.guia_elements;
create policy "Public can read active guia elements"
on public.guia_elements for select
using (active = true or auth.role() = 'authenticated');

drop policy if exists "Public can read guia images for active elements" on public.guia_element_images;
create policy "Public can read guia images for active elements"
on public.guia_element_images for select
using (
  exists (
    select 1 from public.guia_elements e
    where e.id = element_id and (e.active = true or auth.role() = 'authenticated')
  )
);

drop policy if exists "Public can read guia audios for active elements" on public.guia_element_audios;
create policy "Public can read guia audios for active elements"
on public.guia_element_audios for select
using (
  exists (
    select 1 from public.guia_elements e
    where e.id = element_id and (e.active = true or auth.role() = 'authenticated')
  )
);

drop policy if exists "Public can read guia links for active elements" on public.guia_element_links;
create policy "Public can read guia links for active elements"
on public.guia_element_links for select
using (
  exists (
    select 1 from public.guia_elements e
    where e.id = element_id and (e.active = true or auth.role() = 'authenticated')
  )
);

drop policy if exists "Authenticated admins manage guia projects" on public.guia_projects;
create policy "Authenticated admins manage guia projects"
on public.guia_projects for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated admins manage guia categories" on public.guia_categories;
create policy "Authenticated admins manage guia categories"
on public.guia_categories for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated admins manage guia elements" on public.guia_elements;
create policy "Authenticated admins manage guia elements"
on public.guia_elements for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated admins manage guia images" on public.guia_element_images;
create policy "Authenticated admins manage guia images"
on public.guia_element_images for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated admins manage guia audios" on public.guia_element_audios;
create policy "Authenticated admins manage guia audios"
on public.guia_element_audios for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated admins manage guia links" on public.guia_element_links;
create policy "Authenticated admins manage guia links"
on public.guia_element_links for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

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

insert into public.guia_categories (name, slug, icon, sort_order)
values
  ('Monumentos', 'monumentos', 'landmark', 1),
  ('Instituciones', 'instituciones', 'building', 2),
  ('Servicios publicos', 'servicios-publicos', 'services', 3),
  ('Cultura', 'cultura', 'culture', 4),
  ('Transporte', 'transporte', 'transport', 5),
  ('Salud', 'salud', 'health', 6),
  ('Educacion', 'educacion', 'education', 7),
  ('Ayuda social', 'ayuda-social', 'support', 8),
  ('Otros', 'otros', 'more', 9)
on conflict (slug) do update
set name = excluded.name,
    icon = excluded.icon,
    sort_order = excluded.sort_order,
    active = true;

-- Almacenamiento:
-- Este script crea el bucket publico guia-media.
-- Limite de subida por archivo: 5 MB. La app optimiza imagenes a WebP hasta unos 500 KB y guarda miniaturas.
