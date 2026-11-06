import { createClient, SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_URL = 'https://yhhwjxfgmgmnjolmovqo.supabase.co';
const DEFAULT_KEY = 'sb_publishable_vSzHVR97K65Npo0rgwPOcg_inbotGlz';

function getSupabaseConfig() {
  const savedUrl = localStorage.getItem('sb_url');
  const savedKey = localStorage.getItem('sb_key');
  return { url: savedUrl || DEFAULT_URL, key: savedKey || DEFAULT_KEY };
}

let cachedClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) return null;
  if (!cachedClient || cachedClient !== cachedClient) {
    cachedClient = createClient(url, key);
  }
  return cachedClient;
}

export function isSupabaseConnected(): boolean {
  const { url, key } = getSupabaseConfig();
  return !!url && !!key;
}

export function setSupabaseConfig(url: string, key: string) {
  localStorage.setItem('sb_url', url);
  localStorage.setItem('sb_key', key);
  cachedClient = null;
  window.location.reload();
}

export { getSupabaseConfig };
