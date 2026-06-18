import { useState, useEffect, useMemo } from 'react';
import { t } from '@/lib/i18n';
import { OrderDB, DishDB, CustomerDB, type Order, type OrderItem, type Customer } from '@/lib/hybrid-db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [dishes, setDishes] = useState<{ id: string; name: string; nameEn?: string; price: number; cost: number }[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Form state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [area, setArea] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [orderType, setOrderType] = useState<'regular' | 'advance'>('regular');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [deliveryTime, setDeliveryTime] = useState('');
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [tablewareFee, setTablewareFee] = useState(0);
  const [deposit, setDeposit] = useState(0);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'pending' | 'completed' | 'cancelled'>('pending');
  const [showDishPicker, setShowDishPicker] = useState(false);
  const [manualDishName, setManualDishName] = useState('');
  const [manualDishPrice, setManualDishPrice] = useState('');
  const [saveForFuture, setSaveForFuture] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ords, dshs, custs] = await Promise.all([OrderDB.getAll(), DishDB.getAll(), CustomerDB.getAll()]);
      setOrders(ords);
      setDishes(dshs);
      setCustomers(custs);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setCustomerName(''); setCustomerPhone(''); setArea('');
    setCustomerSearch(''); setShowCustomerList(false);
    setOrderDate(new Date().toISOString().split('T')[0]);
    setDeliveryDate(new Date().toISOString().split('T')[0]);
    setOrderType('regular'); setItems([]); setDeliveryTime(''); setDeliveryFee(0); setTablewareFee(0);
    setDeposit(0); setNotes(''); setStatus('pending'); setEditingOrder(null);
  };

  const handleEdit = (order: Order) => {
    setEditingOrder(order);
    setCustomerName(order.customerName);
    setCustomerPhone(order.customerPhone);
    setArea(order.area);
    setOrderDate(order.orderDate);
    setDeliveryDate(order.deliveryDate);
    setOrderType(order.type);
    setDeliveryTime(order.deliveryTime || '');
    setItems([...order.items]);
    setDeliveryFee(order.deliveryFee);
    setTablewareFee(order.tablewareFee || 0);
    setDeposit(order.deposit);
    setNotes(order.notes);
    setStatus(order.status);
    setShowForm(true);
  };

  const handleSave = async (andNew = false) => {
    if (!customerName.trim() || items.length === 0) {
      alert(t('fillRequired'));
      return;
    }
    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const total = subtotal + deliveryFee + (tablewareFee || 0);

    const orderData = {
      customerName: customerName.trim(), customerPhone: customerPhone.trim(),
      area: area.trim(), orderDate, deliveryDate,
      deliveryTime: orderType === 'advance' ? (deliveryTime || undefined) : undefined,
      type: orderType,
      items: [...items], deliveryFee, tablewareFee, deposit: orderType === 'advance' ? deposit : 0,
      total, status, notes: notes.trim(),
    };

    try {
      if (editingOrder) {
        await OrderDB.update(editingOrder.id, orderData);
      } else {
        await OrderDB.add(orderData);
      }

      // حفظ/تحديث بيانات الزبون تلقائياً عند كل طلب
      if (customerName.trim()) {
        const allCustomers = await CustomerDB.getAll();
        const existing = allCustomers.find(c =>
          c.name === customerName.trim() ||
          (customerPhone.trim() && c.phone === customerPhone.trim())
        );
        if (existing) {
          // تحديث بياناته بأحدث معلومة
          await CustomerDB.update(existing.id, {
            name: customerName.trim(),
            phone: customerPhone.trim() || existing.phone,
            area: area.trim() || existing.area,
          });
        } else {
          // زبون جديد — أضفه تلقائياً
          await CustomerDB.add({
            name: customerName.trim(),
            phone: customerPhone.trim(),
            area: area.trim(),
            notes: '',
          });
        }
      }

      await loadData();
      if (andNew) { resetForm(); } else { resetForm(); setShowForm(false); }
    } catch (e: any) {
      console.error(e);
      alert(`⚠️ فشل الحفظ!\n${e?.message || 'خطأ غير معروف'}\n\nتأكد من تشغيل migrations قاعدة البيانات.`);
    }
  };

  // يُحسب مرة واحدة عند تغيّر الطلبات — O(n log n) بدل O(n² log n)
  const orderNumMap = useMemo(() => {
    const sorted = [...orders].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const map = new Map<string, number>();
    sorted.forEach((o, i) => map.set(o.id, i + 1));
    return map;
  }, [orders]);

  const getOrderNum = (order: Order) => orderNumMap.get(order.id) ?? 0;

  const shareWhatsApp = (order: Order) => {
    const num = getOrderNum(order);
    const balance = order.total - order.deposit;
    const lines = [
      `🍽️ *دل باستا* — طلب رقم #${num}`,
      '━━━━━━━━━━━━━━',
      `👤 *العميل:* ${order.customerName}`,
      order.area ? `📍 *المنطقة:* ${order.area}` : '',
      `📅 *تاريخ التسليم:* ${order.deliveryDate}`,
      '━━━━━━━━━━━━━━',
      '*الأصناف:*',
      ...order.items.map(i => `• ${i.dishName} x${i.quantity} — ${(i.price * i.quantity).toFixed(3)} ر.ع`),
      '━━━━━━━━━━━━━━',
      `*الإجمالي:* ${order.total.toFixed(3)} ر.ع`,
      order.deposit > 0 ? `*العربون المدفوع:* ${order.deposit.toFixed(3)} ر.ع` : '',
      order.deposit > 0 ? `*المتبقي:* ${balance.toFixed(3)} ر.ع` : '',
      order.notes ? `\n📝 ${order.notes}` : '',
    ].filter(Boolean).join('\n');
    const phone = order.customerPhone?.replace(/\D/g, '');
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(lines)}`
      : `https://wa.me/?text=${encodeURIComponent(lines)}`;
    window.open(url, '_blank');
  };

  const printCustomerReceipt = (order: Order) => {
    const num = getOrderNum(order);
    const balance = order.total - order.deposit;
    const fmt = (n: number) => n.toFixed(3);
    const itemRows = order.items.map(i => `
      <div class="item-name">${i.dishName}</div>
      <div class="item-calc">
        <span class="unit-price">${fmt(i.price)} ر.ع</span>
        <span class="multiply"> × ${i.quantity} = </span>
        <span class="total-price">${fmt(i.price * i.quantity)} ر.ع</span>
      </div>
      <div class="divider"></div>
    `).join('');
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>فاتورة #${num}</title>
<style>
@page{margin:3mm}
*{box-sizing:border-box;margin:0;padding:0;color:#000!important;background:none!important}
html,body{width:100%;font-family:Arial,sans-serif;font-size:11px}
.logo{font-size:18px;font-weight:900;text-align:center;letter-spacing:2px}
.sub-logo{font-size:11px;text-align:center;margin-bottom:3px}
.order-num{font-size:13px;font-weight:900;text-align:center;border:2px solid #000;padding:3px;margin:4px 0}
.dash{border:none;border-top:1px dashed #000;margin:4px 0}
.solid{border:none;border-top:2px solid #000;margin:5px 0}
.customer-name{font-size:13px;font-weight:900;margin:2px 0}
.info{font-size:10px;margin:1px 0}
.item-name{font-size:12px;font-weight:900;margin-top:4px}
.item-calc{font-size:11px;margin:1px 0 3px;display:flex;justify-content:space-between}
.unit-price{color:#000}
.multiply{color:#000}
.total-price{font-weight:900}
.divider{border-top:1px dotted #000;margin:2px 0}
.row{display:flex;justify-content:space-between;font-size:12px;padding:2px 0}
.row-grand{display:flex;justify-content:space-between;font-size:14px;font-weight:900;padding:3px 0;border-top:2px solid #000;border-bottom:2px solid #000;margin:3px 0}
.row-balance{display:flex;justify-content:space-between;font-size:12px;font-weight:900;padding:2px 0;text-decoration:underline}
.footer{text-align:center;font-size:10px;margin-top:6px}
</style></head>
<body>
<div class="logo">Del Pasta</div>
<div class="sub-logo">مشروع منزلي · صحار</div>
<div class="sub-logo">90942558</div>
<div class="order-num">طلب رقم  #${num}</div>
<hr class="dash">
<div class="customer-name">${order.customerName}</div>
${order.customerPhone ? `<div class="info">${order.customerPhone}</div>` : ''}
${order.area ? `<div class="info">${order.area}</div>` : ''}
<div class="info">التسليم: <b>${order.deliveryDate}</b></div>
<hr class="dash">
${itemRows}
<hr class="solid">
${order.deliveryFee > 0 ? `<div class="row"><span>توصيل</span><span>${fmt(order.deliveryFee)} ر.ع</span></div>` : ''}
${(order.tablewareFee || 0) > 0 ? `<div class="row"><span>🍽️ أواني</span><span>${fmt(order.tablewareFee!)} ر.ع</span></div>` : ''}
<div class="row-grand"><span>الإجمالي</span><span>${fmt(order.total)} ر.ع</span></div>
${order.deposit > 0 ? `
<div class="row"><span>العربون المدفوع</span><span>- ${fmt(order.deposit)} ر.ع</span></div>
<div class="row-balance"><span>المبلغ المتبقي</span><span>${fmt(balance)} ر.ع</span></div>` : ''}
${order.notes ? `<hr class="dash"><div class="info">ملاحظة: ${order.notes}</div>` : ''}
<hr class="dash">
<div class="footer">شكراً لكم 🤍</div>
<div class="footer" style="font-size:9px;margin-top:2px">أكل متروس لذة من 2018</div>
<script>window.onload=()=>{window.print();window.addEventListener('afterprint',()=>window.close());}</script>
</body></html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  const printKitchenTicket = (order: Order) => {
    const num = getOrderNum(order);
    const itemRows = order.items.map(i => `
      <tr>
        <td class="td-item">${i.dishNameEn || i.dishName}${i.dishNameEn ? `<div class="td-ar">${i.dishName}</div>` : ''}</td>
        <td class="td-qty">x${i.quantity}</td>
      </tr>
    `).join('');
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Kitchen #${num}</title>
<style>
@page{margin:3mm}
*{box-sizing:border-box;margin:0;padding:0;color:#000!important;background:none!important}
html,body{width:100%;font-family:Arial,sans-serif;font-size:11px}
.header{text-align:center;font-size:9px;font-weight:bold;letter-spacing:2px;margin-bottom:2px}
.order-box{border:3px solid #000;text-align:center;padding:4px;margin:3px 0}
.order-box .label{font-size:10px;font-weight:900;letter-spacing:2px}
.order-box .num{font-size:36px;font-weight:900;line-height:1}
.dash{border:none;border-top:1px dashed #000;margin:4px 0}
.solid{border:none;border-top:2px solid #000;margin:4px 0}
.info{font-size:12px;font-weight:900;margin:2px 0}
.info-sub{font-size:10px;margin:1px 0}
table{width:100%;border-collapse:collapse}
.td-item{font-size:14px;font-weight:900;padding:4px 0 2px}
.td-ar{font-size:9px;font-weight:normal;margin-top:1px}
.td-qty{font-size:18px;font-weight:900;text-align:right;vertical-align:middle;white-space:nowrap}
tr{border-bottom:1px dashed #000}
.footer{text-align:center;font-size:9px;letter-spacing:2px;margin-top:6px}
</style></head>
<body>
<div class="header">-- KITCHEN TICKET --</div>
<div class="order-box">
  <div class="label">ORDER</div>
  <div class="num">#${num}</div>
</div>
<hr class="dash">
<div class="info">${order.customerName}</div>
${order.area ? `<div class="info-sub">${order.area}</div>` : ''}
<div class="info-sub">Delivery: <b>${order.deliveryDate}</b></div>
<hr class="solid">
<table>${itemRows}</table>
${order.notes ? `<hr class="dash"><div class="info-sub"><b>Notes:</b> ${order.notes}</div>` : ''}
<hr class="dash">
<div class="footer">DAL PASTA KITCHEN</div>
<script>window.onload=()=>{window.print();window.addEventListener('afterprint',()=>window.close());}</script>
</body></html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  const previewReceipt = (order: Order) => {
    const num = getOrderNum(order);
    const balance = order.total - order.deposit;
    const fmt = (n: number) => n.toFixed(3);
    const itemRows = order.items.map(i => `
      <div class="item">
        <div class="item-name">${i.dishName}</div>
        <div class="item-row">
          <span class="item-price">${fmt(i.price)} ر.ع × ${i.quantity}</span>
          <span class="item-total">${fmt(i.price * i.quantity)} ر.ع</span>
        </div>
      </div>`).join('');
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>فاتورة #${num}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#F5E6C8;min-height:100vh;display:flex;justify-content:center;padding:20px;font-family:Arial,sans-serif}
  .card{background:#fff;border-radius:20px;width:100%;max-width:360px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.15)}
  .header{background:linear-gradient(135deg,#E5A53C,#D4932A);padding:24px 20px;text-align:center;color:#fff}
  .logo{font-size:26px;font-weight:900;letter-spacing:2px}
  .sub{font-size:12px;opacity:0.85;margin-top:2px}
  .order-badge{background:rgba(255,255,255,0.25);border-radius:30px;padding:6px 18px;margin-top:10px;display:inline-block;font-size:15px;font-weight:900;letter-spacing:1px}
  .body{padding:20px}
  .customer-box{background:#FFF9F0;border-radius:12px;padding:12px 14px;margin-bottom:16px;border:1px solid #F5E6C8}
  .customer-name{font-size:17px;font-weight:900;color:#2C1810}
  .customer-info{font-size:12px;color:#8B7355;margin-top:3px}
  .section-label{font-size:11px;font-weight:700;color:#E5A53C;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}
  .item{margin-bottom:10px;padding-bottom:10px;border-bottom:1px dashed #F0E0C0}
  .item:last-child{border-bottom:none;margin-bottom:0;padding-bottom:0}
  .item-name{font-size:14px;font-weight:700;color:#2C1810}
  .item-row{display:flex;justify-content:space-between;margin-top:3px}
  .item-price{font-size:12px;color:#8B7355}
  .item-total{font-size:13px;font-weight:700;color:#2C1810}
  .totals{margin-top:16px;border-top:2px solid #F5E6C8;padding-top:14px}
  .row{display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px;color:#5C4A35}
  .row-total{display:flex;justify-content:space-between;background:#FFF0D0;border-radius:10px;padding:10px 14px;margin-top:8px}
  .row-total span:first-child{font-size:15px;font-weight:700;color:#2C1810}
  .row-total span:last-child{font-size:18px;font-weight:900;color:#D4932A}
  .row-balance{display:flex;justify-content:space-between;background:#FEE2E2;border-radius:10px;padding:10px 14px;margin-top:6px}
  .row-balance span:first-child{font-size:14px;font-weight:700;color:#7F1D1D}
  .row-balance span:last-child{font-size:16px;font-weight:900;color:#DC2626}
  .notes{background:#FFFBEB;border-radius:10px;padding:10px 14px;margin-top:14px;font-size:12px;color:#7C6845;border:1px solid #FDE68A}
  .footer{text-align:center;padding:16px;background:#FFF9F0;border-top:1px solid #F5E6C8}
  .footer-main{font-size:14px;font-weight:700;color:#8B7355}
  .footer-sub{font-size:11px;color:#A08B6D;margin-top:2px}
</style></head>
<body>
<div class="card">
  <div class="header">
    <div class="logo">Del Pasta</div>
    <div class="sub">مشروع منزلي · صحار · 90942558</div>
    <div class="order-badge">طلب #${num}</div>
  </div>
  <div class="body">
    <div class="customer-box">
      <div class="customer-name">${order.customerName}</div>
      <div class="customer-info">
        ${order.customerPhone ? `📞 ${order.customerPhone}` : ''}
        ${order.area ? `&nbsp;&nbsp;📍 ${order.area}` : ''}
        <br>📅 التسليم: <b>${order.deliveryDate}</b>
        ${order.deliveryTime ? `&nbsp; ⏰ ${order.deliveryTime}` : ''}
      </div>
    </div>
    <div class="section-label">الأصناف</div>
    ${itemRows}
    <div class="totals">
      ${order.deliveryFee > 0 ? `<div class="row"><span>🚗 رسوم التوصيل</span><span>${fmt(order.deliveryFee)} ر.ع</span></div>` : ''}
      ${(order.tablewareFee || 0) > 0 ? `<div class="row"><span>🍽️ رسوم الأواني</span><span>${fmt(order.tablewareFee!)} ر.ع</span></div>` : ''}
      <div class="row-total"><span>الإجمالي</span><span>${fmt(order.total)} ر.ع</span></div>
      ${order.deposit > 0 ? `
      <div class="row" style="margin-top:8px"><span>✅ العربون المدفوع</span><span style="color:#16a34a;font-weight:700">- ${fmt(order.deposit)} ر.ع</span></div>
      <div class="row-balance"><span>المبلغ المتبقي</span><span>${fmt(balance)} ر.ع</span></div>` : ''}
    </div>
    ${order.notes ? `<div class="notes">📝 ${order.notes}</div>` : ''}
  </div>
  <div class="footer">
    <div class="footer-main">شكراً لكم 🤍</div>
    <div class="footer-sub">أكل متروس لذة من 2018</div>
  </div>
</div>
</body></html>`;
    const win = window.open('', '_blank', 'width=420,height=700');
    if (win) { win.document.write(html); win.document.close(); }
  };

  const handleDelete = async (id: string) => {
    try { await OrderDB.delete(id); setDeleteDialog(null); await loadData(); } catch (e: any) { alert(`⚠️ فشل الحذف!\n${e?.message || 'خطأ غير معروف'}`); }
  };

  const addDishItem = (dish: { name: string; nameEn?: string; price: number; cost: number }) => {
    setItems(prev => {
      const existing = prev.find(i => i.dishName === dish.name);
      if (existing) {
        return prev.map(i => i.dishName === dish.name ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { dishName: dish.name, dishNameEn: dish.nameEn, quantity: 1, price: dish.price, cost: dish.cost }];
    });
    setShowDishPicker(false);
  };

  const addManualDish = async () => {
    const name = manualDishName.trim();
    const price = parseFloat(manualDishPrice) || 0;
    if (!name || price <= 0) return;
    if (saveForFuture) {
      const saved = await DishDB.add({ name, price, cost: 0 });
      setDishes(prev => [...prev, saved]);
    }
    addDishItem({ name, price, cost: 0 });
    setManualDishName('');
    setManualDishPrice('');
    setSaveForFuture(false);
  };

  const updateItemQty = (index: number, delta: number) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      return { ...item, quantity: Math.max(1, item.quantity + delta) };
    }));
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const grandTotal = subtotal + deliveryFee + tablewareFee;

  const filteredOrders = useMemo(() => orders.filter(o => {
    const matchStatus = filterStatus === 'all' || o.status === filterStatus;
    const matchSearch = !searchQuery ||
      o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customerPhone.includes(searchQuery);
    return matchStatus && matchSearch;
  }), [orders, filterStatus, searchQuery]);

  if (loading && orders.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: '#E5A53C', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="flex items-center justify-between">
        <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-2" style={{ background: '#E5A53C' }}>
          <span>+</span> {t('newOrder')}
        </Button>
        <div className="flex gap-2">
          <Input placeholder={t('search')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-32 lg:w-48 text-sm" />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="text-sm rounded-lg border border-input px-3 py-2 bg-background">
            <option value="all">{t('all')}</option>
            <option value="pending">{t('pending')}</option>
            <option value="completed">{t('completed')}</option>
            <option value="cancelled">{t('cancelled')}</option>
          </select>
        </div>
      </div>

      {showForm && (
        <Card className="animate-fadeIn">
          <CardHeader><CardTitle className="text-base">{editingOrder ? t('editOrder') : t('newOrder')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Label className="text-xs">{t('customerName')} *</Label>
                <Input value={customerName}
                  onChange={e => { setCustomerName(e.target.value); setCustomerSearch(e.target.value); setShowCustomerList(e.target.value.length > 0); }}
                  onBlur={() => setTimeout(() => setShowCustomerList(false), 200)}
                  className="mt-1" placeholder="اكتب أو اختر زبون" />
                {showCustomerList && customerSearch.length > 0 && (
                  <div className="absolute z-50 w-full bg-white border rounded-lg shadow-lg max-h-48 overflow-auto mt-1">
                    {customers.filter(c => c.name.includes(customerSearch) || c.phone.includes(customerSearch)).map(c => (
                      <button key={c.id} type="button"
                        onClick={() => { setCustomerName(c.name); setCustomerPhone(c.phone); setArea(c.area || ''); setShowCustomerList(false); setCustomerSearch(''); }}
                        className="w-full text-right px-3 py-2 hover:bg-amber-50 text-sm border-b last:border-0">
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs" style={{ color: '#8B7355' }}>
                          {c.phone && <span>{c.phone}</span>}
                          {c.area && <span> · 📍 {c.area}</span>}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div><Label className="text-xs">{t('customerPhone')}</Label><Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="mt-1" type="tel" /></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><Label className="text-xs">{t('area')}</Label><Input value={area} onChange={e => setArea(e.target.value)} className="mt-1" /></div>
              <div><Label className="text-xs">{t('orderDate')}</Label><Input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} className="mt-1" /></div>
              <div><Label className="text-xs">{t('deliveryDate')}</Label><Input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} className="mt-1" /></div>
            </div>

            {orderType === 'advance' && (
              <div className="p-3 rounded-lg" style={{ background: '#fef3c7', border: '1px solid #fbbf24' }}>
                <Label className="text-xs font-bold" style={{ color: '#92400e' }}>⏰ {t('deliveryTime')} (للحجز المسبق)</Label>
                <Input type="time" value={deliveryTime} onChange={e => setDeliveryTime(e.target.value)} className="mt-1 w-40" />
                {deliveryTime && <p className="text-xs mt-1" style={{ color: '#92400e' }}>التسليم: {deliveryDate} الساعة {deliveryTime}</p>}
              </div>
            )}

            <div>
              <Label className="text-xs">{t('orderType')}</Label>
              <div className="flex gap-3 mt-1">
                {(['regular', 'advance'] as const).map(type => (
                  <button key={type} onClick={() => setOrderType(type)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${orderType === type ? 'text-amber-950' : 'text-muted-foreground hover:bg-muted'}`}
                    style={orderType === type ? { background: '#E5A53C' } : {}}>
                    {t(type === 'regular' ? 'regularOrder' : 'advanceBooking')}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs">{t('items')} *</Label>
                <Button variant="outline" size="sm" onClick={() => setShowDishPicker(true)} className="gap-1 text-xs">+ {t('addItem')}</Button>
              </div>
              {items.length > 0 && (
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: '#FFF5E6' }}>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{item.dishName}</p>
                        <p className="text-xs" style={{ color: '#8B7355' }}>{item.price.toFixed(2)} {t('omr')} x {item.quantity}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateItemQty(idx, -1)} className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: '#F5E6C8' }}>-</button>
                        <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                        <button onClick={() => updateItemQty(idx, 1)} className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: '#F5E6C8' }}>+</button>
                      </div>
                      <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 p-1">✕</button>
                    </div>
                  ))}
                </div>
              )}
              {items.length === 0 && <p className="text-sm text-center py-4" style={{ color: '#8B7355' }}>No items added</p>}
            </div>

            <Dialog open={showDishPicker} onOpenChange={open => { setShowDishPicker(open); if (!open) { setManualDishName(''); setManualDishPrice(''); setSaveForFuture(false); } }}>
              <DialogContent>
                <DialogHeader><DialogTitle>إضافة صنف</DialogTitle></DialogHeader>
                <div className="space-y-3">

                  {/* بحث / اسم الصنف */}
                  <Input
                    placeholder="🔍 ابحث أو اكتب اسم صنف جديد..."
                    value={manualDishName}
                    onChange={e => setManualDishName(e.target.value)}
                    autoFocus
                  />

                  {/* قائمة الأصناف المحفوظة — مفلترة */}
                  {dishes.length > 0 && (() => {
                    const filtered = dishes.filter(d =>
                      !manualDishName || d.name.includes(manualDishName) || (d.nameEn || '').toLowerCase().includes(manualDishName.toLowerCase())
                    );
                    return filtered.length > 0 ? (
                      <div className="grid grid-cols-1 gap-1 max-h-52 overflow-auto rounded-lg border border-amber-100">
                        {filtered.map(dish => (
                          <button key={dish.id} onClick={() => addDishItem(dish)}
                            className="flex items-center justify-between px-3 py-2.5 hover:bg-amber-50 transition-colors text-right border-b border-amber-50 last:border-0">
                            <span className="text-sm font-bold" style={{ color: '#E5A53C' }}>{dish.price.toFixed(3)} ر.ع</span>
                            <div className="text-right">
                              <span className="font-medium text-sm">{dish.name}</span>
                              {dish.nameEn && <span className="text-xs block" style={{ color: '#8B7355' }}>{dish.nameEn}</span>}
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : null;
                  })()}

                  {/* صنف جديد — يظهر فقط لو في اسم مكتوب ومو موجود في القائمة */}
                  {manualDishName && !dishes.some(d => d.name === manualDishName) && (
                    <div className="space-y-2 pt-1 border-t border-dashed border-amber-200">
                      <p className="text-xs" style={{ color: '#8B7355' }}>صنف جديد — أضف السعر:</p>
                      <div className="flex gap-2">
                        <Input placeholder="السعر ر.ع" type="number" step="0.001" min="0" value={manualDishPrice} onChange={e => setManualDishPrice(e.target.value)} className="flex-1" />
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer whitespace-nowrap">
                          <input type="checkbox" checked={saveForFuture} onChange={e => setSaveForFuture(e.target.checked)} />
                          احفظه
                        </label>
                      </div>
                      <Button onClick={addManualDish} className="w-full" style={{ background: '#E5A53C' }}
                        disabled={!manualDishPrice}>
                        + إضافة "{manualDishName}"
                      </Button>
                    </div>
                  )}

                </div>
              </DialogContent>
            </Dialog>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div><Label className="text-xs">{t('deliveryFee')}</Label><Input type="number" step="0.1" min="0" value={deliveryFee} onChange={e => setDeliveryFee(parseFloat(e.target.value) || 0)} className="mt-1" /></div>
              <div>
                <Label className="text-xs">🍽️ {t('tablewareFee')}</Label>
                <Input type="number" step="0.1" min="0" value={tablewareFee} onChange={e => setTablewareFee(parseFloat(e.target.value) || 0)} className="mt-1" />
              </div>
              {orderType === 'advance' && (
                <div><Label className="text-xs">{t('depositAmount')}</Label><Input type="number" step="0.1" min="0" value={deposit} onChange={e => setDeposit(parseFloat(e.target.value) || 0)} className="mt-1" /></div>
              )}
              <div><Label className="text-xs">{t('status')}</Label>
                <select value={status} onChange={e => setStatus(e.target.value as any)} className="w-full mt-1 text-sm rounded-lg border border-input px-3 py-2 bg-background">
                  <option value="pending">{t('pending')}</option>
                  <option value="completed">{t('completed')}</option>
                  <option value="cancelled">{t('cancelled')}</option>
                </select>
              </div>
            </div>

            <div className="p-3 rounded-lg space-y-1" style={{ background: '#F5E6C8' }}>
              <div className="flex justify-between text-sm"><span>{t('subtotal')}</span><span>{subtotal.toFixed(2)} {t('omr')}</span></div>
              <div className="flex justify-between text-sm"><span>{t('deliveryFee')}</span><span>{deliveryFee.toFixed(2)} {t('omr')}</span></div>
              {tablewareFee > 0 && <div className="flex justify-between text-sm"><span>🍽️ {t('tablewareFee')}</span><span>{tablewareFee.toFixed(2)} {t('omr')}</span></div>}
              {orderType === 'advance' && <div className="flex justify-between text-sm"><span>{t('depositPaid')}</span><span>{deposit.toFixed(2)} {t('omr')}</span></div>}
              <div className="flex justify-between font-bold text-base pt-1 border-t border-amber-300/50">
                <span>{t('grandTotal')}</span>
                <span style={{ color: '#E5A53C' }}>{grandTotal.toFixed(2)} {t('omr')}</span>
              </div>
              {orderType === 'advance' && (
                <div className="flex justify-between text-sm" style={{ color: '#8B6914' }}>
                  <span>{t('balanceDue')}</span><span>{(grandTotal - deposit).toFixed(2)} {t('omr')}</span>
                </div>
              )}
            </div>

            <div><Label className="text-xs">{t('notes')}</Label><Input value={notes} onChange={e => setNotes(e.target.value)} className="mt-1" /></div>

            <div className="flex gap-2">
              <Button onClick={() => handleSave(false)} className="flex-1" style={{ background: '#E5A53C' }}>{t('save')}</Button>
              <Button onClick={() => handleSave(true)} variant="outline" className="flex-1">{t('saveAndNew')}</Button>
              <Button onClick={() => { resetForm(); setShowForm(false); }} variant="ghost">{t('cancel')}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {filteredOrders.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-sm" style={{ color: '#8B7355' }}>{t('noOrders')}</CardContent></Card>
        ) : (
          filteredOrders.map(order => (
            <Card key={order.id} className="overflow-hidden transition-all hover:shadow-md">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: '#F5E6C8', color: '#8B6914' }}>#{getOrderNum(order)}</span>
                      <p className="font-bold text-sm">{order.customerName}</p>
                      {order.type === 'advance' && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: '#fef3c7', color: '#92400e' }}>{t('deposit')}</span>}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        order.status === 'completed' ? 'bg-green-100 text-green-700' : order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                      }`}>{t(order.status)}</span>
                    </div>
                    <p className="text-xs mt-1" style={{ color: '#8B7355' }}>{order.items.map(i => `${i.dishName} x${i.quantity}`).join(', ')}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#A08B6D' }}>
                      {order.area} · {order.deliveryDate}
                      {order.type === 'advance' && order.deliveryTime && <span className="font-bold" style={{ color: '#d97706' }}> ⏰ {order.deliveryTime}</span>}
                      {order.customerPhone && ` · ${order.customerPhone}`}
                    </p>
                  </div>
                  <div className="text-right ml-2">
                    <p className="font-bold text-sm" style={{ color: '#2C1810' }}>{order.total.toFixed(2)} {t('omr')}</p>
                    {order.type === 'advance' && <p className="text-[10px]" style={{ color: '#8B6914' }}>{t('deposit')}: {order.deposit.toFixed(2)}</p>}
                  </div>
                </div>
                <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: '1px solid rgba(229,165,60,0.15)' }}>
                  <button onClick={() => handleEdit(order)} className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors hover:bg-amber-100" style={{ color: '#8B6914' }}>{t('edit')}</button>
                  <button onClick={() => setDeleteDialog(order.id)} className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors hover:bg-red-50 text-red-500">{t('delete')}</button>
                  <button onClick={() => shareWhatsApp(order)} className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors hover:bg-green-50 text-green-600">📲 {t('shareWhatsapp')}</button>
                  <button onClick={() => previewReceipt(order)} className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors hover:bg-amber-50" style={{ color: '#D4932A', border: '1px solid #E5A53C' }}>👁️ معاينة</button>
                  <button onClick={() => printCustomerReceipt(order)} className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors hover:bg-amber-50" style={{ color: '#8B6914' }}>🧾 {t('customerReceipt')}</button>
                  <button onClick={() => printKitchenTicket(order)} className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors hover:bg-blue-50 text-blue-600">🍳 {t('kitchenTicket')}</button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('delete')}</DialogTitle></DialogHeader>
          <p className="text-sm" style={{ color: '#8B7355' }}>{t('resetConfirm')}</p>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>{t('no')}</Button>
            <Button variant="destructive" onClick={() => deleteDialog && handleDelete(deleteDialog)}>{t('yes')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
