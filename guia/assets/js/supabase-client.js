const cfg = window.GUIA_CONFIG || {};
const cleanUrl = (cfg.supabaseUrl || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');

export let supabase = null;

export async function initSupabase() {
  if (supabase || !cleanUrl || !cfg.supabaseAnonKey) return supabase;
  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    supabase = createClient(cleanUrl, cfg.supabaseAnonKey);
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

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}
