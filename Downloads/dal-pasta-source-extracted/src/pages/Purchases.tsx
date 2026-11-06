import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { t } from '@/lib/i18n';
import { PurchaseDB, ProductDB, ReceiptDB, SettingsDB, type Purchase } from '@/lib/hybrid-db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const UNITS = ['kg', 'gram', 'liter', 'piece', 'box', 'pack', 'bottle', 'jar', 'bundle', 'bag'];
const PURCHASE_CATEGORIES = ['vegetables','vegshop','groceries','packaging','cleaning','operational','maintenance','development','electricity','water','gas','fuel','salary','workers','courier','advertising','other'];

export default function Purchases() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [knownSuppliers, setKnownSuppliers] = useState<string[]>([]);
  const [knownProducts, setKnownProducts] = useState<string[]>([]);

  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('kg');
  const [unitPrice, setUnitPrice] = useState('');
  const [purchCurrency, setPurchCurrency] = useState<'OMR' | 'AED'>('OMR');
  const [category, setCategory] = useState('');
  const [supplier, setSupplier] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [receipt, setReceipt] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);

  const location = useLocation();
  useEffect(() => { loadPurchases(); }, [location.key]);

  const loadPurchases = async () => {
    setLoading(true);
    try {
      const [allPurchases, allProducts] = await Promise.all([PurchaseDB.getAll(), ProductDB.getAll()]);
      setPurchases(allPurchases);
      const suppliers = [...new Set([
        ...allPurchases.map(p => p.supplier),
        ...allProducts.map(p => p.supplier),
      ].filter(Boolean))];
      const products = [...new Set([
        ...allPurchases.map(p => p.productName),
        ...allProducts.map(p => p.name),
      ].filter(Boolean))];
      setKnownSuppliers(suppliers);
      setKnownProducts(products);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const resetForm = () => {
    setProductName(''); setQuantity(''); setUnit('kg'); setUnitPrice(''); setPurchCurrency('OMR');
    setCategory(''); setSupplier(''); setDate(new Date().toISOString().split('T')[0]); setReceipt(null);
    setEditingPurchase(null); setEditingPurchaseId(null);
  };

  // سعر القطعة تلقائي من تاريخ الشراء
  const handleProductNameChange = (name: string) => {
    setProductName(name);
    if (!editingPurchase) {
      const match = purchases
        .filter(p => p.productName.toLowerCase() === name.toLowerCase())
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      if (match) {
        setUnitPrice(match.unitPrice.toString());
        setUnit(match.unit);
        if (!supplier) setSupplier(match.supplier);
        if (!category) setCategory(match.category || 'other');
      }
    }
  };

  // التعديل يفتح مكانه في البطاقة
  const handleEdit = (purchase: Purchase) => {
    setEditingPurchase(purchase);
    setEditingPurchaseId(purchase.id);
    setProductName(purchase.productName);
    setQuantity(purchase.quantity.toString());
    setUnit(purchase.unit);
    setUnitPrice(purchase.unitPrice.toString());
    setSupplier(purchase.supplier);
    setCategory(purchase.category || 'other');
    setDate(purchase.date);
    setReceipt(purchase.receipt);
    setPurchCurrency('OMR');
    setShowForm(false);
  };

  const handleSave = async (andNew = false) => {
    if (!productName.trim() || !quantity || !unitPrice || !category) { alert(t('fillRequired')); return; }
    const aedRate = SettingsDB.get().aedRate || 0.105;
    const qty = parseFloat(quantity);
    const rawPrice = parseFloat(unitPrice);
    const price = purchCurrency === 'AED' ? rawPrice * aedRate : rawPrice;
    const purchaseData = { productName: productName.trim(), quantity: qty, unit, unitPrice: price, total: qty * price, supplier: supplier.trim(), date, category, receipt };
    try {
      if (editingPurchase) { await PurchaseDB.update(editingPurchase.id, purchaseData); } else { await PurchaseDB.add(purchaseData); }
      await loadPurchases();
      if (andNew) { resetForm(); } else { resetForm(); setShowForm(false); }
    } catch (e: any) {
      console.error(e);
      alert(`⚠️ فشل الحفظ!\n${e?.message || 'خطأ غير معروف'}`);
    }
  };

  const handleDelete = async (id: string) => {
    const purchase = await PurchaseDB.getById(id);
    if (purchase?.receipt) ReceiptDB.delete(purchase.receipt);
    try { await PurchaseDB.delete(id); setDeleteDialog(null); await loadPurchases(); } catch (e: any) { alert(`⚠️ فشل الحذف!\n${e?.message || 'خطأ غير معروف'}`); }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { const id = `receipt_${Date.now()}`; ReceiptDB.save(id, reader.result as string); setReceipt(id); };
    reader.readAsDataURL(file);
  };

  const viewReceipt = (receiptId: string | null) => { if (!receiptId) return; const data = ReceiptDB.get(receiptId); if (data) setReceiptPreview(data); };
  const aedRate = SettingsDB.get().aedRate || 0.105;
  const rawUnitPrice = parseFloat(unitPrice) || 0;
  const unitPriceOMR = purchCurrency === 'AED' ? rawUnitPrice * aedRate : rawUnitPrice;
  const total = (parseFloat(quantity) || 0) * unitPriceOMR;

  // نموذج التعديل/الإضافة (يُعرض في مكانه)
  const renderForm = (isInline = false) => (
    <div className="space-y-4">
      {isInline && (
        <p className="text-xs font-semibold" style={{ color: '#E5A53C' }}>✏️ تعديل: {editingPurchase?.productName}</p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">{t('productName')} *</Label>
          <Input list="products-list" value={productName} onChange={e => handleProductNameChange(e.target.value)} className="mt-1" />
          <datalist id="products-list">{knownProducts.map(p => <option key={p} value={p} />)}</datalist>
        </div>
        <div><Label className="text-xs">{t('category')} *</Label>
          <select value={category} onChange={e => setCategory(e.target.value)} className={`w-full mt-1 text-sm rounded-lg border px-3 py-2 bg-background ${!category ? 'border-amber-400' : 'border-input'}`}>
            <option value="" disabled>-- اختر الفئة --</option>
            {PURCHASE_CATEGORIES.map(cat => <option key={cat} value={cat}>{t(cat as any)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div><Label className="text-xs">{t('quantity')} *</Label><Input type="number" step="0.01" min="0" value={quantity} onChange={e => setQuantity(e.target.value)} className="mt-1" /></div>
        <div><Label className="text-xs">{t('unit')}</Label>
          <select value={unit} onChange={e => setUnit(e.target.value)} className="w-full mt-1 text-sm rounded-lg border border-input px-3 py-2 bg-background">{UNITS.map(u => <option key={u} value={u}>{t(u as any)}</option>)}</select>
        </div>
        <div>
          <Label className="text-xs">{t('unitPrice')} *</Label>
          <div className="flex gap-1 mt-1">
            <Input type="number" step="0.01" min="0" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} className="flex-1" />
            <div className="flex rounded-lg border border-input overflow-hidden text-xs font-medium">
              <button type="button" onClick={() => setPurchCurrency('OMR')} className="px-2 py-1 transition-colors" style={purchCurrency === 'OMR' ? { background: '#E5A53C', color: '#fff' } : { color: '#8B7355' }}>ر.ع</button>
              <button type="button" onClick={() => setPurchCurrency('AED')} className="px-2 py-1 transition-colors" style={purchCurrency === 'AED' ? { background: '#3ECF8E', color: '#fff' } : { color: '#8B7355' }}>د.إ</button>
            </div>
          </div>
          {purchCurrency === 'AED' && unitPrice && parseFloat(unitPrice) > 0 && (
            <p className="text-xs mt-1" style={{ color: '#3ECF8E' }}>≈ {(parseFloat(unitPrice) * (SettingsDB.get().aedRate || 0.105)).toFixed(3)} ر.ع / {t(unit as any)}</p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">{t('supplier')}</Label>
          <Input list="suppliers-list" value={supplier} onChange={e => setSupplier(e.target.value)} className="mt-1" />
          <datalist id="suppliers-list">{knownSuppliers.map(s => <option key={s} value={s} />)}</datalist>
        </div>
        <div><Label className="text-xs">{t('date')}</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1" /></div>
      </div>
      <div>
        <Label className="text-xs">{t('receipt')}</Label>
        <div className="flex gap-2 mt-1">
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1 text-xs">📷 {t('uploadImage')}</Button>
          {receipt && <Button type="button" variant="ghost" size="sm" onClick={() => viewReceipt(receipt)} className="text-xs gap-1">👁 {t('viewReceipt')}</Button>}
        </div>
        {receipt && <p className="text-xs mt-1" style={{ color: '#16a34a' }}>✓ {t('receiptAttached')}</p>}
      </div>
      <div className="p-3 rounded-lg" style={{ background: '#F5E6C8' }}>
        <div className="flex justify-between font-bold text-sm"><span>{t('total')}</span><span style={{ color: '#E5A53C' }}>{total.toFixed(3)} {t('omr')}</span></div>
      </div>
      <div className="flex gap-2">
        <Button onClick={() => handleSave(false)} className="flex-1" style={{ background: '#16a34a' }}>{t('save')}</Button>
        {!isInline && <Button onClick={() => handleSave(true)} variant="outline" className="flex-1">{t('saveAndNew')}</Button>}
        <Button onClick={() => { resetForm(); if (!isInline) setShowForm(false); }} variant="ghost">{t('cancel')}</Button>
      </div>
    </div>
  );

  if (loading && purchases.length === 0) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: '#E5A53C', borderTopColor: 'transparent' }} /></div>;
  }

  // الأحدث إدخالًا أولًا، حتى يظهر ما اعتُمد للتو مهما كان تاريخ فاتورته
  const filteredPurchases = purchases.filter(p =>
    p.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.supplier.toLowerCase().includes(searchQuery.toLowerCase())
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.date.localeCompare(a.date));

  const compareResults = searchQuery.trim().length > 1 ? (() => {
    const matched = purchases.filter(p => p.productName.toLowerCase().includes(searchQuery.toLowerCase()));
    const bySupplier: Record<string, { prices: number[]; supplier: string }> = {};
    matched.forEach(p => {
      if (!bySupplier[p.supplier]) bySupplier[p.supplier] = { prices: [], supplier: p.supplier };
      bySupplier[p.supplier].prices.push(p.unitPrice);
    });
    return Object.values(bySupplier).map(s => ({
      supplier: s.supplier,
      min: Math.min(...s.prices),
      max: Math.max(...s.prices),
      avg: s.prices.reduce((a, b) => a + b, 0) / s.prices.length,
      count: s.prices.length,
    })).sort((a, b) => a.avg - b.avg);
  })() : [];

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="flex items-center justify-between gap-2">
        <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-2" style={{ background: '#16a34a' }}><span>+</span> {t('newPurchase')}</Button>
        <Input placeholder="🔍 ابحث أو قارن سعر مورد..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="flex-1" />
      </div>

      {compareResults.length > 1 && (
        <Card className="border-amber-200">
          <CardHeader className="pb-2"><CardTitle className="text-sm">مقارنة الأسعار — {searchQuery}</CardTitle></CardHeader>
          <CardContent className="p-3 space-y-2">
            {compareResults.map((r, i) => (
              <div key={r.supplier} className="flex items-center justify-between p-2 rounded-lg text-sm" style={{ background: i === 0 ? '#F0FFF4' : '#FFF9F0', border: i === 0 ? '1px solid #86efac' : '1px solid #fde68a' }}>
                <div>
                  <span className="font-medium">{r.supplier || 'بدون مورد'}</span>
                  {i === 0 && <span className="mr-2 text-xs text-green-600 font-bold">✓ الأرخص</span>}
                  <p className="text-xs text-gray-400">{r.count} عملية شراء</p>
                </div>
                <div className="text-left">
                  <p className="font-bold" style={{ color: i === 0 ? '#16a34a' : '#E5A53C' }}>{r.avg.toFixed(3)} ر.ع متوسط</p>
                  <p className="text-xs text-gray-400">{r.min.toFixed(3)} – {r.max.toFixed(3)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* نموذج إضافة جديد - يظهر فوق فقط للإضافة الجديدة */}
      {showForm && (
        <Card className="animate-fadeIn">
          <CardHeader><CardTitle className="text-base">{t('newPurchase')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">{renderForm(false)}</CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {purchases.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-sm" style={{ color: '#8B7355' }}>{searchQuery ? 'لا توجد نتائج' : t('noPurchases')}</CardContent></Card>
        ) : (
          filteredPurchases.map(purchase => (
            <Card key={purchase.id} className="overflow-hidden transition-all hover:shadow-md" style={editingPurchaseId === purchase.id ? { border: '2px solid #E5A53C' } : {}}>
              <CardContent className="p-4">
                {editingPurchaseId === purchase.id ? (
                  // نموذج التعديل في مكانه
                  renderForm(true)
                ) : (
                  <>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm">{purchase.productName}</p>
                          {purchase.category && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: '#F5E6C8', color: '#8B6914' }}>{t(purchase.category as any)}</span>}
                          {purchase.receipt && <button onClick={() => viewReceipt(purchase.receipt)} className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">📎 {t('receipt')}</button>}
                        </div>
                        <p className="text-xs mt-1" style={{ color: '#8B7355' }}>{purchase.quantity} {t(purchase.unit as any)} × {purchase.unitPrice.toFixed(3)} {t('omr')}</p>
                        <p className="text-xs" style={{ color: '#A08B6D' }}>{purchase.supplier} · {purchase.date}</p>
                      </div>
                      <div className="text-right"><p className="font-bold text-sm" style={{ color: '#16a34a' }}>{purchase.total.toFixed(3)} {t('omr')}</p></div>
                    </div>
                    <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: '1px solid rgba(229,165,60,0.15)' }}>
                      <button onClick={() => handleEdit(purchase)} className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors hover:bg-amber-100" style={{ color: '#8B6914' }}>{t('edit')}</button>
                      <button onClick={() => setDeleteDialog(purchase.id)} className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors hover:bg-red-50 text-red-500">{t('delete')}</button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={!!receiptPreview} onOpenChange={() => setReceiptPreview(null)}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>{t('receipt')}</DialogTitle></DialogHeader>{receiptPreview && <img src={receiptPreview} alt="Receipt" className="w-full rounded-lg" />}</DialogContent>
      </Dialog>

      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent><DialogHeader><DialogTitle>{t('delete')}</DialogTitle></DialogHeader>
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
