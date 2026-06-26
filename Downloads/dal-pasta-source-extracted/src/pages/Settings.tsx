import { useState } from 'react';
import { t, setLang, getLang } from '@/lib/i18n';
import { SettingsDB, exportAll, importAll, resetAll, seedData, isCloudConnected } from '@/lib/hybrid-db';
import { setSupabaseConfig, updateStoredPin } from '@/lib/supabase';
import type { Lang } from '@/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function Settings() {
  const [lang, setLangState] = useState<Lang>(getLang());
  const [aedRate, setAedRate] = useState(String(SettingsDB.get().aedRate || 0.105));
  const [aedSaved, setAedSaved] = useState(false);

  const s = SettingsDB.get();
  const [bizName, setBizName] = useState(s.businessName);
  const [bizSubtitle, setBizSubtitle] = useState(s.businessSubtitle);
  const [bizPhone, setBizPhone] = useState(s.businessPhone);
  const [bizAddress, setBizAddress] = useState(s.businessAddress);
  const [bizCity, setBizCity] = useState(s.businessCity);
  const [crNumber, setCrNumber] = useState(s.crNumber);
  const [vatNumber, setVatNumber] = useState(s.vatNumber);
  const [logoBase64, setLogoBase64] = useState(s.logoBase64);
  const [bizSaved, setBizSaved] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinMessage, setPinMessage] = useState('');
  const [pinError, setPinError] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const [cloudConnected] = useState(isCloudConnected());
  const [sbUrl, setSbUrl] = useState('');
  const [sbKey, setSbKey] = useState('');
  const [sbMessage, setSbMessage] = useState('');

  const handleLangChange = (newLang: Lang) => { setLang(newLang); setLangState(newLang); };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogoBase64(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveBiz = () => {
    SettingsDB.set({ businessName: bizName, businessSubtitle: bizSubtitle, businessPhone: bizPhone, businessAddress: bizAddress, businessCity: bizCity, crNumber, vatNumber, logoBase64 });
    setBizSaved(true); setTimeout(() => setBizSaved(false), 2000);
  };

  const handleChangePin = async () => {
    setPinMessage(''); setPinError(false);
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) { setPinMessage('PIN must be 4 digits'); setPinError(true); return; }
    if (newPin !== confirmPin) { setPinMessage(t('pinMismatch')); setPinError(true); return; }
    const success = await updateStoredPin(currentPin, newPin);
    if (success) { setPinMessage(t('pinChanged')); setPinError(false); setCurrentPin(''); setNewPin(''); setConfirmPin(''); }
    else { setPinMessage(t('pinWrong')); setPinError(true); }
  };

  const handleExport = async () => {
    const data = await exportAll();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `dal-pasta-backup-${new Date().toISOString().split('T')[0]}.json`; a.click(); URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { const success = importAll(reader.result as string); setImportStatus(success ? 'Backup restored!' : 'Failed'); setTimeout(() => setImportStatus(''), 3000); };
    reader.readAsText(file); e.target.value = '';
  };

  const handleReset = () => { resetAll(); setShowResetDialog(false); SettingsDB.set({ pin: '1234' }); window.location.reload(); };
  const handleSeed = async () => { await seedData(); window.location.reload(); };

  const handleConnectSupabase = () => {
    if (!sbUrl.trim() || !sbKey.trim()) { setSbMessage('Please enter both URL and Key'); return; }
    setSupabaseConfig(sbUrl.trim(), sbKey.trim());
    setSbMessage('Connected! Reloading...');
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Cloud Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">☁️ Supabase Cloud</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {cloudConnected ? (
            <div className="p-3 rounded-lg text-center text-sm font-medium" style={{ background: '#dcfce7', color: '#166534' }}>
              ✅ Connected to Supabase Cloud
            </div>
          ) : (
            <>
              <div className="p-3 rounded-lg text-sm" style={{ background: '#fef3c7', color: '#92400e' }}>
                ⚠️ Running in Local Mode only. Connect Supabase for cloud storage.
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Project URL (من General)</Label>
                <Input value={sbUrl} onChange={e => setSbUrl(e.target.value)} placeholder="https://xxxxx.supabase.co" className="text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Publishable Key (من API Keys)</Label>
                <Input value={sbKey} onChange={e => setSbKey(e.target.value)} placeholder="sb_publishable_..." className="text-sm" type="password" />
              </div>
              {sbMessage && <p className="text-xs" style={{ color: sbMessage.includes('Connected') ? '#16a34a' : '#dc2626' }}>{sbMessage}</p>}
              <Button onClick={handleConnectSupabase} className="w-full" style={{ background: '#3ECF8E' }}>Connect to Supabase</Button>
              <p className="text-xs" style={{ color: '#8B7355' }}>
                Don't have Supabase? 
                <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="underline ml-1" style={{ color: '#3ECF8E' }}>Create free account</a>
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* بيانات الفاتورة الرسمية */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">📄 بيانات الفاتورة الرسمية</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3">
            <div><Label className="text-xs">اسم المنشأة</Label><Input value={bizName} onChange={e => setBizName(e.target.value)} className="mt-1" /></div>
            <div><Label className="text-xs">الوصف (السطر الثاني)</Label><Input value={bizSubtitle} onChange={e => setBizSubtitle(e.target.value)} className="mt-1" placeholder="مشروع منزلي · صحار" /></div>
            <div><Label className="text-xs">رقم الهاتف</Label><Input value={bizPhone} onChange={e => setBizPhone(e.target.value)} className="mt-1" type="tel" /></div>
            <div><Label className="text-xs">العنوان التفصيلي</Label><Input value={bizAddress} onChange={e => setBizAddress(e.target.value)} className="mt-1" placeholder="مثال: طريق الساحل، حي النهضة" /></div>
            <div><Label className="text-xs">المدينة / الولاية</Label><Input value={bizCity} onChange={e => setBizCity(e.target.value)} className="mt-1" placeholder="صحار، عُمان" /></div>
            <div>
              <Label className="text-xs">رقم السجل التجاري (CR)</Label>
              <Input value={crNumber} onChange={e => setCrNumber(e.target.value)} className="mt-1 font-mono" placeholder="1234567" dir="ltr" />
            </div>
            <div>
              <Label className="text-xs">الرقم الضريبي (اختياري - إذا مسجل بالضريبة)</Label>
              <Input value={vatNumber} onChange={e => setVatNumber(e.target.value)} className="mt-1 font-mono" placeholder="OM1234567890" dir="ltr" />
            </div>
            <div>
              <Label className="text-xs">شعار المنشأة (علامة مائية في الفاتورة)</Label>
              <div className="flex items-center gap-3 mt-1">
                {logoBase64 && <img src={logoBase64} className="w-12 h-12 object-contain rounded-lg border" style={{ borderColor: '#E5A53C' }} />}
                <div className="relative flex-1">
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <Button variant="outline" className="w-full text-sm gap-2">🖼️ {logoBase64 ? 'تغيير الشعار' : 'رفع الشعار'}</Button>
                </div>
                {logoBase64 && <button onClick={() => setLogoBase64('')} className="text-red-400 text-xs px-2 py-1 rounded hover:bg-red-50">حذف</button>}
              </div>
            </div>
          </div>
          <Button onClick={handleSaveBiz} className="w-full" style={{ background: '#E5A53C' }}>
            {bizSaved ? '✅ تم الحفظ' : 'حفظ البيانات'}
          </Button>
        </CardContent>
      </Card>

      {/* AED Exchange Rate */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">🇦🇪 سعر صرف الدرهم الإماراتي</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs" style={{ color: '#8B7355' }}>
            1 درهم إماراتي = ؟ ريال عماني
          </p>
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <Label className="text-xs">1 AED = __ ر.ع</Label>
              <Input
                type="number" step="0.001" min="0.01" max="1"
                value={aedRate}
                onChange={e => setAedRate(e.target.value)}
                className="mt-1 text-lg font-bold text-center"
                dir="ltr"
              />
            </div>
            <div className="pt-5 text-center px-2">
              <p className="text-xs" style={{ color: '#8B7355' }}>أو</p>
              <p className="text-xs font-bold mt-1">1 ر.ع = {parseFloat(aedRate) > 0 ? (1 / parseFloat(aedRate)).toFixed(2) : '---'} د.إ</p>
            </div>
          </div>
          <Button
            onClick={() => { SettingsDB.set({ aedRate: parseFloat(aedRate) || 0.105 }); setAedSaved(true); setTimeout(() => setAedSaved(false), 2000); }}
            className="w-full" style={{ background: '#E5A53C' }}
          >
            {aedSaved ? '✅ تم الحفظ' : 'حفظ السعر'}
          </Button>
          <p className="text-[10px] text-center" style={{ color: '#A08B6D' }}>
            السعر الحالي تقريباً: 1 AED = 0.105 ر.ع (1 ر.ع ≈ 9.52 د.إ)
          </p>
        </CardContent>
      </Card>

      {/* Language */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">🌐 {t('language')}</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {(['ar', 'en'] as Lang[]).map(l => (
              <button key={l} onClick={() => handleLangChange(l)} className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${lang === l ? 'text-amber-950' : 'text-muted-foreground hover:bg-muted'}`} style={lang === l ? { background: '#E5A53C' } : {}}>
                {l === 'ar' ? 'العربية' : 'English'}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Change PIN */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">🔐 {t('changePin')}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label className="text-xs">{t('currentPin')}</Label><Input type="password" maxLength={4} value={currentPin} onChange={e => setCurrentPin(e.target.value.replace(/\D/g, ''))} className="mt-1 text-center text-lg tracking-[0.5em]" placeholder="••••" /></div>
          <div><Label className="text-xs">{t('newPin')}</Label><Input type="password" maxLength={4} value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))} className="mt-1 text-center text-lg tracking-[0.5em]" placeholder="••••" /></div>
          <div><Label className="text-xs">{t('confirmPin')}</Label><Input type="password" maxLength={4} value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))} className="mt-1 text-center text-lg tracking-[0.5em]" placeholder="••••" /></div>
          {pinMessage && <p className={`text-sm text-center ${pinError ? 'text-red-500' : 'text-green-600'}`}>{pinMessage}</p>}
          <Button onClick={handleChangePin} className="w-full" style={{ background: '#E5A53C' }}>{t('changePin')}</Button>
        </CardContent>
      </Card>

      {/* Backup */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">💾 {t('backupData')}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={handleExport} variant="outline" className="w-full gap-2">📥 {t('exportJson')}</Button>
          <div className="relative">
            <input type="file" accept=".json" onChange={handleImport} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            <Button variant="outline" className="w-full gap-2">📤 {t('importJson')}</Button>
          </div>
          {importStatus && <p className="text-sm text-center" style={{ color: importStatus.includes('restored') ? '#16a34a' : '#dc2626' }}>{importStatus}</p>}
        </CardContent>
      </Card>

      {/* Reset */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">⚠️ {t('resetAll')}</CardTitle></CardHeader>
        <CardContent><Button onClick={() => setShowResetDialog(true)} variant="destructive" className="w-full gap-2">🗑 {t('resetAll')}</Button></CardContent>
      </Card>

      {/* Seed */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">🌱 Seed Sample Data</CardTitle></CardHeader>
        <CardContent><Button onClick={handleSeed} variant="outline" className="w-full gap-2 text-xs">Load sample dishes, products & order</Button></CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardContent className="p-6 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: 'linear-gradient(135deg, #E5A53C, #D4932A)' }}>
            <svg width="32" height="32" viewBox="0 0 48 48" fill="none"><path d="M24 4C12.95 4 4 12.95 4 24s8.95 20 20 20 20-8.95 20-20S35.05 4 24 4zm0 36c-8.82 0-16-7.18-16-16S15.18 8 24 8s16 7.18 16 16-7.18 16-16 16z" fill="#FFF8ED"/><path d="M18 22c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm12 0c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm-6 10c-3.87 0-7.17-2.51-8.32-6h2.08c.97 2.25 3.18 3.83 5.75 3.75 2.49-.08 4.62-1.75 5.5-4h2.18c-1.15 3.49-4.45 6.25-8.19 6.25z" fill="#FFF8ED"/></svg>
          </div>
          <h3 className="font-bold text-lg" style={{ color: '#2C1810' }}>{t('appName')}</h3>
          <p className="text-xs mt-1" style={{ color: '#8B7355' }}>{t('appSubtitle')}</p>
          <p className="text-xs mt-2" style={{ color: '#A08B6D' }}>v2.0 - Cloud Ready</p>
        </CardContent>
      </Card>

      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent><DialogHeader><DialogTitle>{t('resetAll')}</DialogTitle></DialogHeader>
          <p className="text-sm" style={{ color: '#8B7355' }}>{t('resetConfirm')}</p>
          <p className="text-xs mt-2 text-red-500 font-medium">This action cannot be undone!</p>
          <div className="flex gap-2 justify-end mt-4"><Button variant="outline" onClick={() => setShowResetDialog(false)}>{t('no')}</Button><Button variant="destructive" onClick={handleReset}>{t('yes')}</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
