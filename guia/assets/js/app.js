import { supabase, getSession, initSupabase, signIn, signOut } from './supabase-client.js';
import { demoAudios, demoCategories, demoElements, demoImages, demoLinks, demoProjects } from './demo-data.js';

const app = document.querySelector('#app');
const menuButton = document.querySelector('[data-menu-toggle]');
const nav = document.querySelector('[data-main-nav]');
const lightbox = document.querySelector('[data-lightbox]');
const BASE_PATH = getBasePath();
document.querySelectorAll('[data-route]').forEach((link) => {
  link.setAttribute('href', routePath(link.dataset.route || '/'));
});

const state = {
  projects: [],
  categories: [],
  elements: [],
  images: [],
  audios: [],
  links: [],
  session: null,
  source: 'demo',
  lightboxImages: [],
  lightboxIndex: 0
};

menuButton.addEventListener('click', () => {
  const open = nav.classList.toggle('is-open');
  menuButton.setAttribute('aria-expanded', String(open));
});

window.addEventListener('popstate', render);
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href]');
  if (!link || link.target === '_blank' || event.metaKey || event.ctrlKey) return;
  if (link.dataset.route) {
    event.preventDefault();
    navigate(routePath(link.dataset.route));
    return;
  }
  const url = new URL(link.href, window.location.origin);
  if (url.origin !== window.location.origin || !url.pathname.startsWith(BASE_PATH)) return;
  event.preventDefault();
  navigate(url.pathname + url.search);
});

document.addEventListener('submit', async (event) => {
  const form = event.target;
  if (!form.matches('[data-action]')) return;
  event.preventDefault();
  await handleAction(form);
});

document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-command]');
  if (!button) return;
  await handleCommand(button);
});

init();

async function init() {
  const redirected = new URLSearchParams(window.location.search).get('route');
  if (redirected) history.replaceState({}, '', redirected);
  await initSupabase();
  state.session = await getSession();
  await loadData();
  render();
}

function navigate(path) {
  history.pushState({}, '', path);
  nav.classList.remove('is-open');
  menuButton.setAttribute('aria-expanded', 'false');
  render();
  app.focus();
}

function getBasePath() {
  const segments = window.location.pathname.split('/').filter(Boolean);
  const guiaIndex = segments.indexOf('guia');
  if (guiaIndex >= 0) return `/${segments.slice(0, guiaIndex + 1).join('/')}/`;
  return '/guia/';
}

function routePath(route = '/') {
  const cleanRoute = route.replace(/^\/+/, '');
  return `${BASE_PATH}${cleanRoute}`;
}

async function loadData() {
  const fallback = () => {
    state.projects = demoProjects;
    state.categories = demoCategories;
    state.elements = demoElements;
    state.images = demoImages;
    state.audios = demoAudios;
    state.links = demoLinks;
    state.source = 'demo';
  };

  if (!supabase) {
    fallback();
    return;
  }

  try {
    const [projects, categories, elements, images, audios, links] = await Promise.all([
      supabase.from('guia_projects').select('*').order('sort_order'),
      supabase.from('guia_categories').select('*').order('sort_order'),
      supabase.from('guia_elements').select('*').order('sort_order'),
      supabase.from('guia_element_images').select('*').order('sort_order'),
      supabase.from('guia_element_audios').select('*').order('sort_order'),
      supabase.from('guia_element_links').select('*').order('sort_order')
    ]);
    const error = [projects, categories, elements, images, audios, links].find((item) => item.error);
    if (error) throw error.error;
    state.projects = projects.data || [];
    state.categories = categories.data || [];
    state.elements = elements.data || [];
    state.images = images.data || [];
    state.audios = audios.data || [];
    state.links = links.data || [];
    state.source = 'supabase';
  } catch (error) {
    console.warn('Usando datos demo:', error.message);
    fallback();
  }
}

