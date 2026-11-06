import { useState, type FormEvent } from 'react';
import { t } from '@/lib/i18n';
import { signIn } from '@/lib/auth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    const result = await signIn(email.trim(), password);
    // عند النجاح تنتقل الواجهة تلقائيًا بمجرد تغيّر الجلسة
    if (result !== 'ok') {
      setMessage(t(result === 'wrong' ? 'loginWrong' : 'loginFailed'));
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: 'linear-gradient(135deg, #FFF8ED 0%, #F5E6C8 100%)' }}>
      <h1 className="text-3xl font-bold" style={{ color: '#2C1810' }}>{t('appName')}</h1>
      <p className="text-sm mt-1 mb-8" style={{ color: '#8B7355' }}>{t('loginSubtitle')}</p>
      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-4">
        <div>
          <Label htmlFor="login-email" className="text-xs">{t('loginEmail')}</Label>
          <Input id="login-email" type="email" dir="ltr" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="login-password" className="text-xs">{t('loginPassword')}</Label>
          <Input id="login-password" type="password" dir="ltr" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className="mt-1" />
        </div>
        {message && <p role="alert" className="text-sm text-center font-medium" style={{ color: '#dc2626' }}>{message}</p>}
        <Button type="submit" disabled={busy} className="w-full" style={{ background: '#E5A53C' }}>{t('loginButton')}</Button>
      </form>
    </div>
  );
}
