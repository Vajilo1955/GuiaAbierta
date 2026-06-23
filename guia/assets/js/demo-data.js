export const demoCategories = [
  { id: 'cat-1', name: 'Monumentos', slug: 'monumentos', icon: 'landmark', sort_order: 1, active: true },
  { id: 'cat-2', name: 'Servicios publicos', slug: 'servicios-publicos', icon: 'building', sort_order: 2, active: true },
  { id: 'cat-3', name: 'Salud', slug: 'salud', icon: 'health', sort_order: 3, active: true },
  { id: 'cat-4', name: 'Ayuda social', slug: 'ayuda-social', icon: 'support', sort_order: 4, active: true }
];

export const demoProjects = [
  {
    id: 'project-1',
    name: 'Centro Historico',
    slug: 'centro-historico',
    short_description: 'Una guia sencilla para orientarse por los lugares principales del centro.',
    cover_image_url: 'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1200&q=80',
    active: true,
    sort_order: 1
  },
  {
    id: 'project-2',
    name: 'Servicios Cercanos',
    slug: 'servicios-cercanos',
    short_description: 'Recursos utiles para tramites, salud, transporte y atencion social.',
    cover_image_url: 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80',
    active: true,
    sort_order: 2
  }
];

export const demoElements = [
  {
    id: 'el-1',
    project_id: 'project-1',
    category_id: 'cat-1',
    title: 'Plaza Mayor',
    slug: 'plaza-mayor',
    short_description: 'Punto de encuentro central con comercios, bancos y transporte cercano.',
    long_description: 'La Plaza Mayor es un lugar facil para orientarse. Desde aqui puedes encontrar paradas de autobus, oficinas municipales, cafeterias y calles principales. Es un buen punto de referencia si acabas de llegar.',
    main_image_url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
    maps_url: 'https://www.google.com/maps',
    active: true,
    featured: true,
    sort_order: 1
  },
  {
    id: 'el-2',
    project_id: 'project-1',
    category_id: 'cat-2',
    title: 'Ayuntamiento',
    slug: 'ayuntamiento',
    short_description: 'Edificio municipal para informacion, padron y tramites locales.',
    long_description: 'En el Ayuntamiento puedes pedir informacion general, consultar horarios de atencion y recibir orientacion sobre tramites municipales. Revisa los enlaces utiles antes de ir.',
    main_image_url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
    maps_url: 'https://www.google.com/maps',
    active: true,
    featured: false,
    sort_order: 2
  },
  {
    id: 'el-3',
    project_id: 'project-2',
    category_id: 'cat-3',
    title: 'Centro de Salud',
    slug: 'centro-de-salud',
    short_description: 'Atencion sanitaria, citas y consultas basicas.',
    long_description: 'El centro de salud ofrece atencion medica primaria. Para urgencias graves llama al telefono de emergencias de tu zona. Lleva documentacion personal y tarjeta sanitaria si la tienes.',
    main_image_url: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1200&q=80',
    maps_url: 'https://www.google.com/maps',
    active: true,
    featured: true,
    sort_order: 1
  }
];

export const demoImages = [
  { id: 'img-1', element_id: 'el-1', image_url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80', thumbnail_url: '', title: 'Vista general', sort_order: 1 },
  { id: 'img-2', element_id: 'el-1', image_url: 'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1200&q=80', thumbnail_url: '', title: 'Calles cercanas', sort_order: 2 },
  { id: 'img-3', element_id: 'el-1', image_url: 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80', thumbnail_url: '', title: 'Servicios proximos', sort_order: 3 },
  { id: 'img-4', element_id: 'el-1', image_url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80', thumbnail_url: '', title: 'Edificios cercanos', sort_order: 4 },
  { id: 'img-5', element_id: 'el-2', image_url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80', thumbnail_url: '', title: 'Entrada principal', sort_order: 1 },
  { id: 'img-6', element_id: 'el-3', image_url: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1200&q=80', thumbnail_url: '', title: 'Centro de salud', sort_order: 1 }
];

export const demoAudios = [
  { id: 'aud-1', element_id: 'el-1', title: 'Audio guia', language: 'Espanol', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', duration: null, sort_order: 1 },
  { id: 'aud-2', element_id: 'el-1', title: 'Audio guide', language: 'English', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', duration: null, sort_order: 2 },
  { id: 'aud-3', element_id: 'el-3', title: 'Informacion sanitaria', language: 'Espanol', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', duration: null, sort_order: 1 }
];

export const demoLinks = [
  { id: 'lnk-1', element_id: 'el-2', title: 'Web municipal', url: 'https://www.google.com', type: 'Web oficial', sort_order: 1 },
  { id: 'lnk-2', element_id: 'el-3', title: 'Pedir cita', url: 'https://www.google.com', type: 'Cita previa', sort_order: 1 },
  { id: 'lnk-3', element_id: 'el-3', title: 'Emergencias', url: 'https://www.google.com', type: 'Emergencia', sort_order: 2 }
];