function render() {
  const path = normalizePath(currentRoute());
  const parts = path.split('/').filter(Boolean);

  if (path === '/' || path === '') return renderLanding();
  if (path === '/proyectos/') return renderProjects();
  if (parts[0] === 'proyecto' && parts.length === 2) return renderProject(parts[1]);
  if (parts[0] === 'proyecto' && parts.length === 3) return renderElement(parts[1], parts[2]);
  if (parts[0] === 'admin') return renderAdmin();
  renderNotFound();
}

function currentRoute() {
  const path = window.location.pathname.startsWith(BASE_PATH)
    ? window.location.pathname.slice(BASE_PATH.length - 1)
    : window.location.pathname;
  return path || '/';
}

function normalizePath(path) {
  return path.endsWith('/') ? path : `${path}/`;
}

function activeProjects() {
  return state.projects.filter((project) => project.active || state.session);
}

function activeElements(projectId) {
  return state.elements
    .filter((element) => element.project_id === projectId && (element.active || state.session))
    .sort(bySort);
}

function bySort(a, b) {
  return Number(a.sort_order || 0) - Number(b.sort_order || 0);
}

function categoryName(id) {
  return state.categories.find((category) => category.id === id)?.name || 'Otros';
}

function renderLanding() {
  app.innerHTML = `
    <section class="hero">
      <div class="hero-media" aria-hidden="true"></div>
      <div class="hero-content">
        <p class="eyebrow">Guia audiovisual accesible</p>
        <h1>GuiaAbierta</h1>
        <p>Descubre los lugares importantes de tu localidad con imagenes, audios, mapas y enlaces utiles. Una guia pensada para ayudarte a orientarte, conocer tu entorno y acceder mejor a los servicios cercanos.</p>
        <div class="actions">
          <a class="button primary" href="${routePath('/proyectos/')}">Ver guias disponibles</a>
          <a class="button secondary" href="${routePath('/admin/')}">Acceso administradores</a>
        </div>
      </div>
    </section>
    <section class="info-grid section">
      ${infoBlock('Para quien', 'Personas recien llegadas, casas de acogida, visitantes y cualquier persona que necesite informacion local sencilla.')}
      ${infoBlock('Como funciona', 'Elige una guia, abre un lugar y consulta imagenes, textos claros, audios, mapas y enlaces utiles.')}
      ${infoBlock('Que puedes encontrar', 'Monumentos, instituciones, salud, transporte, cultura, educacion, ayuda social y otros servicios.')}
      ${infoBlock('Ventajas', 'Contenido visual, audios en varios idiomas, botones grandes, buen contraste y navegacion pensada para movil.')}
    </section>
  `;
}

function infoBlock(title, text) {
  return `<article class="info-block"><h2>${title}</h2><p>${text}</p></article>`;
}

function renderProjects() {
  const cards = activeProjects().sort(bySort).map((project) => `
    <article class="project-card">
      <img src="${escapeAttr(project.cover_image_url)}" alt="Imagen de ${escapeAttr(project.name)}" loading="lazy">
      <div>
        <h2>${escapeHtml(project.name)}</h2>
        <p>${escapeHtml(project.short_description || 'Guia local disponible.')}</p>
        <a class="button primary" href="${routePath(`/proyecto/${project.slug}/`)}">Ver guia</a>
      </div>
    </article>
  `).join('');

  app.innerHTML = `
    <section class="page-head">
      <p class="eyebrow">${state.source === 'demo' ? 'Vista demo' : 'Datos en directo'}</p>
      <h1>Guias disponibles</h1>
      <p>Selecciona una localidad o zona para consultar sus lugares de interes.</p>
    </section>
    <section class="cards-grid">${cards || emptyState('Todavia no hay proyectos activos.')}</section>
  `;
}

