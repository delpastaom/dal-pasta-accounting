import { useState, useRef } from 'react';
import { PurchaseDB } from '@/lib/hybrid-db';
import { t } from '@/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const CATEGORIES = ['vegetables','vegshop','groceries','packaging','cleaning','operational','maintenance','development','electricity','water','gas','fuel','salary','workers','courier','advertising','other'];
const UNITS = ['kg','gram','liter','piece','box','pack','bottle','jar','bundle','bag'];
const PENDING_KEY = 'ai_pending_invoices';
const API_KEY_STORAGE = 'anthropic_api_key';

type InvoiceStatus = 'ready' | 'review' | 'duplicate';

interface PendingInvoice {
  id: string;
  imageBase64: string;
  status: InvoiceStatus;
  issues: string[];
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  supplier: string;
  date: string;
  category: string;
  createdAt: string;
}

function getPending(): PendingInvoice[] {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); } catch { return []; }
}
function savePending(list: PendingInvoice[]) {
  localStorage.setItem(PENDING_KEY, JSON.stringify(list));
}

export default function AIInvoice() {
  const [apiKey, setApiKey] = useState(localStorage.getItem(API_KEY_STORAGE) || '');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [pending, setPending] = useState<PendingInvoice[]>(getPending());
  const [processing, setProcessing] = useState(false);
  const [reviewing, setReviewing] = useState<PendingInvoice | null>(null);
  const [error, setError] = useState('');
  const [pastingText, setPastingText] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const saveApiKey = () => {
    localStorage.setItem(API_KEY_STORAGE, apiKeyInput.trim());
    setApiKey(apiKeyInput.trim());
  };

  const callClaude = async (messages: object[]) => {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1024, messages }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'خطأ في API');
    }
    const data = await response.json();
    return data.content[0].text as string;
  };

  const extractPrompt = `استخرج بيانات الفاتورة وأعطني JSON فقط بدون أي نص آخر:
{
  "productName": "اسم المنتج أو الصنف الرئيسي",
  "quantity": 1,
  "unit": "kg أو piece أو liter أو box أو pack",
  "unitPrice": 0.000,
  "total": 0.000,
  "supplier": "اسم المورد أو المحل",
  "date": "YYYY-MM-DD",
  "category": "vegetables أو groceries أو packaging أو cleaning أو operational أو other",
  "issues": []
}
إذا أي خانة غير واضحة اكتب "" للنصوص و0 للأرقام وأضفها في issues.`;

  const processInvoiceData = async (parsed: Record<string, unknown>, imageBase64: string) => {
    const issues: string[] = [...((parsed.issues as string[]) || [])];

    const qty = (parsed.quantity as number) || 0;
    const price = (parsed.unitPrice as number) || 0;
    const total = (parsed.total as number) || 0;
    const calcTotal = qty * price;
    if (total > 0 && calcTotal > 0 && Math.abs(calcTotal - total) / total > 0.02) {
      issues.push(`الإجمالي المحسوب ${calcTotal.toFixed(3)} لا يساوي الإجمالي المقروء ${total.toFixed(3)}`);
    }
    if (!parsed.supplier) issues.push('المورد غير موجود في الفاتورة');
    if (!parsed.date || parsed.date === 'YYYY-MM-DD') issues.push('التاريخ غير واضح');
    if (!parsed.productName) issues.push('اسم المنتج غير واضح');

    const allPurchases = await PurchaseDB.getAll();
    const similar = allPurchases.filter(p =>
      p.productName?.toLowerCase().includes(((parsed.productName as string) || '').toLowerCase().slice(0, 4)) &&
      (parsed.productName as string)?.length > 3
    );
    if (similar.length > 0 && price > 0) {
      const lastPrice = similar[similar.length - 1].unitPrice;
      if (lastPrice > 0) {
        const change = Math.abs(price - lastPrice) / lastPrice;
        if (change > 0.15) issues.push(`تغير السعر ${(change * 100).toFixed(0)}٪ عن آخر شراء (${lastPrice.toFixed(3)} ر.ع)`);
      }
    }

    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const isDuplicate = allPurchases.some(p => {
      const pDate = new Date(p.date);
      return p.supplier === parsed.supplier && Math.abs(p.total - total) < 0.01 && pDate > sevenDaysAgo;
    });

    let status: InvoiceStatus = 'ready';
    if (isDuplicate) status = 'duplicate';
    else if (issues.length > 0) status = 'review';

    const invoice: PendingInvoice = {
      id: `inv_${Date.now()}`,
      imageBase64,
      status,
      issues,
      productName: (parsed.productName as string) || '',
      quantity: qty,
      unit: (parsed.unit as string) || 'piece',
      unitPrice: price,
      total: total || calcTotal,
      supplier: (parsed.supplier as string) || '',
      date: (parsed.date && parsed.date !== 'YYYY-MM-DD') ? (parsed.date as string) : new Date().toISOString().split('T')[0],
      category: (parsed.category as string) || 'other',
      createdAt: new Date().toISOString(),
    };

    const updated = [invoice, ...getPending()];
    savePending(updated);
    setPending(updated);
  };

  const handleImage = async (file: File) => {
    setProcessing(true); setError('');
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res((reader.result as string).split(',')[1]);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      const mediaType = (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp';
      const text = await callClaude([{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: extractPrompt },
        ],
      }]);
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('تعذر قراءة الفاتورة، حاولي مرة أخرى');
      await processInvoiceData(JSON.parse(match[0]), `data:${mediaType};base64,${base64}`);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'خطأ غير معروف'); }
    setProcessing(false);
  };

  const handlePastedText = async () => {
    if (!pastedText.trim()) return;
    setProcessing(true); setError('');
    try {
      const text = await callClaude([{ role: 'user', content: `${extractPrompt}\n\nنص الفاتورة:\n${pastedText}` }]);
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('تعذر التحليل');
      await processInvoiceData(JSON.parse(match[0]), '');
      setPastedText(''); setPastingText(false);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'خطأ'); }
    setProcessing(false);
  };

  const handleApprove = async (inv: PendingInvoice) => {
    try {
      await PurchaseDB.add({
        productName: inv.productName, quantity: inv.quantity, unit: inv.unit,
        unitPrice: inv.unitPrice, total: inv.total, supplier: inv.supplier,
        date: inv.date, category: inv.category, receipt: null,
      });
      const updated = getPending().filter(p => p.id !== inv.id);
      savePending(updated); setPending(updated); setReviewing(null);
    } catch (e: unknown) { alert('فشل الحفظ: ' + (e instanceof Error ? e.message : '')); }
  };

  const handleReject = (id: string) => {
    const updated = getPending().filter(p => p.id !== id);
    savePending(updated); setPending(updated); setReviewing(null);
  };

  const upd = (field: keyof PendingInvoice, value: unknown) => {
    if (reviewing) setReviewing({ ...reviewing, [field]: value });
  };

  if (!apiKey) {
    return (
      <div className="space-y-4 animate-fadeIn max-w-md mx-auto">
        <Card>
          <CardHeader><CardTitle className="text-base">🤖 مركز الفواتير الذكي</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm" style={{ color: '#8B7355' }}>
              أدخل مفتاح Anthropic API لتفعيل القراءة التلقائية للفواتير.
            </p>
            <div className="p-3 rounded-lg text-xs space-y-1" style={{ background: '#FFF5E6', border: '1px solid #F5E6C8' }}>
              <p className="font-bold" style={{ color: '#2C1810' }}>كيف تحصل على المفتاح:</p>
              <p style={{ color: '#8B7355' }}>١. افتح console.anthropic.com</p>
              <p style={{ color: '#8B7355' }}>٢. API Keys → Create Key</p>
              <p style={{ color: '#8B7355' }}>٣. اشحن رصيد بسيط (5$)</p>
            </div>
            <div>
              <Label className="text-xs">مفتاح API (يبدأ بـ sk-ant-)</Label>
              <Input type="password" value={apiKeyInput} onChange={e => setApiKeyInput(e.target.value)}
                placeholder="sk-ant-api03-..." className="mt-1 font-mono text-xs" dir="ltr" />
            </div>
            <Button onClick={saveApiKey} disabled={!apiKeyInput.startsWith('sk-ant')} style={{ background: '#E5A53C' }} className="w-full">
              حفظ وتفعيل
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const countReview = pending.filter(p => p.status === 'review').length;
  const countReady = pending.filter(p => p.status === 'ready').length;
  const countDup = pending.filter(p => p.status === 'duplicate').length;

  return (
    <div className="space-y-4 animate-fadeIn">

      {/* Stats bar */}
      {pending.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl p-3 text-center" style={{ background: '#fef3c7', border: '1px solid #fbbf24' }}>
            <p className="text-xl font-black" style={{ color: '#d97706' }}>{countReview}</p>
            <p className="text-[10px]" style={{ color: '#92400e' }}>⚠️ تحتاج مراجعة</p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: '#dcfce7', border: '1px solid #86efac' }}>
            <p className="text-xl font-black" style={{ color: '#16a34a' }}>{countReady}</p>
            <p className="text-[10px]" style={{ color: '#166534' }}>✅ جاهزة</p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: '#fee2e2', border: '1px solid #fca5a5' }}>
            <p className="text-xl font-black" style={{ color: '#dc2626' }}>{countDup}</p>
            <p className="text-[10px]" style={{ color: '#7f1d1d' }}>🔁 مكررة</p>
          </div>
        </div>
      )}

      {/* Upload card */}
      <Card>
        <CardContent className="p-5">
          <div
            className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all hover:opacity-80"
            style={{ borderColor: '#E5A53C80', background: '#FFF9F0' }}
            onClick={() => !processing && fileInputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleImage(f); }}
          >
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImage(f); if (e.target) e.target.value = ''; }} />
            {processing ? (
              <div className="space-y-3">
                <div className="w-8 h-8 border-4 rounded-full animate-spin mx-auto" style={{ borderColor: '#E5A53C', borderTopColor: 'transparent' }} />
                <p className="text-sm font-medium" style={{ color: '#8B7355' }}>يقرأ الفاتورة بالذكاء الاصطناعي...</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-4xl">📸</p>
                <p className="font-bold" style={{ color: '#2C1810' }}>صوّر أو ارفع الفاتورة</p>
                <p className="text-xs" style={{ color: '#A08B6D' }}>اسحب الصورة هنا أو اضغط للاختيار</p>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-500 mt-3 text-center bg-red-50 rounded-lg p-2">⚠️ {error}</p>}

          <div className="flex items-center gap-2 my-3">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400">أو</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <button onClick={() => setPastingText(v => !v)}
            className="w-full text-xs py-2 rounded-lg border transition-colors hover:bg-amber-50"
            style={{ color: '#8B7355', borderColor: '#E5E7EB' }}>
            📋 لصق نص الفاتورة يدوياً (احتياط)
          </button>

          {pastingText && (
            <div className="mt-3 space-y-2">
              <textarea value={pastedText} onChange={e => setPastedText(e.target.value)}
                placeholder="الصق نص الفاتورة هنا..." dir="auto"
                className="w-full h-28 text-xs p-3 rounded-lg border resize-none outline-none focus:border-amber-400"
                style={{ borderColor: '#E5A53C40' }} />
              <Button onClick={handlePastedText} disabled={!pastedText.trim() || processing} style={{ background: '#E5A53C' }} className="w-full">
                تحليل النص
              </Button>
            </div>
          )}

          <button onClick={() => { localStorage.removeItem(API_KEY_STORAGE); setApiKey(''); }}
            className="w-full text-[10px] mt-3 text-center py-1 text-gray-300 hover:text-gray-400 transition-colors">
            تغيير مفتاح API
          </button>
        </CardContent>
      </Card>

      {/* Pending list */}
      {pending.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold" style={{ color: '#2C1810' }}>الفواتير المعلقة ({pending.length})</h3>
            {countReady > 0 && (
              <button onClick={async () => {
                const readyList = pending.filter(p => p.status === 'ready');
                for (const inv of readyList) await handleApprove(inv);
              }} className="text-xs px-3 py-1.5 rounded-lg font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100">
                ✅ اعتماد الكل الجاهزة ({countReady})
              </button>
            )}
          </div>
          {pending.map(inv => (
            <Card key={inv.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {inv.imageBase64 && (
                    <img src={inv.imageBase64} className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                      style={{ border: '1px solid #F5E6C8' }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        inv.status === 'ready' ? 'bg-green-100 text-green-700' :
                        inv.status === 'duplicate' ? 'bg-red-100 text-red-600' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {inv.status === 'ready' ? '✅ جاهزة' : inv.status === 'duplicate' ? '🔁 مكررة محتملة' : '⚠️ تحتاج مراجعة'}
                      </span>
                      <p className="font-bold text-sm truncate">{inv.productName || 'بدون اسم'}</p>
                    </div>
                    <p className="text-xs" style={{ color: '#8B7355' }}>
                      {inv.supplier || '—'} · {inv.date} · <span className="font-bold">{inv.total.toFixed(3)} ر.ع</span>
                    </p>
                    {inv.issues.length > 0 && (
                      <p className="text-[10px] mt-1 truncate" style={{ color: '#d97706' }}>
                        ⚠️ {inv.issues[0]}{inv.issues.length > 1 ? ` (+${inv.issues.length - 1})` : ''}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: '1px solid rgba(229,165,60,0.15)' }}>
                  <Button size="sm" variant="outline" onClick={() => setReviewing({ ...inv })} className="text-xs flex-1">
                    مراجعة / تعديل
                  </Button>
                  {inv.status === 'ready' && (
                    <Button size="sm" onClick={() => handleApprove(inv)} className="text-xs flex-1" style={{ background: '#16a34a' }}>
                      ✅ اعتماد
                    </Button>
                  )}
                  <button onClick={() => handleReject(inv.id)}
                    className="text-xs px-3 py-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors">
                    حذف
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pending.length === 0 && !processing && (
        <div className="text-center py-8" style={{ color: '#A08B6D' }}>
          <p className="text-3xl mb-2">🧾</p>
          <p className="text-sm">لا توجد فواتير معلقة</p>
          <p className="text-xs mt-1">ارفعي فاتورة وسيتم تحليلها تلقائياً</p>
        </div>
      )}

      {/* Review modal */}
      <Dialog open={!!reviewing} onOpenChange={open => { if (!open) setReviewing(null); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-base">مراجعة الفاتورة</DialogTitle></DialogHeader>
          {reviewing && (
            <div className="space-y-4">
              {reviewing.imageBase64 && (
                <img src={reviewing.imageBase64} className="w-full rounded-xl max-h-52 object-contain"
                  style={{ background: '#F5F5F0', border: '1px solid #E5E7EB' }} />
              )}

              {reviewing.issues.length > 0 && (
                <div className="p-3 rounded-lg space-y-1" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                  <p className="text-xs font-bold mb-1" style={{ color: '#92400e' }}>نقاط تحتاج تحقق:</p>
                  {reviewing.issues.map((issue, i) => (
                    <p key={i} className="text-xs" style={{ color: '#b45309' }}>• {issue}</p>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs">اسم المنتج *</Label>
                  <Input value={reviewing.productName} onChange={e => upd('productName', e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">الكمية</Label>
                  <Input type="number" step="0.01" value={reviewing.quantity}
                    onChange={e => upd('quantity', parseFloat(e.target.value) || 0)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">الوحدة</Label>
                  <select value={reviewing.unit} onChange={e => upd('unit', e.target.value)}
                    className="w-full mt-1 text-sm rounded-lg border border-input px-3 py-2 bg-background">
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">سعر الوحدة (ر.ع)</Label>
                  <Input type="number" step="0.001" value={reviewing.unitPrice}
                    onChange={e => upd('unitPrice', parseFloat(e.target.value) || 0)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">الإجمالي (ر.ع)</Label>
                  <Input type="number" step="0.001" value={reviewing.total}
                    onChange={e => upd('total', parseFloat(e.target.value) || 0)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">المورد</Label>
                  <Input value={reviewing.supplier} onChange={e => upd('supplier', e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">التاريخ</Label>
                  <Input type="date" value={reviewing.date} onChange={e => upd('date', e.target.value)} className="mt-1" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">الفئة</Label>
                  <select value={reviewing.category} onChange={e => upd('category', e.target.value)}
                    className="w-full mt-1 text-sm rounded-lg border border-input px-3 py-2 bg-background">
                    {CATEGORIES.map(c => <option key={c} value={c}>{t(c as Parameters<typeof t>[0])}</option>)}
                  </select>
                </div>
              </div>

              <div className="p-3 rounded-lg" style={{ background: '#F5E6C8' }}>
                <div className="flex justify-between text-sm font-bold">
                  <span>الإجمالي</span>
                  <span style={{ color: '#E5A53C' }}>{reviewing.total.toFixed(3)} ر.ع</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={() => handleApprove(reviewing)} className="flex-1" style={{ background: '#16a34a' }}>
                  ✅ اعتماد وحفظ في المشتريات
                </Button>
                <Button onClick={() => handleReject(reviewing.id)} variant="destructive">
                  حذف
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
