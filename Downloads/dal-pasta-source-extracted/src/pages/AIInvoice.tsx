import { useState, useRef } from 'react';
import { PurchaseDB } from '@/lib/hybrid-db';
import { t } from '@/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const CATEGORIES = ['vegetables','vegshop','groceries','packaging','cleaning','operational','maintenance','development','electricity','water','gas','fuel','salary','workers','courier','advertising','other'];
const UNITS = ['كجم','جرام','لتر','قطعة','كرتون','علبة','زجاجة','جرة','ربطة','كيس','CTN','PCS'];
const PENDING_KEY = 'ai_pending_invoices';
const API_KEY_STORAGE = 'anthropic_api_key';
const MAPPINGS_KEY = 'product_name_mappings';
const CATEGORY_MAPPINGS_KEY = 'product_category_mappings';

type InvoiceStatus = 'ready' | 'review' | 'duplicate';

interface PendingInvoice {
  id: string;
  imageBase64: string;
  status: InvoiceStatus;
  issues: string[];
  productName: string;
  productNameOriginal: string;
  packageSpec: string;
  itemsPerUnit: number;    // عدد القطع داخل وحدة الشراء
  quantity: number;
  unit: string;
  unitPrice: number;       // السعر قبل الضريبة
  vatAmount: number;       // قيمة الضريبة
  total: number;           // الإجمالي شامل الضريبة
  supplier: string;
  date: string;
  category: string;
  notes: string;
  nameSource: 'saved' | 'history' | 'ai';
  createdAt: string;
  suggestions: string[];
}

function getPending(): PendingInvoice[] {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); } catch { return []; }
}
function savePending(list: PendingInvoice[]) {
  localStorage.setItem(PENDING_KEY, JSON.stringify(list));
}

function getMappings(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(MAPPINGS_KEY) || '{}'); } catch { return {}; }
}
function saveMapping(original: string, arabic: string) {
  if (!original || !arabic) return;
  const maps = getMappings();
  maps[original.toLowerCase().trim()] = arabic.trim();
  localStorage.setItem(MAPPINGS_KEY, JSON.stringify(maps));
}
function getMapping(original: string): string | null {
  if (!original) return null;
  return getMappings()[original.toLowerCase().trim()] || null;
}

// حفظ واسترجاع تصنيف المنتج
function getCategoryMappings(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(CATEGORY_MAPPINGS_KEY) || '{}'); } catch { return {}; }
}
function saveCategoryMapping(productName: string, category: string) {
  if (!productName || !category || category === 'other') return;
  const maps = getCategoryMappings();
  maps[productName.trim()] = category;
  localStorage.setItem(CATEGORY_MAPPINGS_KEY, JSON.stringify(maps));
}
function getCategoryForProduct(productName: string): string | null {
  if (!productName) return null;
  return getCategoryMappings()[productName.trim()] || null;
}

