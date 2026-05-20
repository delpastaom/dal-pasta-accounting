import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { t } from '@/lib/i18n';
import { OrderDB, ProductDB, ExpenseDB, type Order } from '@/lib/hybrid-db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DashboardStats {
  income: number;
  expenses: number;
  profit: number;
  todayOrders: number;
  pendingBookings: number;
  lowStock: number;
  expenseRatio: number;
  avgOrder: number;
  recentOrders: Order[];
  categoryBreakdown: { category: string; amount: number; percentage: number }[];
  upcomingBookings: Order[];
  outstandingOrders: Order[];
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    income: 0, expenses: 0, profit: 0,
    todayOrders: 0, pendingBookings: 0, lowStock: 0,
    expenseRatio: 0, avgOrder: 0, recentOrders: [],
    categoryBreakdown: [],
    upcomingBookings: [],
    outstandingOrders: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // استدعاء واحد للطلبات + استدعاءات متوازية للباقي
      const [allOrders, expenses, lowStock] = await Promise.all([
        OrderDB.getAll(),
        ExpenseDB.getAll(),
        ProductDB.getLowStock(),
      ]);

      const today = new Date().toISOString().split('T')[0];
      const in7Days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
      const thisMonthKey = today.substring(0, 7);

      // نحسب كل شي محلياً بدون استدعاءات إضافية
      const todayOrders = allOrders.filter(o => o.orderDate === today);
      const pendingBookings = allOrders.filter(o => o.type === 'advance' && o.status === 'pending');
      const recentOrders = allOrders.slice(0, 5);

      const monthOrders = allOrders.filter(o => o.deliveryDate.startsWith(thisMonthKey) && o.status === 'completed');
      const monthExpenses = expenses.filter(e => e.date.startsWith(thisMonthKey));
      const income = monthOrders.reduce((s, o) => s + o.total, 0);
      const expTotal = monthExpenses.reduce((s, e) => s + e.amount, 0);
      const avgOrder = monthOrders.length > 0 ? income / monthOrders.length : 0;

      const catMap: Record<string, number> = {};
      expenses.forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + e.amount; });
      const totalExp = Object.values(catMap).reduce((s, v) => s + v, 0);
      const categoryBreakdown = Object.entries(catMap)
        .map(([category, amount]) => ({ category, amount, percentage: totalExp > 0 ? Math.round((amount / totalExp) * 100) : 0 }))
        .sort((a, b) => b.amount - a.amount);

      const upcomingBookings = pendingBookings
        .filter(o => o.deliveryDate >= today && o.deliveryDate <= in7Days)
        .sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate));
      const outstandingOrders = pendingBookings
        .filter(o => o.deposit < o.total)
        .sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate));

      const expenseRatio = income > 0 ? (expTotal / income) * 100 : 0;

      setStats({
        income,
        expenses: expTotal,
        profit: income - expTotal,
        todayOrders: todayOrders.length,
        pendingBookings: pendingBookings.length,
        lowStock: lowStock.length,
        expenseRatio,
        avgOrder,
        recentOrders,
        categoryBreakdown,
        upcomingBookings,
        outstandingOrders,
      });
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const cards = [
    {
      title: t('totalIncome'),
      value: `${stats.income.toFixed(2)} ${t('omr')}`,
      icon: '💵',
      color: '#16a34a',
      bg: '#dcfce7',
      path: '/reports',
    },
    {
      title: t('totalExpenses'),
      value: `${stats.expenses.toFixed(2)} ${t('omr')}`,
      icon: '💸',
      color: '#dc2626',
      bg: '#fee2e2',
      path: '/expenses',
    },
    {
      title: t('netProfit'),
      value: `${stats.profit.toFixed(2)} ${t('omr')}`,
      icon: '📈',
      color: stats.profit >= 0 ? '#16a34a' : '#dc2626',
      bg: stats.profit >= 0 ? '#dcfce7' : '#fee2e2',
      path: '/reports',
    },
    {
      title: t('todayOrders'),
      value: stats.todayOrders.toString(),
      icon: '🛒',
      color: '#2563eb',
      bg: '#dbeafe',
      path: '/orders',
    },
    {
      title: t('pendingBookings'),
      value: stats.pendingBookings.toString(),
      icon: '⏳',
      color: '#d97706',
      bg: '#fef3c7',
      path: '/orders',
    },
    {
      title: t('lowStock'),
      value: stats.lowStock.toString(),
      icon: '⚠️',
      color: '#dc2626',
      bg: '#fee2e2',
      path: '/inventory',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: '#E5A53C', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Warning Banner */}
      {stats.expenseRatio > 70 && (
        <div className={`rounded-xl p-4 flex items-center gap-3 ${stats.expenseRatio > 80 ? 'animate-pulse-warn' : ''}`}
          style={{ background: stats.expenseRatio > 80 ? '#fee2e2' : '#fef3c7', border: `1px solid ${stats.expenseRatio > 80 ? '#f87171' : '#fbbf24'}` }}>
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="font-bold text-sm" style={{ color: stats.expenseRatio > 80 ? '#991b1b' : '#92400e' }}>
              {stats.expenseRatio > 80 ? t('warning80') : t('warning70')}
            </p>
            <p className="text-xs mt-0.5" style={{ color: stats.expenseRatio > 80 ? '#b91c1c' : '#a16207' }}>
              {t('expenseRatio')}: {stats.expenseRatio.toFixed(1)}%
            </p>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t('newOrder'), icon: '🛒', path: '/orders', color: '#2563eb' },
          { label: t('newExpense'), icon: '💰', path: '/expenses', color: '#dc2626' },
          { label: t('newPurchase'), icon: '📦', path: '/purchases', color: '#16a34a' },
        ].map(btn => (
          <button
            key={btn.path}
            onClick={() => navigate(btn.path)}
            className="flex flex-col items-center gap-2 p-4 rounded-xl text-white font-medium text-sm transition-all active:scale-95"
            style={{ background: `linear-gradient(135deg, ${btn.color}, ${btn.color}dd)` }}
          >
            <span className="text-2xl">{btn.icon}</span>
            <span>{btn.label}</span>
          </button>
        ))}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(card => (
          <Card key={card.title} className="cursor-pointer transition-all hover:shadow-md active:scale-[0.98]" onClick={() => navigate(card.path)}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium" style={{ color: '#8B7355' }}>{card.title}</p>
                  <p className="text-xl font-bold mt-1" style={{ color: card.color }}>{card.value}</p>
                </div>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg" style={{ background: card.bg }}>{card.icon}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">{t('recentOrders')}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {stats.recentOrders.length === 0 ? (
            <div className="p-6 text-center text-sm" style={{ color: '#8B7355' }}>{t('noOrders')}</div>
          ) : (
            <div className="divide-y divide-amber-100/50">
              {stats.recentOrders.map(order => (
                <div key={order.id} className="p-4 flex items-center justify-between hover:bg-amber-50/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{order.customerName}</p>
                      {order.type === 'advance' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: '#fef3c7', color: '#92400e' }}>{t('deposit')}</span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: '#8B7355' }}>
                      {order.items.map(i => i.dishName).join(', ')} · {order.deliveryDate}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm" style={{ color: '#2C1810' }}>{order.total.toFixed(2)} {t('omr')}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      order.status === 'completed' ? 'bg-green-100 text-green-700' :
                      order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>{t(order.status)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Deliveries */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <span>📅</span> {t('upcomingDeliveries')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {stats.upcomingBookings.length === 0 ? (
            <div className="p-4 text-center text-sm" style={{ color: '#8B7355' }}>{t('noUpcoming')}</div>
          ) : (
            <div className="divide-y divide-amber-100/50">
              {stats.upcomingBookings.map(order => {
                const daysLeft = Math.ceil((new Date(order.deliveryDate).getTime() - Date.now()) / 86400000);
                return (
                  <div key={order.id} className="p-4 flex items-center justify-between hover:bg-amber-50/50 cursor-pointer" onClick={() => navigate('/orders')}>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{order.customerName}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#8B7355' }}>
                        {order.items.map(i => i.dishName).join(', ')}
                      </p>
                    </div>
                    <div className="text-left flex-shrink-0 mr-3">
                      <p className="font-bold text-sm" style={{ color: '#E5A53C' }}>{order.deliveryDate}</p>
                      <p className="text-xs" style={{ color: daysLeft <= 1 ? '#dc2626' : daysLeft <= 3 ? '#d97706' : '#16a34a' }}>
                        {daysLeft === 0 ? '⚡ اليوم' : daysLeft === 1 ? '⚠️ غداً' : `${daysLeft} أيام`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Outstanding Balances */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <span>💳</span> {t('outstandingBalances')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {stats.outstandingOrders.length === 0 ? (
            <div className="p-4 text-center text-sm" style={{ color: '#8B7355' }}>{t('noOutstanding')}</div>
          ) : (
            <div className="divide-y divide-amber-100/50">
              {stats.outstandingOrders.map(order => (
                <div key={order.id} className="p-4 flex items-center justify-between hover:bg-amber-50/50 cursor-pointer" onClick={() => navigate('/orders')}>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{order.customerName}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#8B7355' }}>{order.deliveryDate}</p>
                  </div>
                  <div className="text-left flex-shrink-0 mr-3">
                    <p className="text-xs" style={{ color: '#8B7355' }}>{t('total')}: {order.total.toFixed(3)} {t('omr')}</p>
                    <p className="font-bold text-sm" style={{ color: '#dc2626' }}>
                      {t('remaining')}: {(order.total - order.deposit).toFixed(3)} {t('omr')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expense Breakdown Mini */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">{t('expenseBreakdown')}</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.categoryBreakdown.slice(0, 5).map(cat => (
              <div key={cat.category}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{t(cat.category as any)}</span>
                  <span className="font-bold">{cat.amount.toFixed(2)} {t('omr')} ({cat.percentage}%)</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: '#F5E6C8' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${cat.percentage}%`, background: 'linear-gradient(90deg, #E5A53C, #D4932A)' }} />
                </div>
              </div>
            ))}
            {stats.categoryBreakdown.length === 0 && (
              <p className="text-center text-sm" style={{ color: '#8B7355' }}>{t('noExpenses')}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
