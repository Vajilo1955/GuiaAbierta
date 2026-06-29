import { supabase, completeAuthFromUrl, getSession, initSupabase, signIn, signOut, updatePassword } from './supabase-client.js';
import { demoAudios, demoCategories, demoElements, demoImages, demoLinks, demoProjects } from './demo-data.js';

const app = document.querySelector('#app');
const menuButton = document.querySelector('[data-menu-toggle]');
const nav = document.querySelector('[data-main-nav]');
const lightbox = document.querySelector('[data-lightbox]');
const BASE_PATH = getBasePath();
const REVEAL_SELECTOR = [
  '.hero-content',
  '.phone-mockup',
  '.info-block',
  '.page-head',
  '.project-card',
  '.place-card',
  '.project-hero > *',
  '.filter-row',
  '.detail > .back-link',
  '.detail-head > *',
  '.section',
  '.gallery-item',
  '.audio-card',
  '.admin-head',
  '.admin-toolbar',
  '.admin-list-panel',
  '.admin-row',
  '.panel',
  '.empty'
].join(',');
let revealObserver;
let deferredInstallPrompt = null;
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

if (menuButton && nav) {
  menuButton.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    menuButton.setAttribute('aria-expanded', String(open));
  });
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  document.querySelectorAll('[data-pwa-install]').forEach((link) => link.hidden = false);
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  document.querySelectorAll('[data-pwa-install]').forEach((link) => link.hidden = true);
});
window.addEventListener('popstate', render);
document.addEventListener('click', (event) => {
  const installLink = event.target.closest('[data-pwa-install]');
  if (installLink) {
    event.preventDefault();
    installPwa();
    return;
  }
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
let elementFilterTimer;
document.addEventListener('input', (event) => {
  const input = event.target.closest('[data-element-filter]');
  if (!input) return;
  clearTimeout(elementFilterTimer);
  elementFilterTimer = setTimeout(() => applyElementFilter(input), 120);
});

document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-command]');
  if (!button) return;
  await handleCommand(button, event);
});

init();

async function init() {
  const redirected = new URLSearchParams(window.location.search).get('route');
  await initSupabase();
  const authRedirect = await completeAuthFromUrl().catch((error) => {
    showToast(error.message || 'No se pudo completar el acceso.');
    return { session: null, type: '' };
  });
  if (authRedirect.session) {
    const route = redirected ? redirectedRoutePath(redirected) : currentRoute();
    const isRecoveryRoute = normalizePath(route).startsWith('/admin/restaurar/');
    const target = authRedirect.type === 'recovery' || isRecoveryRoute ? routePath('/admin/restaurar/') : routePath('/admin/');
    history.replaceState({}, '', target);
  } else if (redirected) {
    history.replaceState({}, '', redirectedRoutePath(redirected));
  }
  state.session = await getSession();
  await loadData();
  render();
  registerServiceWorker();
}
async function installPwa() {
  if (!deferredInstallPrompt) {
    showToast('Usa la opcion de instalar de tu navegador si ya esta disponible.');
    return;
  }
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice.catch(() => null);
  deferredInstallPrompt = null;
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register(routePath('/sw.js')).catch((error) => {
    console.warn('No se pudo registrar el service worker.', error);
  });
}
function navigate(path) {
  history.pushState({}, '', path);
  nav?.classList.remove('is-open');
  menuButton?.setAttribute('aria-expanded', 'false');
  render();
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  app.focus({ preventScroll: true });
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

function redirectedRoutePath(route) {
  if (!route) return routePath('/');
  const url = new URL(route, window.location.origin);
  if (url.origin === window.location.origin && url.pathname.startsWith(BASE_PATH)) {
    return url.pathname + url.search;
  }
  return routePath(url.pathname) + url.search;
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
  let result;

  if (path === '/' || path === '') result = renderLanding();
  else if (path === '/proyectos/') result = renderProjects();
  else if (parts[0] === 'proyecto' && parts.length === 2) result = renderProject(parts[1]);
  else if (parts[0] === 'proyecto' && parts.length === 3) result = renderElement(parts[1], parts[2]);
  else if (parts[0] === 'admin') result = renderAdmin(parts);
  else result = renderNotFound();

  Promise.resolve(result).then(queueScrollReveal);
  return result;
}

function queueScrollReveal() {
  requestAnimationFrame(initScrollReveal);
}

function initScrollReveal() {
  const items = [...app.querySelectorAll(REVEAL_SELECTOR)]
    .filter((item) => !item.closest('[data-no-reveal]') && !item.classList.contains('reveal-on-scroll') && !item.hidden && item.offsetParent !== null);

  if (!items.length) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    items.forEach((item) => item.classList.add('reveal-on-scroll', 'is-visible'));
    return;
  }

  if (!revealObserver) {
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  }

  items.forEach((item, index) => {
    item.classList.add('reveal-on-scroll');
    item.style.setProperty('--reveal-delay', `${Math.min(index, 6) * 22}ms`);
    revealObserver.observe(item);
  });
}
function restoreFilterFocus(input, selectionStart, selectionEnd) {
  requestAnimationFrame(() => {
    if (!input.isConnected) return;
    input.focus({ preventScroll: true });
    if (typeof selectionStart === 'number' && typeof selectionEnd === 'number') {
      input.setSelectionRange(selectionStart, selectionEnd);
    }
  });
}

function elementFilterText(element) {
  return [element.title, element.slug, element.short_description, categoryName(element.category_id)]
    .map((value) => String(value || '').toLowerCase())
    .join(' ');
}
function matchesElementFilter(element, query) {
  if (!query) return true;
  return [element.title, element.slug, element.short_description, categoryName(element.category_id)]
    .some((value) => String(value || '').toLowerCase().includes(query));
}

function filterRenderedElements(input) {
  const target = document.querySelector(input.dataset.filterTarget);
  if (!target) return { visible: 0, total: 0 };
  const query = input.value.trim().toLowerCase();
  const currentPage = Number(input.dataset.currentPage || 1);
  const items = [...target.querySelectorAll('[data-filter-text]')];
  let visible = 0;

  items.forEach((item) => {
    const textMatch = !query || item.dataset.filterText.includes(query);
    const pageMatch = input.dataset.filterMode !== 'admin-project' || query || Number(item.dataset.page || 1) === currentPage;
    const show = textMatch && pageMatch;
    item.hidden = !show;
    if (textMatch) visible += 1;
  });

  const empty = target.querySelector('[data-filter-empty]');
  if (empty) empty.hidden = items.some((item) => !item.hidden);
  return { visible, total: items.length };
}

