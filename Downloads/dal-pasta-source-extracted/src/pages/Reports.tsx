import { useState, useEffect } from 'react';
import { t } from '@/lib/i18n';
import { ReportDB, type MonthlyData } from '@/lib/hybrid-db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Reports() {
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [stats, setStats] = useState({ income: 0, expenses: 0, profit: 0, orders: 0, avgOrder: 0, profitMargin: 0, deliveryFees: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [data, thisMonth] = await Promise.all([ReportDB.getMonthlyData(), ReportDB.getThisMonthStats()]);
      setMonthlyData(data);
      const profit = thisMonth.income - thisMonth.expenses;
      setStats({
        income: thisMonth.income, expenses: thisMonth.expenses, profit,
        orders: thisMonth.orders, avgOrder: thisMonth.avgOrder,
        profitMargin: thisMonth.income > 0 ? (profit / thisMonth.income) * 100 : 0,
        deliveryFees: thisMonth.deliveryFees || 0,
      });
    } catch (e) {}
    setLoading(false);
  };



  const expenseRatio = stats.income > 0 ? (stats.expenses / stats.income) * 100 : 0;
  const maxVal = Math.max(...monthlyData.map((d: MonthlyData) => Math.max(d.income, d.expenses)), 1);

  // Load category breakdown and top dishes after initial render or month change
  useEffect(() => {
    if (!loading) {
      ReportDB.getCategoryBreakdown(selectedMonth).then(setCategoryBreakdownDynamic);
      ReportDB.getTopDishes().then(setTopDishesDynamic);
    }
  }, [loading, selectedMonth]);

  const [categoryBreakdownDynamic, setCategoryBreakdownDynamic] = useState<{ category: string; amount: number; percentage: number }[]>([]);
  const [topDishesDynamic, setTopDishesDynamic] = useState<{ name: string; count: number; revenue: number }[]>([]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: '#E5A53C', borderTopColor: 'transparent' }} /></div>;
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: t('income'), value: `${stats.income.toFixed(2)} ${t('omr')}`, color: '#16a34a', bg: '#dcfce7' },
          { label: t('expenses'), value: `${stats.expenses.toFixed(2)} ${t('omr')}`, color: '#dc2626', bg: '#fee2e2' },
          { label: t('profit'), value: `${stats.profit.toFixed(2)} ${t('omr')}`, color: stats.profit >= 0 ? '#16a34a' : '#dc2626', bg: stats.profit >= 0 ? '#dcfce7' : '#fee2e2' },
          { label: t('avgOrder'), value: `${stats.avgOrder.toFixed(2)} ${t('omr')}`, color: '#2563eb', bg: '#dbeafe' },
        ].map(card => (
          <Card key={card.label}><CardContent className="p-4">
            <p className="text-xs font-medium" style={{ color: '#8B7355' }}>{card.label}</p>
            <p className="text-lg font-bold mt-1" style={{ color: card.color }}>{card.value}</p>
          </CardContent></Card>
        ))}
      </div>

      {/* Delivery Fees Card */}
      <Card style={{ border: '1px solid #fbbf24' }}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium" style={{ color: '#8B7355' }}>🚗 رسوم التوصيل — الشهر الحالي</p>
              <p className="text-2xl font-bold mt-1" style={{ color: '#d97706' }}>{stats.deliveryFees.toFixed(2)} {t('omr')}</p>
            </div>
            <div className="text-right text-xs" style={{ color: '#8B7355' }}>
              <p>من {stats.orders} طلب مكتمل</p>
              {stats.orders > 0 && <p className="mt-1">معدل/طلب: {(stats.deliveryFees / stats.orders).toFixed(2)} {t('omr')}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {expenseRatio > 70 && (
        <div className={`rounded-xl p-4 ${expenseRatio > 80 ? 'animate-pulse-warn' : ''}`} style={{ background: expenseRatio > 80 ? '#fee2e2' : '#fef3c7', border: `1px solid ${expenseRatio > 80 ? '#f87171' : '#fbbf24'}` }}>
          <div className="flex items-center gap-2"><span>⚠️</span><p className="font-bold text-sm" style={{ color: expenseRatio > 80 ? '#991b1b' : '#92400e' }}>{expenseRatio > 80 ? t('warning80') : t('warning70')}</p></div>
          <p className="text-xs mt-1" style={{ color: expenseRatio > 80 ? '#b91c1c' : '#a16207' }}>{t('expenseRatio')}: {expenseRatio.toFixed(1)}%</p>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{t('profitMargin')}</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20">
              <svg viewBox="0 0 36 36" className="w-full h-full">
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#F5E6C8" strokeWidth="3" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={stats.profitMargin >= 30 ? '#16a34a' : stats.profitMargin >= 15 ? '#E5A53C' : '#dc2626'} strokeWidth="3" strokeDasharray={`${Math.max(0, stats.profitMargin)}, 100`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center"><span className="text-xs font-bold">{stats.profitMargin.toFixed(0)}%</span></div>
            </div>
            <div>
              <p className="text-sm" style={{ color: '#8B7355' }}>{t('orderCount')}: {stats.orders}</p>
              <p className="text-sm" style={{ color: '#8B7355' }}>{t('vsLastMonth')}: {monthlyData.length >= 2 ? `${(((monthlyData[monthlyData.length - 1]?.income || 0) - (monthlyData[monthlyData.length - 2]?.income || 0)) / Math.max(1, monthlyData[monthlyData.length - 2]?.income || 1) * 100).toFixed(0)}%` : 'N/A'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{t('monthlyTrend')}</CardTitle></CardHeader>
        <CardContent>
          {monthlyData.length === 0 ? (<p className="text-center text-sm py-4" style={{ color: '#8B7355' }}>No data available</p>) : (
            <div className="space-y-4">
              {monthlyData.slice(-6).map((data: MonthlyData) => (
                <div key={data.month}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium">{data.month}</span>
                    <span style={{ color: '#8B7355' }}>{data.orders} {t('orders')}</span>
                  </div>
                  <div className="flex gap-1 h-5">
                    <div className="h-full rounded-l-md transition-all relative group" style={{ width: `${(data.income / maxVal) * 100}%`, background: 'linear-gradient(90deg, #16a34a, #22c55e)' }}>
                      <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 text-[10px] bg-black text-white px-1.5 py-0.5 rounded whitespace-nowrap transition-opacity">{t('income')}: {data.income.toFixed(1)}</div>
                    </div>
                    <div className="h-full transition-all relative group" style={{ width: `${(data.expenses / maxVal) * 100}%`, background: 'linear-gradient(90deg, #dc2626, #ef4444)' }}>
                      <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 text-[10px] bg-black text-white px-1.5 py-0.5 rounded whitespace-nowrap transition-opacity">{t('expenses')}: {data.expenses.toFixed(1)}</div>
                    </div>
                    <div className="h-full rounded-r-md transition-all relative group" style={{ width: `${((data.deliveryFees || 0) / maxVal) * 100}%`, background: 'linear-gradient(90deg, #d97706, #f59e0b)' }}>
                      <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 text-[10px] bg-black text-white px-1.5 py-0.5 rounded whitespace-nowrap transition-opacity">🚗 توصيل: {(data.deliveryFees || 0).toFixed(1)}</div>
                    </div>
                  </div>
                  <p className="text-[10px] mt-1" style={{ color: '#d97706' }}>
                    🚗 {(data.deliveryFees || 0).toFixed(2)} {t('omr')}
                  </p>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-4 mt-4 justify-center flex-wrap">
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded" style={{ background: '#16a34a' }} /><span className="text-xs">{t('income')}</span></div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded" style={{ background: '#dc2626' }} /><span className="text-xs">{t('expenses')}</span></div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded" style={{ background: '#d97706' }} /><span className="text-xs">🚗 توصيل</span></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">{t('byCategory')}</CardTitle>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="text-xs rounded-lg border border-input px-2 py-1.5 bg-background"
            >
              {monthlyData.map(d => (
                <option key={d.month} value={d.month}>{d.month}</option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {categoryBreakdownDynamic.length === 0 ? (
            <p className="text-center text-sm py-4" style={{ color: '#8B7355' }}>{t('noExpenses')}</p>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-medium pb-1" style={{ color: '#8B7355' }}>
                {t('expenses')} {selectedMonth}: {categoryBreakdownDynamic.reduce((s, c) => s + c.amount, 0).toFixed(2)} {t('omr')}
              </p>
              {categoryBreakdownDynamic.map(cat => (
                <div key={cat.category}>
                  <div className="flex justify-between text-sm mb-1"><span className="font-medium">{t(cat.category as any)}</span><span className="font-bold">{cat.amount.toFixed(2)} {t('omr')} ({cat.percentage}%)</span></div>
                  <div className="h-2.5 rounded-full overflow-hidden" style={{ background: '#F5E6C8' }}><div className="h-full rounded-full transition-all" style={{ width: `${cat.percentage}%`, background: 'linear-gradient(90deg, #E5A53C, #D4932A)' }} /></div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{t('topDishes')}</CardTitle></CardHeader>
        <CardContent>
          {topDishesDynamic.length === 0 ? (<p className="text-center text-sm py-4" style={{ color: '#8B7355' }}>No data</p>) : (
            <div className="space-y-2">
              {topDishesDynamic.map((dish, idx) => (
                <div key={dish.name} className="flex items-center gap-3">
                  <span className="text-xs font-bold w-5 text-center" style={{ color: '#8B7355' }}>{idx + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm"><span className="font-medium">{dish.name}</span><span className="font-bold" style={{ color: '#E5A53C' }}>{dish.revenue.toFixed(2)} {t('omr')}</span></div>
                    <p className="text-xs" style={{ color: '#8B7355' }}>{dish.count} {t('orders')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