// مطابقة تلقائية مع أسماء المشتريات السابقة بناءً على الكلمات المشتركة
function findBestHistoryMatch(productNameEn: string, allNames: string[]): string | null {
  if (!productNameEn || allNames.length === 0) return null;
  const keywords = productNameEn.toLowerCase().split(/[\s_\-\/]+/).filter(w => w.length > 3);
  if (keywords.length === 0) return null;

  let bestName = null;
  let bestScore = 0;
  for (const name of allNames) {
    const nameLow = name.toLowerCase();
    const score = keywords.filter(kw => nameLow.includes(kw)).length;
    // يشترط تطابق نصف الكلمات على الأقل وكلمة واحدة على الأقل
    if (score > bestScore && score >= Math.max(1, Math.ceil(keywords.length * 0.5))) {
      bestScore = score;
      bestName = name;
    }
  }
  return bestName;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function compressImage(file: File): Promise<{ base64: string; mediaType: 'image/jpeg' }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1500;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const ratio = Math.min(MAX / width, MAX / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('فشل ضغط الصورة')); return; }
        const reader = new FileReader();
        reader.onload = () => resolve({ base64: (reader.result as string).split(',')[1], mediaType: 'image/jpeg' });
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      }, 'image/jpeg', 0.75);
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function AIInvoice() {
  const [apiKey, setApiKey] = useState(localStorage.getItem(API_KEY_STORAGE) || '');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [pending, setPending] = useState<PendingInvoice[]>(getPending());
  const [processing, setProcessing] = useState(false);
  const [processingMsg, setProcessingMsg] = useState('');
  const [reviewing, setReviewing] = useState<PendingInvoice | null>(null);
  const [error, setError] = useState('');
  const [pastingText, setPastingText] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const saveApiKey = () => {
    localStorage.setItem(API_KEY_STORAGE, apiKeyInput.trim());
    setApiKey(apiKeyInput.trim());
  };

  const callClaude = async (messages: object[], maxTokens = 4096) => {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: maxTokens, messages }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'خطأ في API');
    }
    const data = await response.json();
    const textBlock = data.content?.find((b: { type: string; text?: string }) => b.type === 'text');
    if (!textBlock?.text) {
      const reason = data.stop_reason || 'unknown';
      throw new Error(`تعذر قراءة الرد (${reason})، حاولي مرة أخرى`);
    }
    return textBlock.text;
  };

  // بناء البرومبت مع الأسماء الموحدة من تاريخ المشتريات
  const buildPrompt = (canonicalNames: string[]) => {
    const namesSection = canonicalNames.length > 0
      ? `\nالأسماء الموحدة في نظامنا — استخدمها إذا تطابق المنتج:\n${canonicalNames.slice(0, 30).join(' · ')}\n`
      : '';

    return `استخرج جميع أصناف الفاتورة وأعطني JSON فقط بدون أي نص آخر:
{
  "supplier": "اسم المورد بالعربي (ترجم إن كان إنجليزي — مثلاً: ناهدة للتجارة، آي بيك، سويتز)",
  "date": "YYYY-MM-DD",
  "items": [
    {
      "productNameAr": "اسم المنتج فقط بدون أرقام أو كميات (مثلاً: زيتون أسود شرائح — وليس زيتون 4.4كجم×4)",
      "productNameEn": "الاسم كما هو مكتوب في الفاتورة بالضبط",
      "packageSpec": "مواصفة العبوة مختصرة مثل 4.4كجم×4 أو 800جم×12 أو 150قطعة (فارغ إن لم تُذكر)",
      "itemsPerUnit": 150,
      "quantity": 4,
      "unit": "كرتون أو قطعة أو كيس — وحدة الشراء الفعلية",
      "unitPriceBeforeVAT": 0.000,
      "vatAmount": 0.000,
      "totalWithVAT": 0.000
    }
  ]
}
${namesSection}
قواعد مهمة:
- استخرج كل الأصناف حتى لو كانت كثيرة
- تجاهل أصناف FOC أو العروض المجانية (سعرها صفر)
- اسم المنتج: نوع المنتج فقط بدون أحجام أو كميات (الكمية تروح في حقل quantity)
  مثال صح: "زيتون أسود شرائح" — مثال خطأ: "زيتون أسود 4.4كجم×4"
- itemsPerUnit: عدد القطع الفردية داخل وحدة الشراء. أمثلة: "1x10pkt" أو "10pkt" → 10، "12x500g" → 12، "CTN/150" → 150. اكتب 1 إذا لم ينطبق
- اسم المورد: بالعربي دائماً (ترجم أو عرّب الاسم الإنجليزي)
- unitPriceBeforeVAT: سعر الوحدة الواحدة قبل الضريبة
- vatAmount: ضريبة الوحدة الواحدة فقط (وليس إجمالي الضريبة)
- totalWithVAT: إجمالي السطر كله شامل الضريبة = quantity × (unitPriceBeforeVAT + vatAmount)
- للضريبة: استخرجها من الفاتورة. إذا كانت الفاتورة تُظهر VAT منفصلة فاستخرجها، وإذا كان السعر شامل الضريبة فاحسبها (5٪ عُمان)
- إذا لا توجد ضريبة واضحة اجعل vatAmount صفر
- إذا أي خانة غير واضحة اكتب "" للنصوص و0 للأرقام`;
  };

  const processMultipleItems = async (
    items: Array<Record<string, unknown>>,
    supplier: string,
    date: string,
    imageBase64: string
  ) => {
    const allPurchases = await PurchaseDB.getAll();
    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const finalDate = date && date !== 'YYYY-MM-DD' ? date : new Date().toISOString().split('T')[0];
    const allNames = [...new Set(allPurchases.map(p => p.productName).filter(Boolean))];

    const newInvoices: PendingInvoice[] = items.map((item, idx) => {
      const issues: string[] = [];
      const qty = (item.quantity as number) || 0;
      const unitPriceBeforeVAT = (item.unitPriceBeforeVAT as number) || 0;
      const vatAmount = (item.vatAmount as number) || 0;
      const totalWithVAT = (item.totalWithVAT as number) || 0;

      // totalWithVAT = إجمالي السطر كله من الـ AI، vatAmount = ضريبة الوحدة
      const unitPrice = unitPriceBeforeVAT;
      const total = totalWithVAT || (unitPriceBeforeVAT * qty + vatAmount * qty) || (unitPriceBeforeVAT * qty);

      const productNameEn = (item.productNameEn as string) || '';
      const productNameAi = (item.productNameAr as string) || productNameEn || '';
      const packageSpec = (item.packageSpec as string) || '';
      const itemsPerUnit = (item.itemsPerUnit as number) || 1;

      // أولوية الاسم: تصحيح محفوظ → تطابق من التاريخ → ترجمة AI
      const savedName = getMapping(productNameEn) || getMapping(productNameAi);
      const historyMatch = !savedName ? findBestHistoryMatch(productNameEn, allNames) : null;
      const productName = savedName || historyMatch || productNameAi;
      const nameSource = savedName ? 'saved' : historyMatch ? 'history' : 'ai';

      // اقتراحات من التاريخ
      const keywords = productNameEn.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const suggestions = allNames.filter(name => {
        const nameLow = name.toLowerCase();
        return keywords.some(kw => nameLow.includes(kw) || kw.includes(nameLow.slice(0, 4)));
      }).slice(0, 4);

      if (!productName) issues.push('اسم الصنف غير واضح');
      if (total <= 0) issues.push('السعر غير واضح');

      // تحقق تغير السعر مع آخر شراء (بدون ضريبة للمقارنة الصحيحة)
      const productKey = productName.trim().slice(0, 5);
      const similar = allPurchases.filter(p =>
        productKey.length > 2 && (
          p.productName?.includes(productKey) ||
          keywords.some(w => w.length > 3 && p.productName?.toLowerCase().includes(w))
        )
      );
      if (similar.length > 0 && unitPrice > 0) {
        const lastPrice = similar[similar.length - 1].unitPrice;
        if (lastPrice > 0) {
          const change = Math.abs(unitPrice - lastPrice) / lastPrice;
          if (change > 0.15) issues.push(`السعر تغير ${(change * 100).toFixed(0)}٪ — كان ${lastPrice.toFixed(3)} ر.ع`);
        }
      }

      // إشارة للاقتراحات
      if (!savedName && suggestions.length > 0 && suggestions[0] !== productName) {
        issues.push(`هل تقصد: ${suggestions[0]}؟`);
      }

      const isDuplicate = allPurchases.some(p => {
        const pDate = new Date(p.date);
        return p.supplier === supplier && p.productName === productName &&
               Math.abs(p.total - total) < 0.01 && pDate > sevenDaysAgo;
      });

      let status: InvoiceStatus = 'ready';
      if (isDuplicate) status = 'duplicate';
      else if (issues.length > 0) status = 'review';

      return {
        id: `inv_${Date.now()}_${idx}`,
        imageBase64: idx === 0 ? imageBase64 : '',
        status,
        issues,
        productName,
        productNameOriginal: productNameEn,
        packageSpec,
        itemsPerUnit,
        quantity: qty,
        unit: (item.unit as string) || 'قطعة',
        unitPrice,
        vatAmount,
        total,
        supplier: supplier || '',
        date: finalDate,
        category: getCategoryForProduct(productName) || (item.category as string) || 'other',
        notes: '',
        nameSource,
        createdAt: new Date().toISOString(),
        suggestions,
      };
    });

    const updated = [...newInvoices, ...getPending()];
    savePending(updated);
    setPending(updated);
    return newInvoices.length;
  };

  const handleImage = async (file: File) => {
    setProcessing(true); setError('');
    const isPdf = file.type === 'application/pdf';
    setProcessingMsg(isPdf ? 'يقرأ ملف PDF...' : 'يضغط الصورة...');
    try {
      let contentBlock: Record<string, unknown>;
      let previewDataUrl: string;

      if (isPdf) {
        const base64 = await readFileAsBase64(file);
        previewDataUrl = '';
        contentBlock = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } };
      } else {
        const { base64, mediaType } = await compressImage(file);
        previewDataUrl = `data:${mediaType};base64,${base64}`;
        contentBlock = { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } };
      }

      // جلب الأسماء الموحدة من التاريخ
      setProcessingMsg('يحضّر قائمة الأسماء الموحدة...');
      const allPurchases = await PurchaseDB.getAll();
      const canonicalNames = [...new Set(allPurchases.map(p => p.productName).filter(Boolean))];

      setProcessingMsg('يقرأ الفاتورة ويترجم الأصناف...');
      const text = await callClaude([{
        role: 'user',
        content: [
          contentBlock,
          { type: 'text', text: buildPrompt(canonicalNames) },
        ],
      }], isPdf ? 8192 : 4096);

      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('تعذر قراءة الفاتورة، حاولي مرة أخرى');

      const parsed = JSON.parse(match[0]);
      const rawItems = (parsed.items as Array<Record<string, unknown>>) || [];
      const paidItems = rawItems.filter(it =>
        ((it.totalWithVAT as number) || 0) > 0 || ((it.unitPriceBeforeVAT as number) || 0) > 0
      );
      const items = paidItems.length > 0 ? paidItems : rawItems;
      if (items.length === 0) throw new Error('لم يتم العثور على أصناف في الفاتورة');

      setProcessingMsg(`يقارن ${items.length} صنف بالتاريخ...`);
      const count = await processMultipleItems(items, parsed.supplier || '', parsed.date || '', previewDataUrl);
      setProcessingMsg(`تم استخراج ${count} صنف ✓`);
      setTimeout(() => setProcessingMsg(''), 3000);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'خطأ غير معروف'); }
    setProcessing(false);
  };

  const handlePastedText = async () => {
    if (!pastedText.trim()) return;
    setProcessing(true); setError('');
    setProcessingMsg('يحلل النص...');
    try {
      const allPurchases = await PurchaseDB.getAll();
      const canonicalNames = [...new Set(allPurchases.map(p => p.productName).filter(Boolean))];
      const text = await callClaude([{ role: 'user', content: `${buildPrompt(canonicalNames)}\n\nنص الفاتورة:\n${pastedText}` }]);
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('تعذر التحليل');
      const parsed = JSON.parse(match[0]);
      const rawItems = (parsed.items as Array<Record<string, unknown>>) || [];
      const paidItems = rawItems.filter(it => ((it.totalWithVAT as number) || 0) > 0 || ((it.unitPriceBeforeVAT as number) || 0) > 0);
      const count = await processMultipleItems(
        paidItems.length > 0 ? paidItems : rawItems,
        parsed.supplier || '', parsed.date || '', ''
      );
      setProcessingMsg(`تم استخراج ${count} صنف ✓`);
      setTimeout(() => setProcessingMsg(''), 3000);
      setPastedText(''); setPastingText(false);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'خطأ'); }
    setProcessing(false);
  };

  const handleApprove = async (inv: PendingInvoice) => {
    try {
      if (inv.productNameOriginal && inv.productName && inv.productNameOriginal !== inv.productName) {
        saveMapping(inv.productNameOriginal, inv.productName);
      }
      saveCategoryMapping(inv.productName, inv.category);
      await PurchaseDB.add({
        productName: inv.productName, quantity: inv.quantity, unit: inv.unit,
        unitPrice: inv.unitPrice, total: inv.total, supplier: inv.supplier,
        date: inv.date, category: inv.category, receipt: null, notes: inv.notes || '',
      });
      const updated = getPending().filter(p => p.id !== inv.id);
      savePending(updated); setPending(updated); setReviewing(null);
      setProcessingMsg(`✅ تم حفظ "${inv.productName}" في المشتريات`);
      setTimeout(() => setProcessingMsg(''), 4000);
    } catch (e: unknown) { alert('فشل الحفظ: ' + (e instanceof Error ? e.message : '')); }
  };

  const handleApproveAll = async () => {
    const readyList = pending.filter(p => p.status === 'ready');
    const errors: string[] = [];
    for (const inv of readyList) {
      try {
        if (inv.productNameOriginal && inv.productName && inv.productNameOriginal !== inv.productName) {
          saveMapping(inv.productNameOriginal, inv.productName);
        }
        saveCategoryMapping(inv.productName, inv.category);
        await PurchaseDB.add({
          productName: inv.productName, quantity: inv.quantity, unit: inv.unit,
          unitPrice: inv.unitPrice, total: inv.total, supplier: inv.supplier,
          date: inv.date, category: inv.category, receipt: null, notes: inv.notes || '',
        });
      } catch (e) { errors.push(inv.productName + ': ' + (e instanceof Error ? e.message : '')); }
    }
    const remaining = getPending().filter(p => p.status !== 'ready');
    savePending(remaining); setPending(remaining);
    if (errors.length > 0) alert('فشل حفظ بعض الأصناف:\n' + errors.join('\n'));
  };

  const handleReject = (id: string) => {
    const updated = getPending().filter(p => p.id !== id);
    savePending(updated); setPending(updated); setReviewing(null);
  };

  const handleRejectInvoice = (supplier: string, date: string) => {
    const updated = getPending().filter(p => !(p.supplier === supplier && p.date === date));
    savePending(updated); setPending(updated); setReviewing(null);
  };

  const upd = (field: keyof PendingInvoice, value: unknown) => {
    if (!reviewing) return;
    const updated = { ...reviewing, [field]: value };
    if (field === 'quantity' || field === 'unitPrice' || field === 'vatAmount') {
      const qty = field === 'quantity' ? (value as number) : updated.quantity;
      const price = field === 'unitPrice' ? (value as number) : updated.unitPrice;
      const vat = field === 'vatAmount' ? (value as number) : updated.vatAmount;
      updated.total = parseFloat((qty * (price + vat)).toFixed(3));
    }
    setReviewing(updated);
  };

  const perPiecePrice = (inv: PendingInvoice) => {
    const ipu = inv.itemsPerUnit || 1;
    if (ipu <= 1 || inv.total <= 0) return null;
    return (inv.total / (inv.quantity * ipu)).toFixed(3);
  };

  const applySuggestion = (name: string) => {
    if (reviewing) setReviewing({ ...reviewing, productName: name });
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

      <Card>
        <CardContent className="p-5">
          <div
            className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all hover:opacity-80"
            style={{ borderColor: '#E5A53C80', background: '#FFF9F0' }}
            onClick={() => !processing && fileInputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleImage(f); }}
          >
            <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImage(f); if (e.target) e.target.value = ''; }} />
            {processing ? (
              <div className="space-y-3">
                <div className="w-8 h-8 border-4 rounded-full animate-spin mx-auto" style={{ borderColor: '#E5A53C', borderTopColor: 'transparent' }} />
                <p className="text-sm font-medium" style={{ color: '#8B7355' }}>{processingMsg}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-4xl">📸</p>
                <p className="font-bold" style={{ color: '#2C1810' }}>صوّر أو ارفع الفاتورة</p>
                <p className="text-xs" style={{ color: '#A08B6D' }}>صورة أو PDF · يستخرج كل الأصناف · أسماء موحدة · يفصل الضريبة</p>
              </div>
            )}
          </div>

          {!processing && processingMsg && (
            <p className="text-sm text-green-600 mt-3 text-center bg-green-50 rounded-lg p-2 font-medium">✅ {processingMsg}</p>
          )}
          {error && <p className="text-sm text-red-500 mt-3 text-center bg-red-50 rounded-lg p-2">⚠️ {error}</p>}

          <div className="flex items-center gap-2 my-3">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400">أو</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <button onClick={() => setPastingText(v => !v)}
            className="w-full text-xs py-2 rounded-lg border transition-colors hover:bg-amber-50"
            style={{ color: '#8B7355', borderColor: '#E5E7EB' }}>
            📋 لصق نص الفاتورة يدوياً
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

      {pending.length > 0 && (() => {
        const groups: Record<string, PendingInvoice[]> = {};
        for (const inv of pending) {
          const key = `${inv.supplier}||${inv.date}`;
          if (!groups[key]) groups[key] = [];
          groups[key].push(inv);
        }
        return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold" style={{ color: '#2C1810' }}>الأصناف المعلقة ({pending.length})</h3>
            {countReady > 0 && (
              <button onClick={handleApproveAll}
                className="text-xs px-3 py-1.5 rounded-lg font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100">
                ✅ اعتماد الكل الجاهزة ({countReady})
              </button>
            )}
          </div>
          {Object.entries(groups).map(([key, items]) => {
            const { supplier, date } = items[0];
            const isMulti = items.length > 1;
            return (
            <div key={key} className="space-y-2">
              {isMulti && (
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-medium" style={{ color: '#8B7355' }}>
                    🧾 {supplier || '—'} · {date} · {items.length} أصناف
                  </span>
                  <button
                    onClick={() => { if (confirm(`حذف كل أصناف فاتورة ${supplier}؟`)) handleRejectInvoice(supplier, date); }}
                    className="text-[11px] px-2 py-1 rounded-lg text-red-500 border border-red-200 hover:bg-red-50 transition-colors font-medium">
                    🗑 حذف الفاتورة كلها
                  </button>
                </div>
              )}
              {items.map(inv => (
            <Card key={inv.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {inv.imageBase64 ? (
                    <img src={inv.imageBase64} className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                      style={{ border: '1px solid #F5E6C8' }} />
                  ) : (
                    <div className="w-14 h-14 rounded-lg flex-shrink-0 flex items-center justify-center text-2xl"
                      style={{ background: '#FFF0E0', border: '1px solid #F5E6C8' }}>📄</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        inv.status === 'ready' ? 'bg-green-100 text-green-700' :
                        inv.status === 'duplicate' ? 'bg-red-100 text-red-600' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {inv.status === 'ready' ? '✅ جاهز' : inv.status === 'duplicate' ? '🔁 مكرر' : '⚠️ مراجعة'}
                      </span>
                      <p className="font-bold text-sm truncate">{inv.productName || 'بدون اسم'}</p>
                      {inv.packageSpec && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono flex-shrink-0"
                          style={{ background: '#F0F4FF', color: '#4B5563' }}>{inv.packageSpec}</span>
                      )}
                    </div>
                    {inv.productNameOriginal && inv.productNameOriginal !== inv.productName && (
                      <p className="text-[10px] text-gray-400 truncate" dir="ltr">{inv.productNameOriginal}</p>
                    )}
                    <p className="text-xs" style={{ color: '#8B7355' }}>
                      {inv.quantity} {inv.unit} · {inv.supplier || '—'} · {inv.date}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs font-bold" style={{ color: '#2C1810' }}>
                        {inv.total.toFixed(3)} ر.ع
                      </p>
                      {inv.vatAmount > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#EEF2FF', color: '#4F46E5' }}>
                          ض.ق.م {inv.vatAmount.toFixed(3)}
                        </span>
                      )}
                    </div>
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
                  <Button size="sm" onClick={() => handleApprove(inv)} className="text-xs flex-1"
                    style={{ background: inv.status === 'ready' ? '#16a34a' : inv.status === 'duplicate' ? '#6b7280' : '#d97706' }}>
                    {inv.status === 'ready' ? '✅ اعتماد' : inv.status === 'duplicate' ? '🔁 اعتماد رغم التكرار' : '⚠️ اعتماد رغم التحقق'}
                  </Button>
                  <button onClick={() => handleReject(inv.id)}
                    className="text-xs px-3 py-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors">
                    حذف
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
            </div>
          );
        })}
        </div>
        );
      })()}

      {pending.length === 0 && !processing && (
        <div className="text-center py-8" style={{ color: '#A08B6D' }}>
          <p className="text-3xl mb-2">🧾</p>
          <p className="text-sm">لا توجد أصناف معلقة</p>
          <p className="text-xs mt-1">ارفع فاتورة وسيتم استخراج كل أصنافها بالعربي</p>
        </div>
      )}

      {/* نافذة المراجعة */}
      <Dialog open={!!reviewing} onOpenChange={open => { if (!open) setReviewing(null); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-base">مراجعة الصنف</DialogTitle></DialogHeader>
          {reviewing && (
            <div className="space-y-4">
              {reviewing.imageBase64 ? (
                <img src={reviewing.imageBase64} className="w-full rounded-xl max-h-52 object-contain"
                  style={{ background: '#F5F5F0', border: '1px solid #E5E7EB' }} />
              ) : (
                <div className="w-full rounded-xl p-4 text-center text-sm font-medium"
                  style={{ background: '#FFF9F0', border: '1px solid #E5E7EB', color: '#8B7355' }}>📄 فاتورة PDF</div>
              )}

              {reviewing.productNameOriginal && (
                <div className="p-2 rounded-lg text-[11px]" style={{ background: '#F5F5F0' }}>
                  <span className="text-gray-400">في الفاتورة: </span>
                  <span className="font-mono text-gray-600" dir="ltr">{reviewing.productNameOriginal}</span>
                </div>
              )}

              {reviewing.issues.length > 0 && (
                <div className="p-3 rounded-lg space-y-1" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                  <p className="text-xs font-bold mb-1" style={{ color: '#92400e' }}>نقاط تحتاج تحقق:</p>
                  {reviewing.issues.map((issue, i) => (
                    <p key={i} className="text-xs" style={{ color: '#b45309' }}>• {issue}</p>
                  ))}
                </div>
              )}

              {reviewing.suggestions.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-bold" style={{ color: '#2C1810' }}>من مشترياتك السابقة:</p>
                  <div className="flex flex-wrap gap-2">
                    {reviewing.suggestions.map((s, i) => (
                      <button key={i} onClick={() => applySuggestion(s)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                          reviewing.productName === s
                            ? 'font-bold border-amber-400 text-amber-800'
                            : 'border-gray-200 text-gray-600 hover:border-amber-300'
                        }`}
                        style={reviewing.productName === s ? { background: '#FFF3DC' } : { background: '#FAFAFA' }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs">اسم الصنف بالعربي *</Label>
                    {reviewing.packageSpec && (
                      <span className="text-[10px] px-2 py-0.5 rounded font-mono" style={{ background: '#F0F4FF', color: '#4B5563' }}>
                        {reviewing.packageSpec}
                      </span>
                    )}
                  </div>
                  <Input value={reviewing.productName} onChange={e => upd('productName', e.target.value)} className="mt-1" dir="rtl" />
                  <p className="text-[10px] mt-1" style={{
                    color: reviewing.nameSource === 'history' ? '#16a34a' :
                           reviewing.nameSource === 'saved' ? '#6366F1' : '#A08B6D'
                  }}>
                    {reviewing.nameSource === 'history' && '📂 من سجلاتك السابقة'}
                    {reviewing.nameSource === 'saved' && '🔗 من تصحيحاتك المحفوظة'}
                    {reviewing.nameSource === 'ai' && '🤖 ترجمة الذكاء الاصطناعي — راجعي إن احتجتِ'}
                  </p>
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
                  <Label className="text-xs">قطع في الكرتون / الوحدة</Label>
                  <Input type="number" step="1" min="1" value={reviewing.itemsPerUnit || 1}
                    onChange={e => upd('itemsPerUnit', parseInt(e.target.value) || 1)} className="mt-1"
                    style={{ borderColor: (reviewing.itemsPerUnit || 1) > 1 ? '#E5A53C' : undefined }} />
                  {(reviewing.itemsPerUnit || 1) > 1 && reviewing.total > 0 && (
                    <p className="text-[11px] mt-1 font-semibold" style={{ color: '#16a34a' }}>
                      سعر القطعة = {(reviewing.total / (reviewing.quantity * (reviewing.itemsPerUnit || 1))).toFixed(3)} ر.ع
                    </p>
                  )}
                </div>
                <div />
                <div>
                  <Label className="text-xs">سعر الوحدة (قبل الضريبة)</Label>
                  <Input type="number" step="0.001" value={reviewing.unitPrice}
                    onChange={e => upd('unitPrice', parseFloat(e.target.value) || 0)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">ضريبة القيمة المضافة</Label>
                  <Input type="number" step="0.001" value={reviewing.vatAmount}
                    onChange={e => upd('vatAmount', parseFloat(e.target.value) || 0)} className="mt-1"
                    style={{ borderColor: reviewing.vatAmount > 0 ? '#6366F1' : undefined }} />
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
                <div className="col-span-2">
                  <Label className="text-xs">ملاحظات (اختياري)</Label>
                  <textarea value={reviewing.notes || ''} onChange={e => upd('notes', e.target.value)}
                    placeholder="مثال: كل كرتون 10 قطع × 500جم" dir="rtl" rows={2}
                    className="w-full mt-1 text-sm p-3 rounded-lg border border-input resize-none outline-none focus:border-amber-400 bg-background"
                    style={{ borderColor: reviewing.notes ? '#E5A53C60' : undefined }} />
                </div>
              </div>

              {/* ملخص الإجمالي مع الضريبة */}
              <div className="p-3 rounded-lg space-y-1.5" style={{ background: '#F5E6C8' }}>
                {reviewing.vatAmount > 0 && (
                  <>
                    <div className="flex justify-between text-xs" style={{ color: '#8B6914' }}>
                      <span>قبل الضريبة</span>
                      <span>{(reviewing.quantity * reviewing.unitPrice).toFixed(3)} ر.ع</span>
                    </div>
                    <div className="flex justify-between text-xs" style={{ color: '#4F46E5' }}>
                      <span>ض.ق.م (5٪)</span>
                      <span>{(reviewing.quantity * reviewing.vatAmount).toFixed(3)} ر.ع</span>
                    </div>
                    <div className="h-px" style={{ background: 'rgba(229,165,60,0.3)' }} />
                  </>
                )}
                <div className="flex justify-between text-sm font-bold">
                  <span>الإجمالي المدفوع</span>
                  <span style={{ color: '#E5A53C' }}>{reviewing.total.toFixed(3)} ر.ع</span>
                </div>
                {perPiecePrice(reviewing) && (
                  <div className="flex justify-between text-xs font-semibold pt-1" style={{ borderTop: '1px solid rgba(229,165,60,0.3)', color: '#16a34a' }}>
                    <span>سعر القطعة المفردة ({reviewing.itemsPerUnit} قطعة/كرتون)</span>
                    <span>{perPiecePrice(reviewing)} ر.ع</span>
                  </div>
                )}
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
