import { getSupabase } from './supabase';
import { clearDevicePin } from './device-pin';

export type LoginResult = 'ok' | 'wrong' | 'failed';

export async function signIn(email: string, password: string): Promise<LoginResult> {
  const sb = getSupabase();
  if (!sb) return 'failed';
  try {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (!error) return 'ok';
    return error.status === 400 ? 'wrong' : 'failed';
  } catch {
    return 'failed';
  }
}

/** يخرج من الحساب على هذا الجهاز فقط، ويمسح رمز الشاشة ليُختار رمز جديد عند الدخول التالي. */
export async function signOut(): Promise<void> {
  clearDevicePin();
  await getSupabase()?.auth.signOut({ scope: 'local' });
}

/** يبلّغ بحالة الجلسة فورًا عند الاشتراك ثم عند كل تغيّر، ويعيد دالة إلغاء الاشتراك. */
export function watchSession(onChange: (signedIn: boolean) => void): () => void {
  const sb = getSupabase();
  if (!sb) {
    onChange(false);
    return () => {};
  }
  const { data } = sb.auth.onAuthStateChange((_event, session) => onChange(!!session));
  return () => data.subscription.unsubscribe();
}
