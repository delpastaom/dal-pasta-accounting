import { useState, useEffect, useRef } from 'react';
import { t } from '@/lib/i18n';
import { ExpenseDB, ReceiptDB, SettingsDB, type Expense } from '@/lib/hybrid-db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const EXPENSE_CATEGORIES = ['monthly','operational','maintenance','advertising','development','electricity','water','internet','gas','fuel','salary','courier','groceries','packaging','other'];

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [filterCategory, setFilterCategory] = useState('all');
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [category, setCategory] = useState('operational');
  const [amount, setAmount] = useState('');
  const [expCurrency, setExpCurrency] = useState<'OMR' | 'AED'>('OMR');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [receipt, setReceipt] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);

  useEffect(() => { loadExpenses(); }, []);

  const loadExpenses = async () => {
    setLoading(true);
    try { setExpenses(await ExpenseDB.getAll()); } catch (e) {}
    setLoading(false);
  };

  const resetForm = () => {
    setCategory('operational'); setAmount(''); setExpCurrency('OMR');
    setDate(new Date().toISOString().split('T')[0]);
    setDescription(''); setReceipt(null); setEditingExpense(null);
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense); setCategory(expense.category); setAmount(expense.amount.toString());
    setDate(expense.date); setDescription(expense.description); setReceipt(expense.receipt); setShowForm(true);
  };

  const handleSave = async (andNew = false) => {
    if (!category || !amount || !date) { alert(t('fillRequired')); return; }
    const aedRate = SettingsDB.get().aedRate || 0.105;
    const rawAmount = parseFloat(amount);
    const finalAmount = expCurrency === 'AED' ? rawAmount * aedRate : rawAmount;
    const aedNote = expCurrency === 'AED' ? `${rawAmount} د.إ - ` : '';
    const finalDescription = `${aedNote}${description.trim()}`;
    const expenseData = { category, amount: finalAmount, date, description: finalDescription, receipt };
    try {
      if (editingExpense) { await ExpenseDB.update(editingExpense.id, expenseData); }
      else { await ExpenseDB.add(expenseData); }
      await loadExpenses();
      if (andNew) { resetForm(); } else { resetForm(); setShowForm(false); }
    } catch (e) {}
  };

  const handleDelete = async (id: string) => {
    const expense = await ExpenseDB.getById(id);
    if (expense?.receipt) ReceiptDB.delete(expense.receipt);
    try { await ExpenseDB.delete(id); setDeleteDialog(null); await loadExpenses(); } catch (e) {}
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { const id = `receipt_${Date.now()}`; ReceiptDB.save(id, reader.result as string); setReceipt(id); };
    reader.readAsDataURL(file);
  };

  const viewReceipt = (receiptId: string | null) => { if (!receiptId) return; const data = ReceiptDB.get(receiptId); if (data) setReceiptPreview(data); };

  const filteredExpenses = expenses.filter(e => filterCategory === 'all' || e.category === filterCategory);

  if (loading && expenses.length === 0) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: '#E5A53C', borderTopColor: 'transparent' }} /></div>;
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="flex items-center justify-between">
        <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-2" style={{ background: '#dc2626' }}><span>+</span> {t('newExpense')}</Button>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="text-sm rounded-lg border border-input px-3 py-2 bg-background">
          <option value="all">{t('all')}</option>
          {EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{t(cat as any)}</option>)}
        </select>
      </div>

      {showForm && (
        <Card className="animate-fadeIn">
          <CardHeader><CardTitle className="text-base">{editingExpense ? t('editExpense') : t('newExpense')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label className="text-xs">{t('category')} *</Label>
                <select value={category} onChange={e => setCategory(e.target.value)} className="w-full mt-1 text-sm rounded-lg border border-input px-3 py-2 bg-background">
                  {EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{t(cat as any)}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">{t('amount')} *</Label>
                <div className="flex gap-1 mt-1">
                  <Input type="number" step="0.1" min="0" value={amount} onChange={e => setAmount(e.target.value)} className="flex-1" />
                  <div className="flex rounded-lg border border-input overflow-hidden text-xs font-medium">
                    <button type="button" onClick={() => setExpCurrency('OMR')} className="px-2 py-1 transition-colors" style={expCurrency === 'OMR' ? { background: '#E5A53C', color: '#fff' } : { color: '#8B7355' }}>ر.ع</button>
                    <button type="button" onClick={() => setExpCurrency('AED')} className="px-2 py-1 transition-colors" style={expCurrency === 'AED' ? { background: '#3ECF8E', color: '#fff' } : { color: '#8B7355' }}>د.إ</button>
                  </div>
                </div>
                {expCurrency === 'AED' && amount && parseFloat(amount) > 0 && (
                  <p className="text-xs mt-1" style={{ color: '#3ECF8E' }}>
                    ≈ {(parseFloat(amount) * (SettingsDB.get().aedRate || 0.105)).toFixed(3)} ر.ع
                  </p>
                )}
              </div>
            </div>
            <div><Label className="text-xs">{t('date')} *</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1" /></div>
            <div><Label className="text-xs">{t('description')}</Label><Input value={description} onChange={e => setDescription(e.target.value)} className="mt-1" /></div>
            <div>
              <Label className="text-xs">{t('receipt')}</Label>
              <div className="flex gap-2 mt-1">
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1 text-xs">📷 {t('uploadImage')}</Button>
                {receipt && <Button type="button" variant="ghost" size="sm" onClick={() => viewReceipt(receipt)} className="text-xs gap-1">👁 {t('viewReceipt')}</Button>}
              </div>
              {receipt && <p className="text-xs mt-1" style={{ color: '#16a34a' }}>✓ {t('receiptAttached')}</p>}
            </div>
            <div className="flex gap-2">
              <Button onClick={() => handleSave(false)} className="flex-1" style={{ background: '#dc2626' }}>{t('save')}</Button>
              <Button onClick={() => handleSave(true)} variant="outline" className="flex-1">{t('saveAndNew')}</Button>
              <Button onClick={() => { resetForm(); setShowForm(false); }} variant="ghost">{t('cancel')}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {filteredExpenses.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-sm" style={{ color: '#8B7355' }}>{t('noExpenses')}</CardContent></Card>
        ) : (
          filteredExpenses.map(expense => (
            <Card key={expense.id} className="overflow-hidden transition-all hover:shadow-md">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm">{t(expense.category as any)}</p>
                      {expense.receipt && <button onClick={() => viewReceipt(expense.receipt)} className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">📎 {t('receipt')}</button>}
                    </div>
                    <p className="text-xs mt-1" style={{ color: '#8B7355' }}>{expense.description}</p>
                    <p className="text-xs" style={{ color: '#A08B6D' }}>{expense.date}</p>
                  </div>
                  <div className="text-right"><p className="font-bold text-sm" style={{ color: '#dc2626' }}>{expense.amount.toFixed(2)} {t('omr')}</p></div>
                </div>
                <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: '1px solid rgba(229,165,60,0.15)' }}>
                  <button onClick={() => handleEdit(expense)} className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors hover:bg-amber-100" style={{ color: '#8B6914' }}>{t('edit')}</button>
                  <button onClick={() => setDeleteDialog(expense.id)} className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors hover:bg-red-50 text-red-500">{t('delete')}</button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={!!receiptPreview} onOpenChange={() => setReceiptPreview(null)}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>{t('receipt')}</DialogTitle></DialogHeader>
          {receiptPreview && <img src={receiptPreview} alt="Receipt" className="w-full rounded-lg" />}
        </DialogContent>
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
