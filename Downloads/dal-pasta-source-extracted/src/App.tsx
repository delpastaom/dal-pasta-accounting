import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate } from 'react-router';
import PinLock from '@/components/PinLock';
import LoginScreen from '@/components/LoginScreen';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import Orders from '@/pages/Orders';
import Expenses from '@/pages/Expenses';
import Purchases from '@/pages/Purchases';
import Inventory from '@/pages/Inventory';
import Reports from '@/pages/Reports';
import Settings from '@/pages/Settings';
import Dishes from '@/pages/Dishes';
import AIInvoice from '@/pages/AIInvoice';
import { CLOUD_READ_ERROR_EVENT, isCloudConnected } from '@/lib/hybrid-db';
import { watchSession } from '@/lib/auth';
import { t } from '@/lib/i18n';

export default function App() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [locked, setLocked] = useState(true);
  const [cloudReadFailed, setCloudReadFailed] = useState(false);
  const [cloudConnected, setCloudConnected] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setCloudConnected(isCloudConnected());
    const stopWatching = watchSession(isIn => {
      setSignedIn(isIn);
      if (!isIn) setLocked(true);
    });
    const onReadError = () => setCloudReadFailed(true);
    window.addEventListener(CLOUD_READ_ERROR_EVENT, onReadError);
    return () => {
      stopWatching();
      window.removeEventListener(CLOUD_READ_ERROR_EVENT, onReadError);
    };
  }, []);

  const handleUnlock = useCallback(() => {
    setLocked(false);
    navigate('/');
  }, [navigate]);

  const handleLogout = useCallback(() => {
    setLocked(true);
  }, []);

  if (signedIn === null) return null;
  if (!signedIn) return <LoginScreen />;

  if (locked) {
    return <PinLock onUnlock={handleUnlock} />;
  }

  return (
    <Layout onLogout={handleLogout} cloudConnected={cloudConnected}>
      {cloudReadFailed && (
        <div role="alert" className="mb-4 p-3 rounded-lg text-sm flex items-start justify-between gap-3" style={{ background: '#fef3c7', color: '#92400e' }}>
          <span>⚠️ {t('cloudReadError')}</span>
          <button onClick={() => setCloudReadFailed(false)} aria-label="×" className="font-bold">×</button>
        </div>
      )}
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/purchases" element={<Purchases />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/dishes" element={<Dishes />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/ai-invoice" element={<AIInvoice />} />
      </Routes>
    </Layout>
  );
}
