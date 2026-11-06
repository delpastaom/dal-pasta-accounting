// رمز الأرقام الأربعة قفل سريع لشاشة هذا الجهاز فقط، وليس هو ما يحمي البيانات.
// الحماية الفعلية هي جلسة الحساب؛ لذلك يُخزَّن الرمز مجزّأً هنا ولا يُرسل إلى القاعدة أبدًا.

const PIN_KEY = 'dp_device_pin';
const FAILS_KEY = 'dp_pin_fails';

/** بعد هذا العدد من المحاولات الخاطئة يُسجَّل الخروج من الحساب وتُطلب كلمة المرور. */
export const MAX_PIN_ATTEMPTS = 5;

async function hashPin(pin: string, salt: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${pin}`));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function hasDevicePin(): boolean {
  return localStorage.getItem(PIN_KEY) !== null;
}

export async function setDevicePin(pin: string): Promise<void> {
  const salt = crypto.randomUUID();
  localStorage.setItem(PIN_KEY, JSON.stringify({ salt, hash: await hashPin(pin, salt) }));
  localStorage.removeItem(FAILS_KEY);
  removeLegacyPlainPin();
}

export async function verifyDevicePin(pin: string): Promise<boolean> {
  try {
    const { salt, hash } = JSON.parse(localStorage.getItem(PIN_KEY) || '');
    return (await hashPin(pin, salt)) === hash;
  } catch {
    return false;
  }
}

export function clearDevicePin(): void {
  localStorage.removeItem(PIN_KEY);
  localStorage.removeItem(FAILS_KEY);
}

export function recordPinFailure(): number {
  const fails = (parseInt(localStorage.getItem(FAILS_KEY) || '0', 10) || 0) + 1;
  localStorage.setItem(FAILS_KEY, String(fails));
  return fails;
}

export function resetPinFailures(): void {
  localStorage.removeItem(FAILS_KEY);
}

// النسخ السابقة كانت تحفظ الرمز نصًا صريحًا داخل الإعدادات
function removeLegacyPlainPin(): void {
  try {
    const raw = localStorage.getItem('dp_settings');
    if (!raw) return;
    const settings = JSON.parse(raw);
    if ('pin' in settings) {
      delete settings.pin;
      localStorage.setItem('dp_settings', JSON.stringify(settings));
    }
  } catch { /* إعدادات تالفة: لا شيء نحذفه */ }
}