function renderProject(slug) {
  const project = state.projects.find((item) => item.slug === slug);
  if (!project) return renderNotFound();
  const selectedCategory = new URLSearchParams(location.search).get('categoria') || 'todas';
  const elements = activeElements(project.id).filter((element) => selectedCategory === 'todas' || element.category_id === selectedCategory);
  const filters = ['todas', ...state.categories.filter((c) => c.active).map((c) => c.id)].map((id) => {
    const label = id === 'todas' ? 'Todas' : categoryName(id);
    const active = selectedCategory === id ? ' aria-current="true"' : '';
    return `<a class="chip" href="${routePath(`/proyecto/${project.slug}/`)}?categoria=${id}"${active}>${escapeHtml(label)}</a>`;
  }).join('');

  app.innerHTML = `
    <section class="project-hero">
      <img src="${escapeAttr(project.cover_image_url)}" alt="Imagen de ${escapeAttr(project.name)}">
      <div>
        <a class="back-link" href="${routePath('/proyectos/')}">Volver a guias</a>
        <h1>${escapeHtml(project.name)}</h1>
        <p>${escapeHtml(project.short_description || '')}</p>
      </div>
    </section>
    <section class="filter-row" aria-label="Filtrar por categoria">${filters}</section>
    <section class="cards-grid">${elements.map(elementCard).join('') || emptyState('No hay elementos para este filtro.')}</section>
  `;
}

function elementCard(element) {
  const audio = state.audios.find((item) => item.element_id === element.id);
  return `
    <article class="place-card">
      <img src="${escapeAttr(element.main_image_url)}" alt="Imagen de ${escapeAttr(element.title)}" loading="lazy">
      <div class="place-card-body">
        <p class="tag">${escapeHtml(categoryName(element.category_id))}</p>
        <h2>${escapeHtml(element.title)}</h2>
        <p>${escapeHtml(element.short_description || '')}</p>
        <div class="actions compact">
          <a class="button primary" href="${elementUrl(element)}">Ver informacion</a>
          ${element.maps_url ? `<a class="button secondary" href="${escapeAttr(element.maps_url)}" target="_blank" rel="noreferrer">Como llegar</a>` : ''}
          ${audio ? `<button class="button ghost" type="button" data-command="play-audio" data-audio="${escapeAttr(audio.id)}">Escuchar audio</button>` : ''}
        </div>
      </div>
    </article>
  `;
}

function elementUrl(element) {
  const project = state.projects.find((item) => item.id === element.project_id);
  return routePath(`/proyecto/${project?.slug || ''}/${element.slug}/`);
}

function renderElement(projectSlug, elementSlug) {
  const project = state.projects.find((item) => item.slug === projectSlug);
  const element = state.elements.find((item) => item.slug === elementSlug && item.project_id === project?.id);
  if (!project || !element) return renderNotFound();
  const images = state.images.filter((item) => item.element_id === element.id).sort(bySort);
  const audios = state.audios.filter((item) => item.element_id === element.id).sort(bySort);
  const links = state.links.filter((item) => item.element_id === element.id).sort(bySort);

  app.innerHTML = `
    <article class="detail">
      <a class="back-link" href="${routePath(`/proyecto/${project.slug}/`)}">Volver a ${escapeHtml(project.name)}</a>
      <header class="detail-head">
        <div>
          <p class="tag">${escapeHtml(categoryName(element.category_id))}</p>
          <h1>${escapeHtml(element.title)}</h1>
          <p>${escapeHtml(element.short_description || '')}</p>
          <div class="actions">
            <button class="button primary" type="button" data-command="toggle-more">+ informacion</button>
            ${element.maps_url ? `<a class="button secondary" href="${escapeAttr(element.maps_url)}" target="_blank" rel="noreferrer">Como llegar</a>` : ''}
          </div>
        </div>
        <img src="${escapeAttr(element.main_image_url)}" alt="Imagen principal de ${escapeAttr(element.title)}">
      </header>
      <section class="more-info" data-more hidden><h2>Informacion ampliada</h2><p>${escapeHtml(element.long_description || 'Sin informacion ampliada.')}</p></section>
      <section class="section"><h2>Galeria</h2>${renderGallery(images, element.title)}</section>
      <section class="section"><h2>Audios</h2>${renderAudios(audios)}</section>
      <section class="section"><h2>Enlaces utiles</h2>${renderLinks(links)}</section>
    </article>
  `;
}

