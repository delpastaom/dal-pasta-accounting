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

// ==================== PIN Storage (Cloud) ====================

const PIN_TABLE = 'app_settings';
const PIN_KEY = 'user_pin';

export async function verifyStoredPin(pin: string): Promise<boolean> {
  if (!isSupabaseConnected()) {
    // Fallback to localStorage
    const saved = localStorage.getItem('dp_settings');
    if (saved) { try { return JSON.parse(saved).pin === pin; } catch { return pin === '1234'; } }
    return pin === '1234';
  }
  const sb = getSupabase();
  if (!sb) return pin === '1234';
  const { data, error } = await sb.from(PIN_TABLE).select('value').eq('key', PIN_KEY).single();
  if (error || !data) {
    // No PIN in cloud yet - use local fallback
    const saved = localStorage.getItem('dp_settings');
    let localPin = '1234';
    if (saved) { try { localPin = JSON.parse(saved).pin || '1234'; } catch { /* ignore */ } }
    // Auto-sync local PIN to cloud
    await sb.from(PIN_TABLE).upsert({ key: PIN_KEY, value: localPin }, { onConflict: 'key' }).select();
    return localPin === pin;
  }
  return data.value === pin;
}

export async function updateStoredPin(currentPin: string, newPin: string): Promise<boolean> {
  // Verify current pin first
  const valid = await verifyStoredPin(currentPin);
  if (!valid) return false;

  if (isSupabaseConnected()) {
    const sb = getSupabase();
    if (sb) {
      await sb.from(PIN_TABLE).upsert({ key: PIN_KEY, value: newPin }, { onConflict: 'key' });
    }
  }
  // Always update localStorage as fallback
  localStorage.setItem('dp_settings', JSON.stringify({ pin: newPin, currency: 'OMR', lang: 'ar' }));
  return true;
}

export async function getStoredPin(): Promise<string> {
  if (!isSupabaseConnected()) {
    const saved = localStorage.getItem('dp_settings');
    if (saved) { try { return JSON.parse(saved).pin || '1234'; } catch { return '1234'; } }
    return '1234';
  }
  const sb = getSupabase();
  if (!sb) return '1234';
  const { data, error } = await sb.from(PIN_TABLE).select('value').eq('key', PIN_KEY).single();
  if (error || !data) return '1234';
  return data.value || '1234';
}