function applyElementFilter(input) {
  const selectionStart = input.selectionStart;
  const selectionEnd = input.selectionEnd;
  const query = input.value.trim().toLowerCase();
  const result = filterRenderedElements(input);

  if (input.dataset.filterMode === 'admin-project') {
    const summary = document.querySelector(input.dataset.summaryTarget || '');
    const pagination = document.querySelector(input.dataset.paginationTarget || '');
    const pageSize = 10;
    const currentPage = Number(input.dataset.currentPage || 1);
    if (summary) {
      const first = query ? 1 : ((currentPage - 1) * pageSize) + 1;
      const last = query ? result.visible : Math.min(currentPage * pageSize, result.visible);
      summary.textContent = result.visible ? `${first}-${last} de ${result.visible}` : (query ? 'Sin coincidencias' : 'Sin elementos');
    }
    if (pagination) pagination.hidden = Boolean(query);
  }

  restoreFilterFocus(input, selectionStart, selectionEnd);
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

function inactiveBadge(item) {
  return item && (item.active === false || item.active === 'false') && state.session ? ' <span class="inactive-badge">INACTIVO</span>' : '';
}

function renderLanding() {
  app.innerHTML = `
    <section class="hero">
      <div class="hero-content">
        <p class="eyebrow">Guia audiovisual accesible</p>
        <h1>GuiaAbierta</h1>
        <p>Descubre los lugares importantes de tu localidad con imagenes, audios, mapas y enlaces utiles. Una guia pensada para ayudarte a orientarte, conocer tu entorno y acceder mejor a los servicios cercanos.</p>
        <div class="actions">
          <a class="button primary" href="${routePath('/proyectos/')}">Ver guias disponibles</a>

        </div>
      </div>
      <div class="phone-mockup" aria-label="Vista previa movil de GuiaAbierta">
        <img src="${routePath('/assets/images/landing-mockup.png')}" alt="Vista previa de GuiaAbierta en un movil iPhone">
      </div>
    </section>
    <section class="info-grid section">
      ${infoBlock('Para quien', 'Personas recién llegadas, visitantes y cualquier persona que necesite información local sencilla.')}
      ${infoBlock('Como funciona', 'Elige una guía, abre un lugar y consulta imágenes, textos claros, audios, mapas y enlaces útiles.')}
      ${infoBlock('Que puedes encontrar', 'Monumentos, instituciones, salud, transporte, cultura, educación, ayuda social y otros servicios.')}
      <!-- ${infoBlock('Ventajas', 'Contenido visual, audios en varios idiomas, botones grandes, buen contraste y navegación pensada para móvil.')} -->
    </section>
  `;
}

function infoBlock(title, text) {
  return `<article class="info-block"><h2>${title}</h2><p>${text}</p></article>`;
}

function renderProjects() {
  const cards = activeProjects().sort(bySort).map((project) => `
    <article class="project-card">
      <a class="card-media-link" href="${routePath(`/proyecto/${project.slug}/`)}" aria-label="Ver guia ${escapeAttr(project.name)}"><img src="${escapeAttr(project.cover_image_url)}" alt="Imagen de ${escapeAttr(project.name)}" loading="lazy"></a>
      <div>
        <h2><a href="${routePath(`/proyecto/${project.slug}/`)}">${escapeHtml(project.name)}</a>${inactiveBadge(project)}</h2>
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
  const project = state.projects.find((item) => item.slug === slug && (item.active || state.session));
  if (!project) return renderNotFound();
  const searchParams = new URLSearchParams(location.search);
  const selectedCategory = searchParams.get('categoria') || 'todas';
  const elementFilter = (searchParams.get('buscar') || '').trim().toLowerCase();
  const categoryElements = activeElements(project.id).filter((element) => selectedCategory === 'todas' || element.category_id === selectedCategory);
  const elements = elementFilter
    ? categoryElements.filter((element) => [element.title, element.slug, element.short_description, categoryName(element.category_id)].some((value) => String(value || '').toLowerCase().includes(elementFilter)))
    : categoryElements;
  const filters = ['todas', ...state.categories.filter((c) => c.active).map((c) => c.id)].map((id) => {
    const label = id === 'todas' ? 'Todas' : categoryName(id);
    const active = selectedCategory === id ? ' aria-current="true"' : '';
    const query = elementFilter ? `&buscar=${encodeURIComponent(elementFilter)}` : '';
    return `<a class="chip" href="${routePath(`/proyecto/${project.slug}/`)}?categoria=${id}${query}"${active}>${escapeHtml(label)}</a>`;
  }).join('');

  app.innerHTML = `
    <section class="project-hero">
      <img src="${escapeAttr(project.cover_image_url)}" alt="Imagen de ${escapeAttr(project.name)}">
      <div>
        <a class="back-link" href="${routePath('/proyectos/')}">Volver a guias</a>
        <h1>${escapeHtml(project.name)}${inactiveBadge(project)}</h1>
        <p>${escapeHtml(project.short_description || '')}</p>
      </div>
    </section>
    <section class="filter-row" aria-label="Filtrar por categoria">${filters}</section>
    <section class="public-search-row">
      <div class="admin-search-control public-search-control">
        <input name="element_query" type="search" placeholder="Buscar elemento" value="${escapeAttr(searchParams.get('buscar') || '')}" data-element-filter data-filter-mode="public-project" data-project-id="${escapeAttr(project.id)}" data-category-id="${escapeAttr(selectedCategory)}" data-filter-target="#project-elements-cards" aria-label="Buscar elemento">
      </div>
    </section>
    <section id="project-elements-cards" class="cards-grid">${elements.map((element) => elementCard(element, { hidden: elementFilter && !matchesElementFilter(element, elementFilter) })).join('')}<div class="empty" data-filter-empty ${elements.some((element) => matchesElementFilter(element, elementFilter)) ? 'hidden' : ''}>${elementFilter ? 'No hay elementos que coincidan con la busqueda.' : 'No hay elementos para este filtro.'}</div></section>
  `;
}
function elementCard(element, options = {}) {
  return `
    <article class="place-card" data-filter-text="${escapeAttr(elementFilterText(element))}" ${options.hidden ? 'hidden' : ''}>
      <a class="card-media-link" href="${elementUrl(element)}" aria-label="Ver informacion de ${escapeAttr(element.title)}"><img src="${escapeAttr(element.main_image_url)}" alt="Imagen de ${escapeAttr(element.title)}" loading="lazy"></a>
      <div class="place-card-body">
        <div class="place-card-meta">
          <p class="tag">${escapeHtml(categoryName(element.category_id))}</p>
          ${element.maps_url ? `<a class="map-icon-link" href="${escapeAttr(element.maps_url)}" target="_blank" rel="noreferrer" aria-label="Como llegar a ${escapeAttr(element.title)}" title="Como llegar">${icon('location')}</a>` : ''}
        </div>
        <h2><a href="${elementUrl(element)}">${escapeHtml(element.title)}</a>${inactiveBadge(element)}</h2>
        <p>${escapeHtml(element.short_description || '')}</p>
      </div>
    </article>
  `;
}

function elementUrl(element) {
  const project = state.projects.find((item) => item.id === element.project_id);
  return routePath(`/proyecto/${project?.slug || ''}/${element.slug}/`);
}

function renderElement(projectSlug, elementSlug) {
  const project = state.projects.find((item) => item.slug === projectSlug && (item.active || state.session));
  const element = state.elements.find((item) => item.slug === elementSlug && item.project_id === project?.id && (item.active || state.session));
  if (!project || !element) return renderNotFound();
  const images = state.images.filter((item) => item.element_id === element.id).sort(bySort);
  const audios = state.audios.filter((item) => item.element_id === element.id).sort(bySort);
  const links = state.links.filter((item) => item.element_id === element.id).sort(bySort);
  const hasMoreInfo = Boolean((element.long_description || '').trim());

  app.innerHTML = `
    <article class="detail">
      <header class="detail-head">
        <div>
          <div class="detail-topline"><p class="tag">${escapeHtml(categoryName(element.category_id))}</p><a class="back-link detail-back-link" href="${routePath(`/proyecto/${project.slug}/`)}">Volver a ${escapeHtml(project.name)}</a></div>
          <h1>${escapeHtml(element.title)}${inactiveBadge(element)}</h1>
          <p>${escapeHtml(element.short_description || '')}</p>
          <div class="actions">
            ${hasMoreInfo ? `<button class="button primary" type="button" data-command="show-more" data-element="${escapeAttr(element.id)}">+ info</button>` : ''}
            ${element.maps_url ? `<a class="map-icon-link detail-map-link" href="${escapeAttr(element.maps_url)}" target="_blank" rel="noreferrer" aria-label="Como llegar a ${escapeAttr(element.title)}" title="Como llegar">${icon('location')}</a>` : ''}
          </div>
        </div>
        <img src="${escapeAttr(element.main_image_url)}" alt="Imagen principal de ${escapeAttr(element.title)}">
      </header>
      <section class="section"><h2>Galeria</h2>${renderGallery(images, element.title)}</section>
      <section class="section"><h2>Audios</h2>${renderAudios(audios)}</section>
      <section class="section"><h2>Enlaces utiles</h2>${renderLinks(links)}</section>
    </article>
  `;
}

function renderGallery(images, title) {
  if (!images.length) return emptyState('No hay imagenes disponibles.');
  return `<div class="gallery count-${images.length}">${images.slice(0, 3).map((image, index) => `<button type="button" class="gallery-item" data-command="open-lightbox" data-element-images="${escapeAttr(image.element_id)}" data-index="${index}" aria-label="Abrir imagen ${index + 1} de ${escapeAttr(title)}"><img src="${escapeAttr(image.image_url)}" alt="${escapeAttr(image.title || title)}">${index === 2 && images.length > 3 ? `<span class="gallery-more">+${images.length - 3}</span>` : ''}</button>`).join('')}</div>`;
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
  return `<ul class="link-list">${links.map((link) => {
    const title = link.title || 'Enlace';
    const label = link.type ? `${link.type}: ${title}` : title;
    return `<li><a href="${escapeAttr(link.url)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a></li>`;
  }).join('')}</ul>`;
}

async function renderAdmin(parts = []) {
  state.session = await getSession();
  if (parts[1] === 'restaurar') return renderAdminPasswordReset();
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

  if (parts.length === 1) return renderAdminProjects();
  if (parts[1] === 'proyectos' && parts.length === 2) return renderAdminProjects();
  if (parts[1] === 'proyectos' && parts[2] === 'nuevo') return renderAdminProjectEditor();
  if (parts[1] === 'proyectos' && parts[2] && parts.length === 3) return renderAdminProjectEditor(parts[2]);
  if (parts[1] === 'proyectos' && parts[2] && parts[3] === 'elementos' && parts[4] === 'nuevo') return renderAdminElementEditor(null, parts[2]);
  if (parts[1] === 'elementos' && parts[2] && parts.length === 3) return renderAdminElementEditor(parts[2]);
  if (parts[1] === 'elementos' && parts[2] && parts[3] === 'media' && parts[4] === 'nuevo') {
    const kind = new URLSearchParams(location.search).get('tipo') || 'image';
    return renderAdminMediaEditor(parts[2], kind);
  }
  if (parts[1] === 'elementos' && parts[2] && parts[3] === 'media' && parts[4] && parts[5]) return renderAdminMediaEditor(parts[2], parts[4], parts[5]);
  renderNotFound();
}

function adminFrame(title, subtitle, body, actions = '') {
  app.innerHTML = `
    <section class="admin-shell">
      <div class="admin-top-actions">
        <button class="icon-action admin-logout-action" type="button" data-command="logout" aria-label="Cerrar sesion" title="Cerrar sesion">${icon('logout')}</button>
      </div>
      <div class="admin-head">
        <div>
          <p class="eyebrow">Administracion</p>
          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(subtitle || state.session.user.email)}</p>
        </div>
        <div class="admin-head-actions">
          ${actions}
        </div>
      </div>
      ${body}
    </section>
  `;
}
function renderAdminPasswordReset() {
  adminFrame(
    'Restaurar contrasena',
    'Introduce una nueva contrasena para tu usuario administrador.',
    `
      <form class="panel stack-form" data-action="update-password">
        <label>Nueva contrasena<input required type="password" name="password" autocomplete="new-password" minlength="8"></label>
        <label>Repetir contrasena<input required type="password" name="password_confirm" autocomplete="new-password" minlength="8"></label>
        <button class="button primary" type="submit">Guardar contrasena</button>
      </form>
    `
  );
}
function renderAdminProjects() {
  const rows = state.projects.sort(bySort).map((project) => adminGoRow({
    title: project.name,
    meta: project.active ? 'Activo' : 'Inactivo',
    href: routePath(`/admin/proyectos/${project.id}/`)
  })).join('');

  adminFrame(
    'Proyectos',
    'Gestiona las guias disponibles.',
    `
      <div class="admin-toolbar">
        <a class="button primary" href="${routePath('/admin/proyectos/nuevo/')}">Nuevo proyecto</a>
      </div>
      <section class="admin-list-panel">
        ${rows || emptyState('Todavia no hay proyectos creados.')}
      </section>
    `
  );
}

function renderAdminProjectEditor(projectId) {
  const project = projectId ? state.projects.find((item) => item.id === projectId) : {};
  if (projectId && !project) return renderNotFound();

  const allElements = projectId ? state.elements.filter((element) => element.project_id === projectId).sort(bySort) : [];
  const searchParams = new URLSearchParams(location.search);
  const elementFilter = (searchParams.get('buscar') || '').trim().toLowerCase();
  const filteredElements = elementFilter
    ? allElements.filter((element) => [element.title, element.slug, categoryName(element.category_id)].some((value) => String(value || '').toLowerCase().includes(elementFilter)))
    : allElements;
  const pageSize = 10;
  const requestedPage = Number(searchParams.get('pagina') || 1);
  const safeRequestedPage = Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1;
  const totalPages = Math.max(1, Math.ceil(filteredElements.length / pageSize));
  const currentPage = Math.min(Math.max(1, safeRequestedPage), totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const elements = filteredElements.slice(pageStart, pageStart + pageSize);
  const filteredPositions = new Map(filteredElements.map((element, index) => [element.id, index]));
  const rows = allElements.map((element) => {
    const filteredIndex = filteredPositions.has(element.id) ? filteredPositions.get(element.id) : -1;
    return adminGoRow({
      title: element.title,
      meta: `${categoryName(element.category_id)} - ${element.active ? 'Activo' : 'Inactivo'}`,
      href: routePath(`/admin/elementos/${element.id}/`),
      compact: true,
      filterText: elementFilterText(element),
      page: filteredIndex >= 0 ? Math.floor(filteredIndex / pageSize) + 1 : 0,
      hidden: filteredIndex < pageStart || filteredIndex >= pageStart + pageSize
    });
  }).join('');
  const pagination = projectId && filteredElements.length > pageSize ? adminPagination({
    currentPage,
    totalPages,
    totalItems: filteredElements.length,
    baseHref: `${routePath(`/admin/proyectos/${projectId}/`)}${elementFilter ? `?buscar=${encodeURIComponent(elementFilter)}` : ''}`
  }) : '';

  adminFrame(
    projectId ? `Proyecto: ${project.name}` : 'Nuevo proyecto',
    projectId ? 'Datos del proyecto y sus elementos.' : 'Crea una nueva guia o localidad.',
    `
      <a class="back-link" href="${routePath('/admin/')}">Volver a proyectos</a>
      ${projectId ? projectReadOnly(project) : projectForm(project)}
      ${projectId ? `
        <section class="admin-list-panel is-compact" data-no-reveal>
          <div class="list-title-row">
            <div>
              <h2>Elementos del proyecto</h2>
              <p class="list-summary" data-elements-summary>${filteredElements.length ? `${pageStart + 1}-${pageStart + elements.length} de ${filteredElements.length}` : (elementFilter ? 'Sin coincidencias' : 'Sin elementos')}</p>
            </div>
            <div class="admin-inline-tools">
              <div class="admin-search-control">
                <input name="element_query" type="search" placeholder="Buscar elemento" value="${escapeAttr(searchParams.get('buscar') || '')}" data-element-filter data-filter-mode="admin-project" data-project-id="${escapeAttr(projectId)}" data-current-page="${escapeAttr(currentPage)}" data-filter-target="#admin-project-elements" data-summary-target="[data-elements-summary]" data-pagination-target="[data-elements-pagination]" aria-label="Buscar elemento">
              </div>
              <a class="button primary" href="${routePath(`/admin/proyectos/${projectId}/elementos/nuevo/`)}">Nuevo elemento</a>
            </div>
          </div>
          <div id="admin-project-elements">${rows}<div class="empty" data-filter-empty ${filteredElements.length ? 'hidden' : ''}>${elementFilter ? 'No hay elementos que coincidan con la busqueda.' : 'Este proyecto todavia no tiene elementos.'}</div></div>
          <div data-elements-pagination>${pagination}</div>
        </section>
      ` : ''}
    `
  );
}

function renderAdminElementEditor(elementId, projectId) {
  const element = elementId ? state.elements.find((item) => item.id === elementId) : { project_id: projectId };
  if (elementId && !element) return renderNotFound();
  const project = state.projects.find((item) => item.id === element.project_id);
  if (!project) return renderNotFound();

  adminFrame(
    elementId ? `Elemento: ${element.title}` : 'Nuevo elemento',
    `Proyecto: ${project.name}`,
    `
      <a class="back-link" href="${routePath(`/admin/proyectos/${project.id}/`)}">Volver al proyecto</a>
      ${elementId ? elementReadOnly(element, project) : elementForm(element)}
      ${elementId ? renderAdminMediaSections(elementId) : ''}
    `
  );
}
function renderAdminMediaEditor(elementId, kind = 'image', mediaId = '') {
  const element = state.elements.find((item) => item.id === elementId);
  if (!element) return renderNotFound();
  const item = mediaId ? mediaForElement(elementId).find((media) => media.kind === kind && media.id === mediaId) : { kind, element_id: elementId };
  if (mediaId && !item) return renderNotFound();

  adminFrame(
    mediaId ? `Editar ${mediaKindLabel(kind).toLowerCase()}` : newMediaLabel(kind),
    `Elemento: ${element.title}`,
    `
      <a class="back-link" href="${routePath(`/admin/elementos/${elementId}/`)}">Volver al elemento</a>
      ${mediaForm(elementId, item)}
    `
  );
}

function projectReadOnly(project) {
  return `
    <section class="panel readonly-panel project-readonly-panel">
      <div class="project-readonly-layout">
        ${project.cover_image_url ? `<img class="readonly-image" src="${escapeAttr(project.cover_image_url)}" alt="Imagen de ${escapeAttr(project.name)}">` : ''}
        <div class="readonly-info">
          <dl class="readonly-grid">
            <div><dt>Nombre</dt><dd>${escapeHtml(project.name)}</dd></div>
            <div><dt>Slug</dt><dd>${escapeHtml(project.slug)}</dd></div>
            <div><dt>Descripcion</dt><dd>${escapeHtml(project.short_description || 'Sin descripcion.')}</dd></div>
            <div><dt>Orden</dt><dd>${escapeHtml(project.sort_order ?? 0)}</dd></div>
            <div><dt>Estado</dt><dd>${project.active ? 'Activo' : 'Inactivo'}</dd></div>
          </dl>
          <div class="actions">
            <a class="button secondary" href="${routePath(`/proyecto/${project.slug}/`)}">Ver pagina publica</a>
            <button class="button primary" type="button" data-command="open-edit-modal" data-kind="project" data-id="${escapeAttr(project.id)}">Modificar</button>
            <button class="button danger" type="button" data-command="confirm-delete" data-table="guia_projects" data-id="${escapeAttr(project.id)}" data-label="${escapeAttr(project.name)}" data-redirect="${routePath('/admin/')}">Borrar</button>
          </div>
        </div>
      </div>
    </section>
  `;
}
function elementReadOnly(element, project) {
  return `
    <section class="panel readonly-panel element-readonly-panel">
      <div class="element-readonly-layout">
        ${element.main_image_url ? `<img class="readonly-image" src="${escapeAttr(element.main_image_url)}" alt="Imagen de ${escapeAttr(element.title)}">` : ''}
        <div class="readonly-info">
          <dl class="readonly-grid">
            <div><dt>Titulo</dt><dd>${escapeHtml(element.title)}</dd></div>
            <div><dt>Slug</dt><dd>${escapeHtml(element.slug)}</dd></div>
            <div><dt>Proyecto</dt><dd>${escapeHtml(project.name)}</dd></div>
            <div><dt>Categoria</dt><dd>${escapeHtml(categoryName(element.category_id))}</dd></div>
            <div><dt>Descripcion corta</dt><dd>${escapeHtml(element.short_description || 'Sin descripcion.')}</dd></div>
            <div><dt>Descripcion larga</dt><dd>${escapeHtml(element.long_description || 'Sin descripcion ampliada.')}</dd></div>
            <div><dt>Google Maps</dt><dd>${element.maps_url ? `<a href="${escapeAttr(element.maps_url)}" target="_blank" rel="noreferrer">Abrir mapa</a>` : 'Sin enlace'}</dd></div>
            <div><dt>Orden</dt><dd>${escapeHtml(element.sort_order ?? 0)}</dd></div>
            <div><dt>Estado</dt><dd>${element.active ? 'Activo' : 'Inactivo'}</dd></div>
            <div><dt>Destacado</dt><dd>${element.featured ? 'Si' : 'No'}</dd></div>
          </dl>
          <div class="actions">
            <a class="button secondary" href="${elementUrl(element)}">Ver pagina publica</a>
            <button class="button primary" type="button" data-command="open-edit-modal" data-kind="element" data-id="${escapeAttr(element.id)}">Modificar</button>
            <button class="button danger" type="button" data-command="confirm-delete" data-table="guia_elements" data-id="${escapeAttr(element.id)}" data-label="${escapeAttr(element.title)}" data-redirect="${routePath(`/admin/proyectos/${project.id}/`)}">Borrar</button>
          </div>
        </div>
      </div>
    </section>
  `;
}
function projectForm(project = {}) {
  return `
    <form class="panel stack-form" data-action="save-project" enctype="multipart/form-data">
      <input type="hidden" name="id" value="${escapeAttr(project.id || '')}">
      <input type="hidden" name="cover_image_url" value="${escapeAttr(project.cover_image_url || '')}">
      <input type="hidden" name="cover_thumbnail_url" value="${escapeAttr(project.cover_thumbnail_url || '')}">
      <label>Nombre<input required name="name" value="${escapeAttr(project.name || '')}"></label>
      <label>Slug<input required name="slug" value="${escapeAttr(project.slug || '')}" placeholder="centro-historico"></label>
      <label>Descripcion corta<textarea name="short_description">${escapeHtml(project.short_description || '')}</textarea></label>
      <label>Imagen de portada<input name="cover_image_file" type="file" accept="image/png,image/jpeg,image/webp"></label>
      <p class="hint">Subida maxima por archivo: ${window.GUIA_CONFIG.maxImageMb} MB. La imagen se optimiza hasta un maximo aproximado de ${window.GUIA_CONFIG.maxOptimizedImageKb} KB y se guarda una miniatura.</p>
      ${project.cover_image_url ? `<p class="hint">Imagen actual cargada desde Supabase. Sube otra imagen para sustituirla.</p>` : ''}
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
    <form class="panel stack-form" data-action="save-element" enctype="multipart/form-data">
      <input type="hidden" name="id" value="${escapeAttr(element.id || '')}">
      <input type="hidden" name="main_image_url" value="${escapeAttr(element.main_image_url || '')}">
      <input type="hidden" name="main_thumbnail_url" value="${escapeAttr(element.main_thumbnail_url || '')}">
      <label>Proyecto<select required name="project_id">${projectOptions}</select></label>
      <label>Categoria<select name="category_id">${categoryOptions}</select></label>
      <label>Titulo<input required name="title" value="${escapeAttr(element.title || '')}"></label>
      <label>Slug<input required name="slug" value="${escapeAttr(element.slug || '')}"></label>
      <label>Descripcion corta<textarea name="short_description">${escapeHtml(element.short_description || '')}</textarea></label>
      <label>Descripcion larga<textarea name="long_description">${escapeHtml(element.long_description || '')}</textarea></label>
      <label>Imagen principal<input name="main_image_file" type="file" accept="image/png,image/jpeg,image/webp"></label>
      <p class="hint">Subida maxima por archivo: ${window.GUIA_CONFIG.maxImageMb} MB. La imagen se optimiza hasta un maximo aproximado de ${window.GUIA_CONFIG.maxOptimizedImageKb} KB y se guarda una miniatura.</p>
      ${element.main_image_url ? `<p class="hint">Imagen actual cargada desde Supabase. Sube otra imagen para sustituirla.</p>` : ''}
      <label>Google Maps<input name="maps_url" type="url" value="${escapeAttr(element.maps_url || '')}"></label>
      <label>Orden<input name="sort_order" type="number" value="${escapeAttr(element.sort_order || 0)}"></label>
      <label class="check"><input name="active" type="checkbox" ${element.active ?? true ? 'checked' : ''}> Activo</label>
      <label class="check"><input name="featured" type="checkbox" ${element.featured ? 'checked' : ''}> Destacado</label>
      <button class="button primary" type="submit">Guardar elemento</button>
    </form>
  `;
}

function newMediaLabel(kind) {
  if (kind === 'audio') return 'Nuevo audio';
  if (kind === 'link') return 'Nuevo enlace';
  return 'Nueva imagen';
}
function mediaForm(elementId, item = {}) {
  const kind = item.kind || 'image';
  const fields = {
    image: `
      <label>Imagen<input name="media_image_file" type="file" accept="image/png,image/jpeg,image/webp" ${item.id ? '' : 'required'}></label>
      ${item.url ? '<p class="hint">Imagen actual cargada. Sube otra imagen para sustituirla.</p>' : ''}
    `,
    audio: `
      <label>Audio<input name="media_audio_file" type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,.mp3,.m4a" ${item.id ? '' : 'required'}></label>
      <label>Idioma<input name="meta" value="${escapeAttr(item.meta || '')}" placeholder="Espanol"></label>
      ${item.url ? '<p class="hint">Audio actual cargado. Sube otro archivo para sustituirlo.</p>' : ''}
    `,
    link: `
      <label>URL<input required name="external_url" type="url" value="${escapeAttr(item.url || '')}"></label>
      <label>Tipo<input name="meta" value="${escapeAttr(item.meta || '')}" placeholder="Web oficial, Cita previa..."></label>
    `
  };
  return `
    <form class="panel stack-form" data-action="save-media" enctype="multipart/form-data">
      <input type="hidden" name="id" value="${escapeAttr(item.id || '')}">
      <input type="hidden" name="element_id" value="${escapeAttr(elementId)}">
      <input type="hidden" name="url" value="${escapeAttr(item.url || '')}">
      <input type="hidden" name="thumbnail_url" value="${escapeAttr(item.thumbnail_url || '')}">
      <input type="hidden" name="kind" value="${escapeAttr(kind)}">
      <label>Titulo<input name="title" value="${escapeAttr(item.title || '')}"></label>
      ${fields[kind] || fields.image}
      <label>Orden<input name="sort_order" type="number" value="${escapeAttr(item.sort_order || 0)}"></label>
      <p class="hint">${kind === 'image' ? `Subida maxima por archivo: ${window.GUIA_CONFIG.maxImageMb} MB. Las imagenes se optimizan hasta un maximo aproximado de ${window.GUIA_CONFIG.maxOptimizedImageKb} KB.` : 'Los archivos se guardan en Supabase.'}</p>
      <button class="button primary" type="submit">Guardar ${mediaKindLabel(kind).toLowerCase()}</button>
    </form>
  `;
}

function renderAdminMediaSections(elementId) {
  const groups = [
    { kind: 'image', title: 'Imagenes', empty: 'Este elemento todavia no tiene imagenes.' },
    { kind: 'audio', title: 'Audios', empty: 'Este elemento todavia no tiene audios.' },
    { kind: 'link', title: 'Enlaces', empty: 'Este elemento todavia no tiene enlaces.' }
  ];
  const media = mediaForElement(elementId);
  return `
    <section class="admin-media-panel">
      <h2>Contenido multimedia</h2>
      ${groups.map((group) => {
        const items = media.filter((item) => item.kind === group.kind);
        return `
          <section class="admin-media-section">
            <div class="admin-media-section-head">
              <h3>${group.title}</h3>
              <a class="button primary" href="${routePath(`/admin/elementos/${elementId}/media/nuevo/?tipo=${group.kind}`)}">${newMediaLabel(group.kind)}</a>
            </div>
            ${items.length ? renderAdminMediaGroup(group.kind, items) : emptyState(group.empty)}
          </section>
        `;
      }).join('')}
    </section>
  `;
}

function renderAdminMediaGroup(kind, items) {
  if (kind === 'audio') return `<div class="audio-list admin-audio-list">${items.map(adminAudioCard).join('')}</div>`;
  if (kind === 'link') return `<ul class="link-list admin-link-list">${items.map(adminLinkItem).join('')}</ul>`;
  return `<div class="admin-media-grid">${items.map(adminMediaTile).join('')}</div>`;
}

function adminMediaActions(item, title) {
  return `
    <span class="admin-inline-actions">
      <a class="icon-action" href="${routePath(`/admin/elementos/${item.element_id}/media/${item.kind}/${item.id}/`)}" aria-label="Editar ${escapeAttr(title)}" title="Editar">${icon('edit')}</a>
      <button class="icon-action danger" type="button" data-command="confirm-delete" data-table="${escapeAttr(mediaTable(item.kind))}" data-id="${escapeAttr(item.id)}" data-label="${escapeAttr(title)}" data-redirect="${routePath(`/admin/elementos/${item.element_id}/`)}" aria-label="Borrar ${escapeAttr(title)}" title="Borrar">${icon('trash')}</button>
    </span>
  `;
}

function adminAudioCard(item) {
  const title = item.title || 'Audio guia';
  const language = item.meta || 'Idioma no indicado';
  return `
    <article class="audio-card admin-audio-card">
      <div class="admin-media-card-head">
        <h3>${escapeHtml(title)} - ${escapeHtml(language)}</h3>
        ${adminMediaActions(item, title)}
      </div>
      <audio controls preload="none" src="${escapeAttr(item.url)}"></audio>
    </article>
  `;
}

function adminLinkItem(item) {
  const title = item.title || 'Enlace';
  const label = item.meta ? `${item.meta}: ${title}` : title;
  return `
    <li class="admin-link-item">
      <a href="${escapeAttr(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>
      ${adminMediaActions(item, title)}
    </li>
  `;
}
function adminMediaTile(item) {
  const title = item.title || mediaKindLabel(item.kind);
  const preview = item.kind === 'image'
    ? `<img class="media-preview-image" style="position:absolute;inset:0;width:100%;height:100%;max-width:none;max-height:none;object-fit:contain;object-position:center;" src="${escapeAttr(item.thumbnail_url || item.url)}" alt="${escapeAttr(title)}">`
    : `<span class="media-type-icon">${icon(item.kind)}</span>`;
  return `
    <article class="media-tile">
      <div class="media-preview" style="position:relative;display:block;width:100%;height:122px;overflow:hidden;background:#eef3ef;border-radius:7px;">${preview}</div>
      <div class="media-tile-text">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(item.meta || mediaKindLabel(item.kind))}</span>
      </div>
      <div class="media-tile-actions">
        <a class="icon-action" href="${routePath(`/admin/elementos/${item.element_id}/media/${item.kind}/${item.id}/`)}" aria-label="Editar ${escapeAttr(title)}" title="Editar">${icon('edit')}</a>
        <button class="icon-action danger" type="button" data-command="confirm-delete" data-table="${escapeAttr(mediaTable(item.kind))}" data-id="${escapeAttr(item.id)}" data-label="${escapeAttr(title)}" data-redirect="${routePath(`/admin/elementos/${item.element_id}/`)}" aria-label="Borrar ${escapeAttr(title)}" title="Borrar">${icon('trash')}</button>
      </div>
    </article>
  `;
}
function option(value, label, selected) {
  return `<option value="${escapeAttr(value)}" ${selected === value ? 'selected' : ''}>${escapeHtml(label)}</option>`;
}
function adminPagination({ currentPage, totalPages, totalItems, baseHref }) {
  const pageHref = (page) => `${baseHref}${baseHref.includes('?') ? '&' : '?'}pagina=${page}`;
  return `
    <nav class="admin-pagination" aria-label="Paginacion de elementos">
      <span>Pagina ${currentPage} de ${totalPages} - ${totalItems} elementos</span>
      <div>
        ${currentPage > 1 ? `<a class="button secondary" href="${pageHref(currentPage - 1)}">Anterior</a>` : '<span class="button secondary is-disabled">Anterior</span>'}
        ${currentPage < totalPages ? `<a class="button secondary" href="${pageHref(currentPage + 1)}">Siguiente</a>` : '<span class="button secondary is-disabled">Siguiente</span>'}
      </div>
    </nav>
  `;
}

function adminGoRow({ title, meta, href, compact = false, filterText = '', page = 1, hidden = false }) {
  return `
    <article class="admin-row is-clickable${compact ? ' is-compact' : ''}" data-command="go" data-href="${escapeAttr(href)}" data-filter-text="${escapeAttr(filterText)}" data-page="${escapeAttr(page)}" ${hidden ? 'hidden' : ''}>
      <div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(meta || '')}</span></div>
      <a class="button secondary" href="${escapeAttr(href)}" aria-label="Ir a ${escapeAttr(title)}">Ir</a>
    </article>
  `;
}
function adminRow({ title, meta, editHref, deleteTable, deleteId, deleteLabel, deleteRedirect }) {
  return `
    <article class="admin-row">
      <div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(meta || '')}</span></div>
      <div class="row-actions">
        <a class="icon-action" href="${escapeAttr(editHref)}" aria-label="Editar ${escapeAttr(title)}" title="Editar">${icon('edit')}</a>
        <button class="icon-action danger" type="button" data-command="confirm-delete" data-table="${escapeAttr(deleteTable)}" data-id="${escapeAttr(deleteId)}" data-label="${escapeAttr(deleteLabel)}" data-redirect="${escapeAttr(deleteRedirect)}" aria-label="Borrar ${escapeAttr(title)}" title="Borrar">${icon('trash')}</button>
      </div>
    </article>
  `;
}

function icon(name) {
  if (name === 'logout') return '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 3h9v2H6v14h7v2H4V3Zm10.7 4.3 1.4-1.4 5.1 5.1-5.1 5.1-1.4-1.4 2.7-2.7H10v-2h7.4l-2.7-2.7Z"/></svg>';
  if (name === 'location') return '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z"/></svg>';
  if (name === 'trash') return '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-.7 11H7.7L7 9Zm3 2v7h2v-7h-2Zm4 0v7h2v-7h-2Z"/></svg>';
  if (name === 'audio') return '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4Zm12.5-2.5-1.4 1.4a5.9 5.9 0 0 1 0 8.2l1.4 1.4a7.8 7.8 0 0 0 0-11Zm2.8-2.8-1.4 1.4a11.9 11.9 0 0 1 0 13.8l1.4 1.4a13.9 13.9 0 0 0 0-16.6Z"/></svg>';
  if (name === 'link') return '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M10.6 13.4a1.5 1.5 0 0 1 0-2.1l2.8-2.8a3 3 0 0 1 4.2 4.2l-2 2a5 5 0 0 0 .2-2.6l.4-.4a1 1 0 0 0-1.4-1.4L12 13.1a1.5 1.5 0 0 1-1.4.3Zm2.8-2.8a1.5 1.5 0 0 1 0 2.1l-2.8 2.8a3 3 0 1 1-4.2-4.2l2-2a5 5 0 0 0-.2 2.6l-.4.4a1 1 0 1 0 1.4 1.4l2.8-2.8a1.5 1.5 0 0 1 1.4-.3Z"/></svg>';
  return '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m4 16.6 10.9-11L18.4 9 7.5 20H4v-3.4ZM16.3 4.2l1-1a1.6 1.6 0 0 1 2.3 0l1.2 1.2a1.6 1.6 0 0 1 0 2.3l-1 1-3.5-3.5Z"/></svg>';
}
async function handleAction(form) {
  const action = form.dataset.action;
  const data = Object.fromEntries(new FormData(form).entries());
  try {
    if (action === 'login') {
      state.session = await signIn(data.email, data.password);
    }
    if (action === 'update-password') {
      if (data.password !== data.password_confirm) throw new Error('Las contrasenas no coinciden.');
      await updatePassword(data.password);
      state.session = await getSession();
      showSuccessModal('Contrasena actualizada correctamente.', routePath('/admin/'));
      return;
    }
    if (action === 'save-project') {
      await attachUploadedImage(data, 'cover_image_file', 'projects', 'cover_image_url', 'cover_thumbnail_url');
      const saved = await upsert('guia_projects', projectPayload(data));
      await loadData();
      showSuccessModal('Proyecto guardado correctamente.', routePath(`/admin/proyectos/${saved.id}/`));
      return;
    }
    if (action === 'save-element') {
      await attachUploadedImage(data, 'main_image_file', 'elements', 'main_image_url', 'main_thumbnail_url');
      const saved = await upsert('guia_elements', elementPayload(data));
      await loadData();
      showSuccessModal('Elemento guardado correctamente.', routePath(`/admin/elementos/${saved.id}/`));
      return;
    }
    if (action === 'save-media') {
      await saveMedia(data);
      await loadData();
      navigate(routePath(`/admin/elementos/${data.element_id}/`));
      return;
    }
    await loadData();
    render();
  } catch (error) {
    showToast(error.message || 'No se pudo completar la accion.');
  }
}

async function handleCommand(button, event) {
  const command = button.dataset.command;
  if (command === 'go' && !event.target.closest('a, button')) navigate(button.dataset.href);
  if (command === 'show-more') showMoreInfoModal(button.dataset.element);
  if (command === 'close-info') closeInfoModal();
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
  if (command === 'open-edit-modal') openEditModal(button.dataset);
  if (command === 'close-edit') closeEditModal();
  if (command === 'confirm-delete') showDeleteModal(button.dataset);
  if (command === 'cancel-delete') closeDeleteModal();
  if (command === 'delete-record') await deleteFromModal(button);
  if (command === 'close-success') closeSuccessModal(button.dataset.redirect);
}

function openEditModal({ kind, id }) {
  if (kind === 'project') {
    const project = state.projects.find((item) => item.id === id);
    if (project) showEditModal('Modificar proyecto', projectForm(project));
  }
  if (kind === 'element') {
    const element = state.elements.find((item) => item.id === id);
    if (element) showEditModal('Modificar elemento', elementForm(element));
  }
}
async function upsert(table, payload) {
  if (!supabase) throw new Error('Configura Supabase para guardar cambios.');
  const clean = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== '' && value !== undefined));
  const { data, error } = await supabase.from(table).upsert(clean).select().single();
  if (error) throw error;
  return data;
}

async function saveMedia(data) {
  const base = { id: data.id || undefined, element_id: data.element_id, title: data.title || null, sort_order: Number(data.sort_order || 0) };
  if (data.kind === 'image') {
    await attachUploadedImage(data, 'media_image_file', `elements/${data.element_id}/gallery`, 'url', 'thumbnail_url');
    if (!data.url) throw new Error('Selecciona una imagen para guardar el contenido multimedia.');
    return upsert('guia_element_images', { ...base, image_url: data.url, thumbnail_url: data.thumbnail_url || data.url });
  }
  if (data.kind === 'audio') {
    await attachUploadedAudio(data, 'media_audio_file', `elements/${data.element_id}/audio`, 'url');
    if (!data.url) throw new Error('Selecciona un archivo de audio para guardar el contenido multimedia.');
    return upsert('guia_element_audios', { ...base, audio_url: data.url, language: data.meta || 'Sin idioma' });
  }
  data.url = data.external_url || data.url;
  if (!data.url) throw new Error('Indica una URL para guardar el enlace.');
  return upsert('guia_element_links', { ...base, url: data.url, type: data.meta || 'Otro' });
}

function projectPayload(data) {
  return { id: data.id || undefined, name: data.name, slug: data.slug, short_description: data.short_description, cover_image_url: data.cover_image_url, cover_thumbnail_url: data.cover_thumbnail_url, sort_order: Number(data.sort_order || 0), active: Boolean(data.active) };
}

function elementPayload(data) {
  return { id: data.id || undefined, project_id: data.project_id, category_id: data.category_id || null, title: data.title, slug: data.slug, short_description: data.short_description, long_description: data.long_description, main_image_url: data.main_image_url, main_thumbnail_url: data.main_thumbnail_url, maps_url: data.maps_url, sort_order: Number(data.sort_order || 0), active: Boolean(data.active), featured: Boolean(data.featured) };
}

async function attachUploadedImage(data, fileField, folder, urlField, thumbnailField) {
  const file = data[fileField];
  if (!(file instanceof File) || file.size === 0) return;
  const upload = await uploadOptimizedImage(file, folder);
  data[urlField] = upload.imageUrl;
  data[thumbnailField] = upload.thumbnailUrl;
}

async function attachUploadedAudio(data, fileField, folder, urlField) {
  const file = data[fileField];
  if (!(file instanceof File) || file.size === 0) return;
  const upload = await uploadAudio(file, folder);
  data[urlField] = upload.audioUrl;
}

async function uploadAudio(file, folder) {
  if (!supabase) throw new Error('Configura Supabase para subir audios.');
  const cfg = window.GUIA_CONFIG;
  const maxBytes = cfg.maxAudioMb * 1024 * 1024;
  if (file.size > maxBytes) throw new Error(`El audio supera el limite de ${cfg.maxAudioMb} MB por archivo.`);
  const validTypes = ['audio/mpeg', 'audio/mp4', 'audio/x-m4a'];
  const extension = audioExtension(file);
  if (!validTypes.includes(file.type) && !['mp3', 'm4a'].includes(extension)) throw new Error('Selecciona un audio MP3 o M4A valido.');
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const audioPath = `${folder}/${stamp}.${extension || 'mp3'}`;
  await uploadBlob(audioPath, file, file.type || audioContentType(extension));
  return { audioUrl: publicStorageUrl(audioPath) };
}

function audioExtension(file) {
  const name = file.name || '';
  return name.includes('.') ? name.split('.').pop().toLowerCase() : '';
}

function audioContentType(extension) {
  return extension === 'm4a' ? 'audio/mp4' : 'audio/mpeg';
}
async function uploadOptimizedImage(file, folder) {
  if (!supabase) throw new Error('Configura Supabase para subir imagenes.');
  const cfg = window.GUIA_CONFIG;
  const maxBytes = cfg.maxImageMb * 1024 * 1024;
  if (file.size > maxBytes) throw new Error(`La imagen supera el limite de ${cfg.maxImageMb} MB por archivo.`);
  if (!file.type.startsWith('image/')) throw new Error('Selecciona un archivo de imagen valido.');

  const imageBlob = await optimizeImage(file, 1800, cfg.maxOptimizedImageKb * 1024);
  const thumbBlob = await optimizeImage(file, 520, 120 * 1024);
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const basePath = `${folder}/${stamp}`;
  const imagePath = `${basePath}.webp`;
  const thumbPath = `${basePath}-thumb.webp`;

  await uploadBlob(imagePath, imageBlob);
  await uploadBlob(thumbPath, thumbBlob);

  return {
    imageUrl: publicStorageUrl(imagePath),
    thumbnailUrl: publicStorageUrl(thumbPath)
  };
}

async function uploadBlob(path, blob, contentType = 'image/webp') {
  const bucket = window.GUIA_CONFIG.storageBucket;
  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    cacheControl: '31536000',
    contentType,
    upsert: true
  });
  if (error) throw error;
}

function publicStorageUrl(path) {
  const { data } = supabase.storage.from(window.GUIA_CONFIG.storageBucket).getPublicUrl(path);
  return data.publicUrl;
}

async function optimizeImage(file, maxSide, maxBytes) {
  const bitmap = await imageBitmapFromFile(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  if (bitmap.close) bitmap.close();

  let quality = 0.86;
  let blob = await canvasToBlob(canvas, quality);
  while (blob.size > maxBytes && quality > 0.42) {
    quality -= 0.08;
    blob = await canvasToBlob(canvas, quality);
  }

  if (blob.size > maxBytes) {
    return shrinkCanvasUntil(canvas, maxBytes);
  }
  return blob;
}

async function shrinkCanvasUntil(canvas, maxBytes) {
  let current = canvas;
  let blob = await canvasToBlob(current, 0.42);
  while (blob.size > maxBytes && current.width > 480 && current.height > 480) {
    const smaller = document.createElement('canvas');
    smaller.width = Math.round(current.width * 0.82);
    smaller.height = Math.round(current.height * 0.82);
    smaller.getContext('2d', { alpha: false }).drawImage(current, 0, 0, smaller.width, smaller.height);
    current = smaller;
    blob = await canvasToBlob(current, 0.42);
  }
  return blob;
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('No se pudo optimizar la imagen.')), 'image/webp', quality);
  });
}

async function imageBitmapFromFile(file) {
  if ('createImageBitmap' in window) return createImageBitmap(file, { imageOrientation: 'from-image' });
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    image.src = URL.createObjectURL(file);
  });
}

function mediaForElement(elementId) {
  const images = state.images.filter((item) => item.element_id === elementId).map((item) => ({
    ...item,
    kind: 'image',
    url: item.image_url,
    meta: 'Imagen',
    sort_order: item.sort_order || 0
  }));
  const audios = state.audios.filter((item) => item.element_id === elementId).map((item) => ({
    ...item,
    kind: 'audio',
    url: item.audio_url,
    meta: item.language,
    sort_order: item.sort_order || 0
  }));
  const links = state.links.filter((item) => item.element_id === elementId).map((item) => ({
    ...item,
    kind: 'link',
    url: item.url,
    meta: item.type,
    sort_order: item.sort_order || 0
  }));
  return [...images, ...audios, ...links].sort(bySort);
}

function mediaKindLabel(kind) {
  return { image: 'Imagen', audio: 'Audio', link: 'Enlace' }[kind] || 'Contenido';
}

function mediaTable(kind) {
  return {
    image: 'guia_element_images',
    audio: 'guia_element_audios',
    link: 'guia_element_links'
  }[kind];
}

function showMoreInfoModal(elementId) {
  closeInfoModal();
  const element = state.elements.find((item) => item.id === elementId);
  if (!element || !(element.long_description || '').trim()) return;
  const modal = document.createElement('div');
  modal.className = 'confirm-backdrop';
  modal.dataset.infoModal = 'true';
  modal.innerHTML = `
    <section class="confirm-modal info-modal" role="dialog" aria-modal="true" aria-labelledby="info-title">
      <div class="modal-title-row">
        <h2 id="info-title">Informacion ampliada</h2>
        <button class="icon-action" type="button" data-command="close-info" aria-label="Cerrar">X</button>
      </div>
      <p>${escapeHtml(element.long_description)}</p>
      <div class="actions">
        <button class="button primary" type="button" data-command="close-info">Cerrar</button>
      </div>
    </section>
  `;
  document.body.append(modal);
  modal.querySelector('[data-command="close-info"]')?.focus();
}

function closeInfoModal() {
  document.querySelector('[data-info-modal]')?.remove();
}
function showDeleteModal({ table, id, label, redirect }) {
  closeDeleteModal();
  const modal = document.createElement('div');
  modal.className = 'confirm-backdrop';
  modal.dataset.deleteModal = 'true';
  modal.innerHTML = `
    <section class="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title">
      <h2 id="delete-title">Confirmar borrado</h2>
      <p>Vas a borrar <strong>${escapeHtml(label)}</strong>. Esta accion no se puede deshacer.</p>
      <div class="actions">
        <button class="button secondary" type="button" data-command="cancel-delete">Cancelar</button>
        <button class="button danger" type="button" data-command="delete-record" data-table="${escapeAttr(table)}" data-id="${escapeAttr(id)}" data-redirect="${escapeAttr(redirect)}">Borrar</button>
      </div>
    </section>
  `;
  document.body.append(modal);
  modal.querySelector('[data-command="cancel-delete"]').focus();
}

function closeDeleteModal() {
  document.querySelector('[data-delete-modal]')?.remove();
}

async function deleteFromModal(button) {
  try {
    if (!supabase) throw new Error('Configura Supabase para borrar contenido.');
    const { error } = await supabase.from(button.dataset.table).delete().eq('id', button.dataset.id);
    if (error) throw error;
    const redirect = button.dataset.redirect || routePath('/admin/');
    closeDeleteModal();
    await loadData();
    navigate(redirect);
  } catch (error) {
    showToast(error.message || 'No se pudo borrar el registro.');
  }
}

function showEditModal(title, formHtml) {
  closeEditModal();
  const modal = document.createElement('div');
  modal.className = 'confirm-backdrop';
  modal.dataset.editModal = 'true';
  modal.innerHTML = `
    <section class="confirm-modal edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-title">
      <div class="modal-title-row">
        <h2 id="edit-title">${escapeHtml(title)}</h2>
        <button class="icon-action" type="button" data-command="close-edit" aria-label="Cerrar">X</button>
      </div>
      ${formHtml}
    </section>
  `;
  document.body.append(modal);
  modal.querySelector('input, textarea, select, button')?.focus();
}

function closeEditModal() {
  document.querySelector('[data-edit-modal]')?.remove();
}
function showSuccessModal(message, redirect = '') {
  closeSuccessModal();
  const modal = document.createElement('div');
  modal.className = 'confirm-backdrop';
  modal.dataset.successModal = 'true';
  modal.innerHTML = `
    <section class="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="success-title">
      <h2 id="success-title">Cambios guardados</h2>
      <p>${escapeHtml(message)}</p>
      <div class="actions">
        <button class="button primary" type="button" data-command="close-success" data-redirect="${escapeAttr(redirect)}">Aceptar</button>
      </div>
    </section>
  `;
  document.body.append(modal);
  modal.querySelector('[data-command="close-success"]').focus();
}

function closeSuccessModal(redirect = '') {
  document.querySelector('[data-success-modal]')?.remove();
  if (redirect) {
    closeEditModal();
    navigate(redirect);
  }
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