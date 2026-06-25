const cfg = window.GUIA_CONFIG || {};
const cleanUrl = (cfg.supabaseUrl || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');

export let supabase = null;

export async function initSupabase() {
  if (supabase || !cleanUrl || !cfg.supabaseAnonKey) return supabase;
  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    supabase = createClient(cleanUrl, cfg.supabaseAnonKey, {
      auth: { detectSessionInUrl: false }
    });
  } catch (error) {
    console.warn('No se pudo cargar Supabase JS. La app usara datos demo.', error);
  }
  return supabase;
}

export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function signIn(email, password) {
  if (!supabase) throw new Error('Supabase no esta disponible. Revisa la URL, la clave publica y la conexion.');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function completeAuthFromUrl() {
  if (!supabase) return { session: null, type: '' };

  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const code = search.get('code');
  const type = search.get('type') || hash.get('type') || '';
  const accessToken = hash.get('access_token');
  const refreshToken = hash.get('refresh_token');

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return { session: data.session, type };
  }

  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });
    if (error) throw error;
    return { session: data.session, type };
  }

  return { session: null, type };
}

export async function updatePassword(password) {
  if (!supabase) throw new Error('Supabase no esta disponible.');
  const { data, error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
  return data.user;
}
export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}
