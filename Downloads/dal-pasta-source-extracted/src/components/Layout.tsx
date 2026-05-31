import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { t, getLang, setLang } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n';

interface LayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
  cloudConnected?: boolean;
}

const menuItems = [
  { path: '/', icon: '📊', label: 'dashboard' },
  { path: '/orders', icon: '🛒', label: 'orders' },
  { path: '/dishes', icon: '🍽️', label: 'dishes' },
  { path: '/expenses', icon: '💰', label: 'expenses' },
  { path: '/purchases', icon: '📦', label: 'purchases' },
  { path: '/inventory', icon: '🥘', label: 'inventory' },
  { path: '/reports', icon: '📈', label: 'reports' },
  { path: '/settings', icon: '⚙️', label: 'settings' },
];

export default function Layout({ children, onLogout, cloudConnected = false }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [lang, setLangState] = useState<Lang>(getLang());

  useEffect(() => {
    const handler = () => setLangState(getLang());
    window.addEventListener('langchange', handler);
    return () => window.removeEventListener('langchange', handler);
  }, []);

  const toggleLang = () => {
    const newLang = lang === 'ar' ? 'en' : 'ar';
    setLang(newLang as Lang);
    setLangState(newLang as Lang);
  };

  const currentLabel = menuItems.find(m => m.path === location.pathname)?.label || 'dashboard';

  return (
    <div className="min-h-screen flex" style={{ background: '#FFF8ED' }}>
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky lg:top-0 lg:h-screen inset-y-0 ${lang === 'ar' ? 'right-0' : 'left-0'} w-64 z-50 transform transition-transform duration-300 lg:transform-none ${
          sidebarOpen
            ? 'translate-x-0'
            : lang === 'ar'
            ? 'translate-x-full lg:translate-x-0'
            : '-translate-x-full lg:translate-x-0'
        }`}
        style={{ background: 'linear-gradient(180deg, #2C1810 0%, #3D2517 100%)' }}
      >
        <div className="flex flex-col h-full overflow-y-auto">
          {/* Logo */}
          <div className="p-6 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #E5A53C, #D4932A)' }}>
              <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
                <path d="M24 4C12.95 4 4 12.95 4 24s8.95 20 20 20 20-8.95 20-20S35.05 4 24 4zm0 36c-8.82 0-16-7.18-16-16S15.18 8 24 8s16 7.18 16 16-7.18 16-16 16z" fill="#FFF8ED"/>
                <path d="M18 22c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm12 0c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm-6 10c-3.87 0-7.17-2.51-8.32-6h2.08c.97 2.25 3.18 3.83 5.75 3.75 2.49-.08 4.62-1.75 5.5-4h2.18c-1.15 3.49-4.45 6.25-8.19 6.25z" fill="#FFF8ED"/>
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold" style={{ color: '#E5A53C' }}>{t('appName')}</h1>
            </div>
          </div>

          {/* Cloud Status */}
          <div className="mx-4 mb-3 px-3 py-2 rounded-lg text-center text-xs font-medium"
            style={{
              background: cloudConnected ? 'rgba(22,163,74,0.2)' : 'rgba(220,38,38,0.15)',
              color: cloudConnected ? '#86efac' : '#fca5a5',
              border: `1px solid ${cloudConnected ? 'rgba(22,163,74,0.3)' : 'rgba(220,38,38,0.2)'}`,
            }}>
            {cloudConnected ? '☁️ متصل بالسحابة' : '💻 وضع محلي فقط'}
          </div>

          {/* Menu */}
          <nav className="flex-1 px-3 py-2 space-y-1">
            {menuItems.map(item => {
              const active = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    active
                      ? 'text-amber-950'
                      : 'text-amber-100/70 hover:text-white hover:bg-white/10'
                  }`}
                  style={active ? { background: '#E5A53C' } : {}}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span>{t(item.label as any)}</span>
                </button>
              );
            })}
          </nav>

          {/* Bottom Actions */}
          <div className="p-4 border-t border-white/10 space-y-2">
            <button
              onClick={toggleLang}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-amber-100/70 hover:text-white hover:bg-white/10 transition-all"
            >
              <span className="text-lg">🌐</span>
              <span>{lang === 'ar' ? 'English' : 'العربية'}</span>
            </button>
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-red-300 hover:text-red-200 hover:bg-red-500/20 transition-all"
            >
              <span className="text-lg">🚪</span>
              <span>{t('logout')}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 px-4 py-3 flex items-center gap-3" style={{ background: 'rgba(255,248,237,0.95)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(229,165,60,0.2)' }}>
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-amber-100/50 transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2C1810" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <h2 className="font-bold text-lg" style={{ color: '#2C1810' }}>{t(currentLabel as any)}</h2>
          <div className="flex-1" />
          <div className="text-xs font-medium px-3 py-1.5 rounded-full" style={{ background: '#E5A53C20', color: '#8B6914' }}>
            {new Date().toLocaleDateString(lang === 'ar' ? 'ar-OM' : 'en-OM', { weekday: 'short', day: 'numeric', month: 'short' })}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
