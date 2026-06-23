-- Datos de ejemplo para validar GuiaAbierta.

with project as (
  insert into public.guia_projects (name, slug, short_description, cover_image_url, cover_thumbnail_url, sort_order)
  values (
    'Centro Historico',
    'centro-historico',
    'Una guia sencilla para orientarse por los lugares principales del centro.',
    'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=520&q=70',
    1
  )
  on conflict (slug) do update
  set short_description = excluded.short_description,
      cover_image_url = excluded.cover_image_url,
      cover_thumbnail_url = excluded.cover_thumbnail_url
  returning id
),
cat_monumento as (
  select id from public.guia_categories where slug = 'monumentos' limit 1
),
cat_servicio as (
  select id from public.guia_categories where slug = 'servicios-publicos' limit 1
),
plaza as (
  insert into public.guia_elements (
    project_id, category_id, title, slug, short_description, long_description,
    main_image_url, main_thumbnail_url, maps_url, featured, sort_order
  )
  select
    project.id,
    cat_monumento.id,
    'Plaza Mayor',
    'plaza-mayor',
    'Punto de encuentro central con comercios, bancos y transporte cercano.',
    'La Plaza Mayor es un lugar facil para orientarse. Desde aqui puedes encontrar paradas de autobus, oficinas municipales, cafeterias y calles principales.',
    'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=520&q=70',
    'https://www.google.com/maps',
    true,
    1
  from project, cat_monumento
  on conflict (project_id, slug) do update
  set short_description = excluded.short_description,
      long_description = excluded.long_description,
      main_image_url = excluded.main_image_url,
      main_thumbnail_url = excluded.main_thumbnail_url
  returning id
),
ayuntamiento as (
  insert into public.guia_elements (
    project_id, category_id, title, slug, short_description, long_description,
    main_image_url, main_thumbnail_url, maps_url, sort_order
  )
  select
    project.id,
    cat_servicio.id,
    'Ayuntamiento',
    'ayuntamiento',
    'Edificio municipal para informacion, padron y tramites locales.',
    'En el Ayuntamiento puedes pedir informacion general, consultar horarios de atencion y recibir orientacion sobre tramites municipales.',
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=520&q=70',
    'https://www.google.com/maps',
    2
  from project, cat_servicio
  on conflict (project_id, slug) do update
  set short_description = excluded.short_description,
      long_description = excluded.long_description,
      main_image_url = excluded.main_image_url,
      main_thumbnail_url = excluded.main_thumbnail_url
  returning id
)
insert into public.guia_element_images (element_id, image_url, thumbnail_url, title, sort_order)
select plaza.id, url, url, title, ord
from plaza
cross join (values
  ('https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80', 'Vista general', 1),
  ('https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1200&q=80', 'Calles cercanas', 2),
  ('https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80', 'Servicios proximos', 3),
  ('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80', 'Edificios cercanos', 4)
) as sample(url, title, ord)
where not exists (
  select 1 from public.guia_element_images existing
  where existing.element_id = plaza.id and existing.image_url = sample.url
);

insert into public.guia_element_audios (element_id, title, language, audio_url, sort_order)
select e.id, 'Audio guia', 'Espanol', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', 1
from public.guia_elements e
join public.guia_projects p on p.id = e.project_id
where p.slug = 'centro-historico'
  and e.slug = 'plaza-mayor'
  and not exists (
    select 1 from public.guia_element_audios existing
    where existing.element_id = e.id and existing.audio_url = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
  );

insert into public.guia_element_links (element_id, title, url, type, sort_order)
select e.id, 'Web municipal', 'https://www.google.com', 'Web oficial', 1
from public.guia_elements e
join public.guia_projects p on p.id = e.project_id
where p.slug = 'centro-historico'
  and e.slug = 'ayuntamiento'
  and not exists (
    select 1 from public.guia_element_links existing
    where existing.element_id = e.id and existing.url = 'https://www.google.com'
  );
