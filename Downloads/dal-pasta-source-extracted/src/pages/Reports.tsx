import { useState, useEffect } from 'react';
import { t } from '@/lib/i18n';
import { ReportDB, type MonthlyData } from '@/lib/hybrid-db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const DAY_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316'];

function getDayName(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return DAY_NAMES[new Date(y, m - 1, d).getDay()];
}
function getDayColor(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return DAY_COLORS[new Date(y, m - 1, d).getDay()];
}

export default function Reports() {
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [stats, setStats] = useState({ income: 0, expenses: 0, expensesTotal: 0, purchasesTotal: 0, profit: 0, orders: 0, avgOrder: 0, profitMargin: 0, deliveryFees: 0, tablewareFees: 0 });
  const [categoryBreakdown, setCategoryBreakdown] = useState<{ category: string; amount: number; percentage: number }[]>([]);
  const [topDishes, setTopDishes] = useState<{ name: string; count: number; revenue: number }[]>([]);
  const [dailyBreakdown, setDailyBreakdown] = useState<{ date: string; orders: number; income: number }[]>([]);
  const [topCustomers, setTopCustomers] = useState<{ name: string; orders: number; revenue: number }[]>([]);
  const [loading, setLoading] = useState(true);

  // تحميل البيانات الأولية (المخطط الشهري فقط)
  useEffect(() => {
    const loadBase = async () => {
      setLoading(true);
      try {
        const data = await ReportDB.getMonthlyData();
        setMonthlyData(data);
        // اختر آخر شهر فيه بيانات إذا كان الشهر الحالي فارغاً
        if (data.length > 0) {
          const last = data[data.length - 1].month;
          setSelectedMonth(last);
        }
      } catch (e) {}
      setLoading(false);
    };
    loadBase();
  }, []);

  // تحميل بيانات الشهر المختار — مستقل عن loading
  useEffect(() => {
    const loadMonthStats = async () => {
      try {
        const [monthStats, catBreakdown, daily, customers, dishes] = await Promise.all([
          ReportDB.getThisMonthStats(selectedMonth),
          ReportDB.getCategoryBreakdown(selectedMonth),
          ReportDB.getDailyBreakdown(selectedMonth),
          ReportDB.getTopCustomers(selectedMonth),
          ReportDB.getTopDishes(),
        ]);
        const profit = monthStats.income - monthStats.expenses;
        setStats({
          income: monthStats.income, expenses: monthStats.expenses,
          expensesTotal: monthStats.expensesTotal || 0,
          purchasesTotal: monthStats.purchasesTotal || 0,
          profit,
          orders: monthStats.orders, avgOrder: monthStats.avgOrder,
          profitMargin: monthStats.income > 0 ? (profit / monthStats.income) * 100 : 0,
          deliveryFees: monthStats.deliveryFees || 0,
          tablewareFees: monthStats.tablewareFees || 0,
        });
        setCategoryBreakdown(catBreakdown);
        setDailyBreakdown(daily);
        setTopCustomers(customers);
        setTopDishes(dishes);
      } catch (e) {
        console.error('Reports stats error:', e);
      }
    };
    loadMonthStats();
  }, [selectedMonth]);

  const expenseRatio = stats.income > 0 ? (stats.expenses / stats.income) * 100 : 0;
  const maxVal = Math.max(...monthlyData.map((d: MonthlyData) => Math.max(d.income, d.expenses)), 1);
  const maxDaily = Math.max(...dailyBreakdown.map(d => d.income), 1);

  // يوم الأسبوع الأكثر مبيعاً
  const dayTotals: Record<string, { income: number; count: number }> = {};
  dailyBreakdown.forEach(d => {
    const name = getDayName(d.date);
    if (!dayTotals[name]) dayTotals[name] = { income: 0, count: 0 };
    dayTotals[name].income += d.income;
    dayTotals[name].count += d.orders;
  });
  const bestDay = Object.entries(dayTotals).sort((a, b) => b[1].income - a[1].income)[0];

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: '#E5A53C', borderTopColor: 'transparent' }} /></div>;
  }

  return (
    <div className="space-y-6 animate-fadeIn">

      {/* Month Selector — موحد للكل */}
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-base" style={{ color: '#2C1810' }}>📅 {selectedMonth}</h2>
        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          className="text-sm rounded-lg border border-input px-3 py-2 bg-background font-medium"
          style={{ color: '#E5A53C', borderColor: '#E5A53C' }}
        >
          {monthlyData.map(d => (
            <option key={d.month} value={d.month}>{d.month}</option>
          ))}
        </select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-xs font-medium" style={{ color: '#8B7355' }}>{t('income')}</p>
          <p className="text-lg font-bold mt-1" style={{ color: '#16a34a' }}>{stats.income.toFixed(2)} {t('omr')}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs font-medium" style={{ color: '#8B7355' }}>{t('expenses')}</p>
          <p className="text-lg font-bold mt-1" style={{ color: '#dc2626' }}>{stats.expenses.toFixed(2)} {t('omr')}</p>
          {stats.purchasesTotal > 0 && (
            <div className="mt-1.5 space-y-0.5">
              <p className="text-[10px]" style={{ color: '#8B7355' }}>🧾 تشغيلية: {stats.expensesTotal.toFixed(2)}</p>
              <p className="text-[10px]" style={{ color: '#8B7355' }}>📦 مشتريات: {stats.purchasesTotal.toFixed(2)}</p>
            </div>
          )}
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs font-medium" style={{ color: '#8B7355' }}>{t('profit')}</p>
          <p className="text-lg font-bold mt-1" style={{ color: stats.profit >= 0 ? '#16a34a' : '#dc2626' }}>{stats.profit.toFixed(2)} {t('omr')}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs font-medium" style={{ color: '#8B7355' }}>{t('avgOrder')}</p>
          <p className="text-lg font-bold mt-1" style={{ color: '#2563eb' }}>{stats.avgOrder.toFixed(2)} {t('omr')}</p>
        </CardContent></Card>
      </div>

      {expenseRatio > 70 && (
        <div className={`rounded-xl p-4 ${expenseRatio > 80 ? 'animate-pulse-warn' : ''}`} style={{ background: expenseRatio > 80 ? '#fee2e2' : '#fef3c7', border: `1px solid ${expenseRatio > 80 ? '#f87171' : '#fbbf24'}` }}>
          <div className="flex items-center gap-2"><span>⚠️</span><p className="font-bold text-sm" style={{ color: expenseRatio > 80 ? '#991b1b' : '#92400e' }}>{expenseRatio > 80 ? t('warning80') : t('warning70')}</p></div>
          <p className="text-xs mt-1" style={{ color: expenseRatio > 80 ? '#b91c1c' : '#a16207' }}>{t('expenseRatio')}: {expenseRatio.toFixed(1)}%</p>
        </div>
      )}

      {/* Delivery & Tableware Fees */}
      <div className="grid grid-cols-2 gap-3">
        <Card style={{ border: '1px solid #fbbf24' }}>
          <CardContent className="p-3">
            <p className="text-xs font-medium" style={{ color: '#8B7355' }}>🚗 رسوم التوصيل</p>
            <p className="text-xl font-bold mt-1" style={{ color: '#d97706' }}>{stats.deliveryFees.toFixed(2)} {t('omr')}</p>
            {stats.orders > 0 && <p className="text-[10px] mt-0.5" style={{ color: '#a16207' }}>معدل: {(stats.deliveryFees / stats.orders).toFixed(2)} / طلب</p>}
          </CardContent>
        </Card>
        <Card style={{ border: '1px solid #a78bfa' }}>
          <CardContent className="p-3">
            <p className="text-xs font-medium" style={{ color: '#8B7355' }}>🍽️ رسوم الأواني</p>
            <p className="text-xl font-bold mt-1" style={{ color: '#7c3aed' }}>{stats.tablewareFees.toFixed(2)} {t('omr')}</p>
            {stats.orders > 0 && <p className="text-[10px] mt-0.5" style={{ color: '#6d28d9' }}>معدل: {(stats.tablewareFees / stats.orders).toFixed(2)} / طلب</p>}
          </CardContent>
        </Card>
      </div>

      {/* Profit Margin */}
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

      {/* ======== DAILY BREAKDOWN ======== */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">📆 المبيعات اليومية</CardTitle>
            {bestDay && (
              <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: '#fef3c7', color: '#92400e' }}>
                🏆 {bestDay[0]}: {bestDay[1].income.toFixed(2)} ر.ع
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {dailyBreakdown.length === 0 ? (
            <p className="text-center text-sm py-4" style={{ color: '#8B7355' }}>لا توجد طلبات مكتملة في هذا الشهر</p>
          ) : (
            <div className="space-y-2">
              {dailyBreakdown.map(day => {
                const dayName = getDayName(day.date);
                const color = getDayColor(day.date);
                const pct = (day.income / maxDaily) * 100;
                const shortDate = day.date.substring(8); // DD
                return (
                  <div key={day.date} className="flex items-center gap-2">
                    <div className="w-16 text-right flex-shrink-0">
                      <p className="text-[10px] font-bold" style={{ color }}>{dayName}</p>
                      <p className="text-[10px]" style={{ color: '#A08B6D' }}>{shortDate}/{day.date.substring(5,7)}</p>
                    </div>
                    <div className="flex-1 h-6 rounded-full overflow-hidden" style={{ background: '#F5E6C8' }}>
                      <div className="h-full rounded-full flex items-center px-2 transition-all"
                        style={{ width: `${Math.max(pct, 4)}%`, background: `linear-gradient(90deg, ${color}cc, ${color})` }}>
                      </div>
                    </div>
                    <div className="w-24 text-left flex-shrink-0">
                      <p className="text-xs font-bold" style={{ color: '#2C1810' }}>{day.income.toFixed(2)} ر.ع</p>
                      <p className="text-[10px]" style={{ color: '#8B7355' }}>{day.orders} طلب</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {/* ملخص أيام الأسبوع */}
          {Object.keys(dayTotals).length > 0 && (
            <div className="mt-4 pt-3" style={{ borderTop: '1px solid rgba(229,165,60,0.2)' }}>
              <p className="text-xs font-bold mb-2" style={{ color: '#8B7355' }}>📊 مجموع حسب يوم الأسبوع</p>
              <div className="space-y-1">
                {Object.entries(dayTotals).sort((a, b) => b[1].income - a[1].income).map(([day, data]) => (
                  <div key={day} className="flex justify-between text-xs">
                    <span className="font-medium">{day}</span>
                    <span style={{ color: '#E5A53C' }}>{data.income.toFixed(2)} ر.ع ({data.count} طلب)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Trend */}
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
                  <p className="text-[10px] mt-1" style={{ color: '#d97706' }}>🚗 {(data.deliveryFees || 0).toFixed(2)} {t('omr')}</p>
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

      {/* Category Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('byCategory')}</CardTitle>
        </CardHeader>
        <CardContent>
          {categoryBreakdown.length === 0 ? (
            <p className="text-center text-sm py-4" style={{ color: '#8B7355' }}>{t('noExpenses')}</p>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-medium pb-1" style={{ color: '#8B7355' }}>
                {t('expenses')} {selectedMonth}: {categoryBreakdown.reduce((s, c) => s + c.amount, 0).toFixed(2)} {t('omr')}
              </p>
              {categoryBreakdown.map(cat => (
                <div key={cat.category}>
                  <div className="flex justify-between text-sm mb-1"><span className="font-medium">{t(cat.category as any)}</span><span className="font-bold">{cat.amount.toFixed(2)} {t('omr')} ({cat.percentage}%)</span></div>
                  <div className="h-2.5 rounded-full overflow-hidden" style={{ background: '#F5E6C8' }}><div className="h-full rounded-full transition-all" style={{ width: `${cat.percentage}%`, background: 'linear-gradient(90deg, #E5A53C, #D4932A)' }} /></div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Customers */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">👑 أكثر الزبائن طلباً</CardTitle></CardHeader>
        <CardContent>
          {topCustomers.length === 0 ? (
            <p className="text-center text-sm py-4" style={{ color: '#8B7355' }}>لا توجد بيانات</p>
          ) : (
            <div className="space-y-3">
              {topCustomers.map((c, idx) => {
                const maxRev = topCustomers[0].revenue;
                const pct = (c.revenue / maxRev) * 100;
                const medals = ['🥇', '🥈', '🥉'];
                return (
                  <div key={c.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium flex items-center gap-1">
                        <span>{medals[idx] || `${idx + 1}.`}</span>
                        <span>{c.name}</span>
                      </span>
                      <span className="text-xs" style={{ color: '#8B7355' }}>
                        {c.orders} طلب · <span className="font-bold" style={{ color: '#E5A53C' }}>{c.revenue.toFixed(2)} ر.ع</span>
                      </span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: '#F5E6C8' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: idx === 0 ? 'linear-gradient(90deg, #f59e0b, #d97706)' : 'linear-gradient(90deg, #E5A53C, #D4932A)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Dishes */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{t('topDishes')}</CardTitle></CardHeader>
        <CardContent>
          {topDishes.length === 0 ? (<p className="text-center text-sm py-4" style={{ color: '#8B7355' }}>No data</p>) : (
            <div className="space-y-2">
              {topDishes.map((dish, idx) => (
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
