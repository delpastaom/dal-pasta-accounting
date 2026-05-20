import { useState, useEffect } from 'react';
import { t } from '@/lib/i18n';
import { DishDB, type Dish } from '@/lib/hybrid-db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function Dishes() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDish, setEditingDish] = useState<Dish | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');

  useEffect(() => { loadDishes(); }, []);

  const loadDishes = async () => {
    setLoading(true);
    try { setDishes(await DishDB.getAll()); } catch {}
    setLoading(false);
  };

  const resetForm = () => {
    setName(''); setNameEn(''); setPrice(''); setCost(''); setEditingDish(null);
  };

  const handleEdit = (dish: Dish) => {
    setEditingDish(dish);
    setName(dish.name);
    setNameEn(dish.nameEn || '');
    setPrice(dish.price.toString());
    setCost(dish.cost ? dish.cost.toString() : '');
    setShowForm(true);
  };

  const handleSave = async (andNew = false) => {
    if (!name.trim() || !price) { alert(t('fillRequired')); return; }
    const dishData = {
      name: name.trim(),
      nameEn: nameEn.trim() || undefined,
      price: parseFloat(price),
      cost: parseFloat(cost) || 0,
    };
    try {
      if (editingDish) {
        await DishDB.update(editingDish.id, dishData);
      } else {
        await DishDB.add(dishData);
      }
      await loadDishes();
      resetForm();
      if (!andNew) setShowForm(false);
    } catch {}
  };

  const handleDelete = async (id: string) => {
    try { await DishDB.delete(id); setDeleteDialog(null); await loadDishes(); } catch {}
  };

  if (loading && dishes.length === 0) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: '#E5A53C', borderTopColor: 'transparent' }} /></div>;
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="flex items-center justify-between gap-2">
        <Button
          onClick={() => { resetForm(); setShowForm(true); }}
          style={{ background: '#16a34a' }}
          className="gap-2"
        >
          <span>+</span> {t('newDish')}
        </Button>
        <p className="text-xs" style={{ color: '#8B7355' }}>
          ℹ️ {t('dishPriceNote')}
        </p>
      </div>

      {showForm && (
        <Card className="animate-fadeIn">
          <CardHeader>
            <CardTitle className="text-base">
              {editingDish ? t('editDish') : t('newDish')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">{t('dishName')} * (عربي)</Label>
                <Input value={name} onChange={e => setName(e.target.value)} className="mt-1" placeholder="مثال: مكرونة بالدجاج" />
              </div>
              <div>
                <Label className="text-xs">English Name 🍳</Label>
                <Input value={nameEn} onChange={e => setNameEn(e.target.value)} className="mt-1" placeholder="e.g. Chicken Pasta" dir="ltr" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">{t('dishPrice')} * ({t('omr')})</Label>
                <Input type="number" step="0.01" min="0" value={price} onChange={e => setPrice(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">{t('dishCost')} ({t('omr')})</Label>
                <Input type="number" step="0.01" min="0" value={cost} onChange={e => setCost(e.target.value)} className="mt-1" placeholder="اختياري" />
              </div>
            </div>
            {price && cost && parseFloat(cost) > 0 && (
              <div className="p-3 rounded-lg text-sm" style={{ background: '#F5E6C8' }}>
                <div className="flex justify-between">
                  <span style={{ color: '#8B7355' }}>هامش الربح</span>
                  <span className="font-bold" style={{ color: '#16a34a' }}>
                    {(((parseFloat(price) - parseFloat(cost)) / parseFloat(price)) * 100).toFixed(1)}%
                    &nbsp;·&nbsp;
                    {(parseFloat(price) - parseFloat(cost)).toFixed(3)} {t('omr')}
                  </span>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={() => handleSave(false)} className="flex-1" style={{ background: '#16a34a' }}>{t('save')}</Button>
              <Button onClick={() => handleSave(true)} variant="outline" className="flex-1">{t('saveAndNew')}</Button>
              <Button onClick={() => { resetForm(); setShowForm(false); }} variant="ghost">{t('cancel')}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {dishes.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm" style={{ color: '#8B7355' }}>
              {t('noDishes')}
            </CardContent>
          </Card>
        ) : (
          dishes
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name, 'ar'))
            .map(dish => (
              <Card key={dish.id} className="overflow-hidden transition-all hover:shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{dish.name}</p>
                      {dish.nameEn && (
                        <p className="text-xs truncate" style={{ color: '#2563eb' }}>🍳 {dish.nameEn}</p>
                      )}
                      {dish.cost > 0 && (
                        <p className="text-xs mt-0.5" style={{ color: '#A08B6D' }}>
                          {t('dishCost')}: {dish.cost.toFixed(3)} {t('omr')}
                          &nbsp;·&nbsp;
                          <span style={{ color: '#16a34a' }}>
                            ربح: {(dish.price - dish.cost).toFixed(3)} {t('omr')}
                          </span>
                        </p>
                      )}
                    </div>
                    <div className="text-left flex-shrink-0">
                      <p className="font-bold" style={{ color: '#E5A53C' }}>
                        {dish.price.toFixed(3)} {t('omr')}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: '1px solid rgba(229,165,60,0.15)' }}>
                    <button
                      onClick={() => handleEdit(dish)}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors hover:bg-amber-100"
                      style={{ color: '#8B6914' }}
                    >
                      {t('edit')}
                    </button>
                    <button
                      onClick={() => setDeleteDialog(dish.id)}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors hover:bg-red-50 text-red-500"
                    >
                      {t('delete')}
                    </button>
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