function renderGallery(images, title) {
  if (!images.length) return emptyState('No hay imagenes disponibles.');
  const visible = images.slice(0, Math.min(images.length, 3));
  return `<div class="gallery count-${visible.length}">${visible.map((image, index) => {
    const remaining = images.length - 3;
    const overlay = index === 2 && remaining > 0 ? `<span class="gallery-more">+${remaining}</span>` : '';
    return `<button type="button" class="gallery-item" data-command="open-lightbox" data-element-images="${escapeAttr(image.element_id)}" data-index="${index}" aria-label="Abrir imagen ${index + 1} de ${escapeAttr(title)}"><img src="${escapeAttr(image.thumbnail_url || image.image_url)}" alt="${escapeAttr(image.title || title)}">${overlay}</button>`;
  }).join('')}</div>`;
}

function renderAudios(audios) {
  if (!audios.length) return emptyState('No hay audios disponibles.');
  return `<div class="audio-list">${audios.map((audio) => `
    <article class="audio-card">
      <h3>${escapeHtml(audio.title || 'Audio guia')} - ${escapeHtml(audio.language || 'Idioma no indicado')}</h3>
      <audio controls preload="none" src="${escapeAttr(audio.audio_url)}"></audio>
    </article>
  `).join('')}</div>`;
}

function renderLinks(links) {
  if (!links.length) return emptyState('No hay enlaces disponibles.');
  return `<div class="link-grid">${links.map((link) => `
    <article class="link-card">
      <p class="tag">${escapeHtml(link.type || 'Otro')}</p>
      <h3>${escapeHtml(link.title)}</h3>
      <a class="button secondary" href="${escapeAttr(link.url)}" target="_blank" rel="noreferrer">Abrir enlace</a>
    </article>
  `).join('')}</div>`;
}

async function renderAdmin() {
  state.session = await getSession();
  if (!state.session) {
    app.innerHTML = `
      <section class="admin-shell narrow">
        <h1>Acceso administradores</h1>
        <p>Inicia sesion con un usuario creado en Supabase Auth para gestionar proyectos y elementos.</p>
        <form class="stack-form" data-action="login">
          <label>Email<input required type="email" name="email" autocomplete="email"></label>
          <label>Contrasena<input required type="password" name="password" autocomplete="current-password"></label>
          <button class="button primary" type="submit">Entrar</button>
        </form>
      </section>
    `;
    return;
  }

  app.innerHTML = `
    <section class="admin-shell">
      <div class="admin-head">
        <div><p class="eyebrow">Panel</p><h1>Administracion</h1><p>${escapeHtml(state.session.user.email)}</p></div>
        <button class="button secondary" type="button" data-command="logout">Cerrar sesion</button>
      </div>
      <div class="admin-grid">
        ${projectForm()}
        ${elementForm()}
        ${mediaForm()}
      </div>
      <section class="admin-lists">
        <h2>Contenido actual</h2>
        ${adminList()}
      </section>
    </section>
  `;
}

function projectForm(project = {}) {
  return `
    <form class="panel stack-form" data-action="save-project">
      <h2>Proyecto</h2>
      <input type="hidden" name="id" value="${escapeAttr(project.id || '')}">
      <label>Nombre<input required name="name" value="${escapeAttr(project.name || '')}"></label>
      <label>Slug<input required name="slug" value="${escapeAttr(project.slug || '')}" placeholder="centro-historico"></label>
      <label>Descripcion corta<textarea name="short_description">${escapeHtml(project.short_description || '')}</textarea></label>
      <label>Imagen de portada<input name="cover_image_url" type="url" value="${escapeAttr(project.cover_image_url || '')}"></label>
      <label>Orden<input name="sort_order" type="number" value="${escapeAttr(project.sort_order || 0)}"></label>
      <label class="check"><input name="active" type="checkbox" ${project.active ?? true ? 'checked' : ''}> Activo</label>
      <button class="button primary" type="submit">Guardar proyecto</button>
    </form>
  `;
}

