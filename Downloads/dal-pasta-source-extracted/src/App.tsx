import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate } from 'react-router';
import PinLock from '@/components/PinLock';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import Orders from '@/pages/Orders';
import Expenses from '@/pages/Expenses';
import Purchases from '@/pages/Purchases';
import Inventory from '@/pages/Inventory';
import Reports from '@/pages/Reports';
import Settings from '@/pages/Settings';
import Dishes from '@/pages/Dishes';
import { seedData, isCloudConnected } from '@/lib/hybrid-db';

export default function App() {
  const [locked, setLocked] = useState(true);
  const [cloudConnected, setCloudConnected] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setCloudConnected(isCloudConnected());
    seedData().catch(() => {});
  }, []);

  const handleUnlock = useCallback(() => {
    setLocked(false);
    navigate('/');
  }, [navigate]);

  const handleLogout = useCallback(() => {
    setLocked(true);
  }, []);

  if (locked) {
    return <PinLock onUnlock={handleUnlock} />;
  }

  return (
    <Layout onLogout={handleLogout} cloudConnected={cloudConnected}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/purchases" element={<Purchases />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/dishes" element={<Dishes />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  );
}
