import { useState, useCallback } from 'react';
import { t } from '@/lib/i18n';
import { verifyStoredPin } from '@/lib/supabase';

interface PinLockProps {
  onUnlock: () => void;
}

export default function PinLock({ onUnlock }: PinLockProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleKey = useCallback((key: string) => {
    setError(false);
    if (key === 'backspace') {
      setPin(p => p.slice(0, -1));
    } else if (key === 'clear') {
      setPin('');
    } else if (pin.length < 4) {
      const newPin = pin + key;
      setPin(newPin);
      if (newPin.length === 4) {
        setTimeout(async () => {
          try {
            const valid = await verifyStoredPin(newPin);
            if (valid) {
              onUnlock();
            } else {
              setError(true);
              setPin('');
            }
          } catch {
            // If Supabase fails, try local fallback
            const saved = localStorage.getItem('dp_settings');
            let localPin = '1234';
            if (saved) { try { localPin = JSON.parse(saved).pin || '1234'; } catch { /* ignore */ } }
            if (newPin === localPin) {
              onUnlock();
            } else {
              setError(true);
              setPin('');
            }
          }
        }, 200);
      }
    }
  }, [pin, onUnlock]);

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'backspace'];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: 'linear-gradient(135deg, #FFF8ED 0%, #F5E6C8 100%)' }}>
      <div className="mb-8 flex flex-col items-center">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4 shadow-lg" style={{ background: 'linear-gradient(135deg, #E5A53C, #D4932A)' }}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <path d="M24 4C12.95 4 4 12.95 4 24s8.95 20 20 20 20-8.95 20-20S35.05 4 24 4zm0 36c-8.82 0-16-7.18-16-16S15.18 8 24 8s16 7.18 16 16-7.18 16-16 16z" fill="#FFF8ED"/>
            <path d="M18 22c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm12 0c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm-6 10c-3.87 0-7.17-2.51-8.32-6h2.08c.97 2.25 3.18 3.83 5.75 3.75 2.49-.08 4.62-1.75 5.5-4h2.18c-1.15 3.49-4.45 6.25-8.19 6.25z" fill="#FFF8ED"/>
          </svg>
        </div>
        <h1 className="text-3xl font-bold" style={{ color: '#2C1810' }}>{t('appName')}</h1>
        <p className="text-sm mt-1" style={{ color: '#8B7355' }}>{t('appSubtitle')}</p>
        <p className="text-xs mt-2 px-3 py-1 rounded-full font-medium" style={{ background: '#E5A53C30', color: '#8B6914' }}>v2.0 Cloud Ready</p>
      </div>

      <div className="mb-6">
        <p className="text-center mb-4 font-medium" style={{ color: '#2C1810' }}>{t('pinTitle')}</p>
        <div className="flex gap-4 justify-center">
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{
              width: 18, height: 18, borderRadius: '50%',
              border: '2px solid #E5A53C',
              background: i < pin.length ? '#E5A53C' : 'transparent',
              transition: 'all 0.2s',
              boxShadow: error ? '0 0 8px rgba(239,68,68,0.5)' : 'none',
            }} />
          ))}
        </div>
        {error && <p className="text-center mt-3 text-sm font-medium animate-fadeIn" style={{ color: '#dc2626' }}>{t('pinWrong')}</p>}
      </div>

      <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
        {keys.map((key) => {
          if (key === 'backspace') {
            return (<button key={key} onClick={() => handleKey(key)} className="h-14 rounded-xl flex items-center justify-center font-medium transition-all active:scale-95" style={{ background: 'rgba(44,24,16,0.08)', color: '#2C1810' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/></svg>
            </button>);
          }
          if (key === 'clear') {
            return (<button key={key} onClick={() => handleKey(key)} className="h-14 rounded-xl text-sm font-medium transition-all active:scale-95" style={{ background: 'rgba(44,24,16,0.08)', color: '#2C1810' }}>C</button>);
          }
          return (<button key={key} onClick={() => handleKey(key)} className="h-14 rounded-xl text-xl font-semibold transition-all active:scale-95" style={{ background: 'white', color: '#2C1810', boxShadow: '0 2px 8px rgba(44,24,16,0.1)' }}>{key}</button>);
        })}
      </div>

      <p className="text-xs mt-6 text-center" style={{ color: '#A08B6D' }}>{t('pinSubtitle')}</p>
    </div>
  );
}