function elementForm(element = {}) {
  const projectOptions = state.projects.map((project) => option(project.id, project.name, element.project_id)).join('');
  const categoryOptions = state.categories.map((category) => option(category.id, category.name, element.category_id)).join('');
  return `
    <form class="panel stack-form" data-action="save-element">
      <h2>Elemento</h2>
      <input type="hidden" name="id" value="${escapeAttr(element.id || '')}">
      <label>Proyecto<select required name="project_id">${projectOptions}</select></label>
      <label>Categoria<select name="category_id">${categoryOptions}</select></label>
      <label>Titulo<input required name="title" value="${escapeAttr(element.title || '')}"></label>
      <label>Slug<input required name="slug" value="${escapeAttr(element.slug || '')}"></label>
      <label>Descripcion corta<textarea name="short_description">${escapeHtml(element.short_description || '')}</textarea></label>
      <label>Descripcion larga<textarea name="long_description">${escapeHtml(element.long_description || '')}</textarea></label>
      <label>Imagen principal<input name="main_image_url" type="url" value="${escapeAttr(element.main_image_url || '')}"></label>
      <label>Google Maps<input name="maps_url" type="url" value="${escapeAttr(element.maps_url || '')}"></label>
      <label>Orden<input name="sort_order" type="number" value="${escapeAttr(element.sort_order || 0)}"></label>
      <label class="check"><input name="active" type="checkbox" ${element.active ?? true ? 'checked' : ''}> Activo</label>
      <label class="check"><input name="featured" type="checkbox" ${element.featured ? 'checked' : ''}> Destacado</label>
      <button class="button primary" type="submit">Guardar elemento</button>
    </form>
  `;
}

function mediaForm() {
  const elementOptions = state.elements.map((element) => option(element.id, element.title)).join('');
  return `
    <form class="panel stack-form" data-action="save-media">
      <h2>Imagen, audio o enlace</h2>
      <label>Elemento<select required name="element_id">${elementOptions}</select></label>
      <label>Tipo<select name="kind"><option value="image">Imagen</option><option value="audio">Audio</option><option value="link">Enlace</option></select></label>
      <label>Titulo<input required name="title"></label>
      <label>URL<input required name="url" type="url"></label>
      <label>Idioma o tipo<input name="meta" placeholder="Espanol, Web oficial, Cita previa..."></label>
      <label>Orden<input name="sort_order" type="number" value="0"></label>
      <p class="hint">Recomendado: imagenes WebP de hasta ${window.GUIA_CONFIG.maxImageMb} MB y audios MP3/M4A de hasta ${window.GUIA_CONFIG.maxAudioMb} MB. La compresion automatica queda preparada para una fase posterior.</p>
      <button class="button primary" type="submit">Anadir recurso</button>
    </form>
  `;
}

function option(value, label, selected) {
  return `<option value="${escapeAttr(value)}" ${selected === value ? 'selected' : ''}>${escapeHtml(label)}</option>`;
}

function adminList() {
  return `
    <div class="admin-list">
      ${state.projects.map((project) => `<article><strong>${escapeHtml(project.name)}</strong><span>${project.active ? 'Activo' : 'Inactivo'}</span><button class="button ghost" data-command="edit-project" data-id="${project.id}">Editar</button></article>`).join('')}
      ${state.elements.map((element) => `<article><strong>${escapeHtml(element.title)}</strong><span>${categoryName(element.category_id)}</span><button class="button ghost" data-command="edit-element" data-id="${element.id}">Editar</button></article>`).join('')}
    </div>
  `;
}

async function handleAction(form) {
  const action = form.dataset.action;
  const data = Object.fromEntries(new FormData(form).entries());
  try {
    if (action === 'login') {
      state.session = await signIn(data.email, data.password);
    }
    if (action === 'save-project') await upsert('guia_projects', projectPayload(data));
    if (action === 'save-element') await upsert('guia_elements', elementPayload(data));
    if (action === 'save-media') await saveMedia(data);
    await loadData();
    render();
  } catch (error) {
    showToast(error.message || 'No se pudo completar la accion.');
  }
}

async function handleCommand(button) {
  const command = button.dataset.command;
  if (command === 'toggle-more') document.querySelector('[data-more]')?.toggleAttribute('hidden');
  if (command === 'logout') {
    await signOut();
    state.session = null;
    render();
  }
  if (command === 'play-audio') {
    const audio = state.audios.find((item) => item.id === button.dataset.audio);
    if (audio) new Audio(audio.audio_url).play();
  }
  if (command === 'open-lightbox') {
    const images = state.images.filter((item) => item.element_id === button.dataset.elementImages).sort(bySort);
    openLightbox(images, Number(button.dataset.index || 0));
  }
  if (command === 'edit-project') {
    const project = state.projects.find((item) => item.id === button.dataset.id);
    document.querySelector('[data-action="save-project"]').outerHTML = projectForm(project);
  }
  if (command === 'edit-element') {
    const element = state.elements.find((item) => item.id === button.dataset.id);
    document.querySelector('[data-action="save-element"]').outerHTML = elementForm(element);
  }
}

async function upsert(table, payload) {
  if (!supabase) throw new Error('Configura Supabase para guardar cambios.');
  const clean = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== '' && value !== undefined));
  const { error } = await supabase.from(table).upsert(clean).select();
  if (error) throw error;
}

async function saveMedia(data) {
  const base = { element_id: data.element_id, title: data.title, sort_order: Number(data.sort_order || 0) };
  if (data.kind === 'image') return upsert('guia_element_images', { ...base, image_url: data.url, thumbnail_url: data.url });
  if (data.kind === 'audio') return upsert('guia_element_audios', { ...base, audio_url: data.url, language: data.meta || 'Sin idioma' });
  return upsert('guia_element_links', { ...base, url: data.url, type: data.meta || 'Otro' });
}

function projectPayload(data) {
  return { id: data.id || undefined, name: data.name, slug: data.slug, short_description: data.short_description, cover_image_url: data.cover_image_url, sort_order: Number(data.sort_order || 0), active: Boolean(data.active) };
}

function elementPayload(data) {
  return { id: data.id || undefined, project_id: data.project_id, category_id: data.category_id || null, title: data.title, slug: data.slug, short_description: data.short_description, long_description: data.long_description, main_image_url: data.main_image_url, maps_url: data.maps_url, sort_order: Number(data.sort_order || 0), active: Boolean(data.active), featured: Boolean(data.featured) };
}

function openLightbox(images, index) {
  state.lightboxImages = images;
  state.lightboxIndex = index;
  updateLightbox();
  lightbox.hidden = false;
}

function updateLightbox() {
  const image = state.lightboxImages[state.lightboxIndex];
  if (!image) return;
  lightbox.querySelector('[data-lightbox-image]').src = image.image_url;
  lightbox.querySelector('[data-lightbox-image]').alt = image.title || 'Imagen ampliada';
  lightbox.querySelector('[data-lightbox-caption]').textContent = image.title || '';
}

lightbox.querySelector('[data-lightbox-close]').addEventListener('click', () => lightbox.hidden = true);
lightbox.querySelector('[data-lightbox-prev]').addEventListener('click', () => {
  state.lightboxIndex = (state.lightboxIndex - 1 + state.lightboxImages.length) % state.lightboxImages.length;
  updateLightbox();
});
lightbox.querySelector('[data-lightbox-next]').addEventListener('click', () => {
  state.lightboxIndex = (state.lightboxIndex + 1) % state.lightboxImages.length;
  updateLightbox();
});

function showToast(message) {
  const toast = document.createElement('p');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.append(toast);
  setTimeout(() => toast.remove(), 4000);
}

function emptyState(text) {
  return `<p class="empty">${escapeHtml(text)}</p>`;
}

function renderNotFound() {
  app.innerHTML = `<section class="page-head"><h1>Pagina no encontrada</h1><p>La ruta solicitada no existe.</p><a class="button primary" href="${routePath('/')}">Volver al inicio</a></section>`;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

function escapeAttr(value = '') {
  return escapeHtml(value);
}
