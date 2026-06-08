import { useState, useEffect } from 'react';
import { t } from '@/lib/i18n';
import { ProductDB, DishDB, type Product, type Dish } from '@/lib/hybrid-db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const UNITS = ['kg', 'gram', 'liter', 'piece', 'box', 'pack', 'bottle', 'jar'];

export default function Inventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [activeTab, setActiveTab] = useState<'products' | 'dishes'>('products');
  const [showProductForm, setShowProductForm] = useState(false);
  const [showDishForm, setShowDishForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingDish, setEditingDish] = useState<Dish | null>(null);
  const [lowStockAlert, setLowStockAlert] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [productName, setProductName] = useState('');
  const [productUnit, setProductUnit] = useState('kg');
  const [currentStock, setCurrentStock] = useState('');
  const [reorderLevel, setReorderLevel] = useState('5');
  const [avgUnitPrice, setAvgUnitPrice] = useState('');
  const [productSupplier, setProductSupplier] = useState('');

  const [dishName, setDishName] = useState('');
  const [dishPrice, setDishPrice] = useState('');
  const [dishCost, setDishCost] = useState('');

  const [deleteProductDialog, setDeleteProductDialog] = useState<string | null>(null);
  const [deleteDishDialog, setDeleteDishDialog] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prods, dshs] = await Promise.all([ProductDB.getAll(), DishDB.getAll()]);
      setProducts(prods); setDishes(dshs);
      setLowStockAlert(prods.filter(p => p.currentStock <= p.reorderLevel));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const resetProductForm = () => { setProductName(''); setProductUnit('kg'); setCurrentStock(''); setReorderLevel('5'); setAvgUnitPrice(''); setProductSupplier(''); setEditingProduct(null); };
  const resetDishForm = () => { setDishName(''); setDishPrice(''); setDishCost(''); setEditingDish(null); };

  const handleSaveProduct = async () => {
    if (!productName.trim()) { alert(t('fillRequired')); return; }
    const data = { name: productName.trim(), unit: productUnit, currentStock: parseFloat(currentStock) || 0, reorderLevel: parseFloat(reorderLevel) || 5, avgUnitPrice: parseFloat(avgUnitPrice) || 0, supplier: productSupplier.trim() };
    try { if (editingProduct) { await ProductDB.update(editingProduct.id, data); } else { await ProductDB.add(data); } resetProductForm(); setShowProductForm(false); await loadData(); } catch (e: any) { alert(`⚠️ فشل الحفظ!\n${e?.message || 'خطأ غير معروف'}`); }
  };

  const handleSaveDish = async () => {
    if (!dishName.trim() || !dishPrice) { alert(t('fillRequired')); return; }
    const data = { name: dishName.trim(), price: parseFloat(dishPrice) || 0, cost: parseFloat(dishCost) || 0 };
    try { if (editingDish) { await DishDB.update(editingDish.id, data); } else { await DishDB.add(data); } resetDishForm(); setShowDishForm(false); await loadData(); } catch (e: any) { alert(`⚠️ فشل الحفظ!\n${e?.message || 'خطأ غير معروف'}`); }
  };

  const handleEditProduct = (product: Product) => { setEditingProduct(product); setProductName(product.name); setProductUnit(product.unit); setCurrentStock(product.currentStock.toString()); setReorderLevel(product.reorderLevel.toString()); setAvgUnitPrice(product.avgUnitPrice.toString()); setProductSupplier(product.supplier); setShowProductForm(true); };
  const handleEditDish = (dish: Dish) => { setEditingDish(dish); setDishName(dish.name); setDishPrice(dish.price.toString()); setDishCost(dish.cost.toString()); setShowDishForm(true); };
  const handleDeleteProduct = async (id: string) => { try { await ProductDB.delete(id); setDeleteProductDialog(null); await loadData(); } catch (e: any) { alert(`⚠️ فشل الحذف!\n${e?.message || 'خطأ غير معروف'}`); } };
  const handleDeleteDish = async (id: string) => { try { await DishDB.delete(id); setDeleteDishDialog(null); await loadData(); } catch (e: any) { alert(`⚠️ فشل الحذف!\n${e?.message || 'خطأ غير معروف'}`); } };

  if (loading && products.length === 0 && dishes.length === 0) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: '#E5A53C', borderTopColor: 'transparent' }} /></div>;
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      {lowStockAlert.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: '#fee2e2', border: '1px solid #f87171' }}>
          <div className="flex items-center gap-2 mb-2"><span>⚠️</span><p className="font-bold text-sm" style={{ color: '#991b1b' }}>{t('stockAlert')}</p></div>
          <p className="text-xs mb-2" style={{ color: '#b91c1c' }}>{t('stockAlertMsg')}</p>
          <div className="flex flex-wrap gap-2">
            {lowStockAlert.map(p => <span key={p.id} className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: '#fecaca', color: '#991b1b' }}>{p.name}: {p.currentStock} {t(p.unit as any)}</span>)}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {(['products', 'dishes'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === tab ? 'text-amber-950' : 'text-muted-foreground hover:bg-muted'}`} style={activeTab === tab ? { background: '#E5A53C' } : {}}>
            {t(tab === 'products' ? 'inventory' : 'dish')}
          </button>
        ))}
      </div>

      {activeTab === 'products' && (
        <div className="space-y-4">
          <Button onClick={() => { resetProductForm(); setShowProductForm(true); }} className="w-full gap-2" variant="outline"><span>+</span> {t('addProduct')}</Button>
          {showProductForm && (
            <Card className="animate-fadeIn">
              <CardHeader><CardTitle className="text-base">{editingProduct ? t('editProduct') : t('addProduct')}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div><Label className="text-xs">{t('productName')} *</Label><Input value={productName} onChange={e => setProductName(e.target.value)} className="mt-1" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label className="text-xs">{t('unit')}</Label>
                    <select value={productUnit} onChange={e => setProductUnit(e.target.value)} className="w-full mt-1 text-sm rounded-lg border border-input px-3 py-2 bg-background">{UNITS.map(u => <option key={u} value={u}>{t(u as any)}</option>)}</select>
                  </div>
                  <div><Label className="text-xs">{t('currentStock')}</Label><Input type="number" step="0.01" value={currentStock} onChange={e => setCurrentStock(e.target.value)} className="mt-1" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label className="text-xs">{t('reorderLevel')}</Label><Input type="number" step="0.01" value={reorderLevel} onChange={e => setReorderLevel(e.target.value)} className="mt-1" /></div>
                  <div><Label className="text-xs">{t('unitPrice')}</Label><Input type="number" step="0.01" value={avgUnitPrice} onChange={e => setAvgUnitPrice(e.target.value)} className="mt-1" /></div>
                </div>
                <div><Label className="text-xs">{t('supplier')}</Label><Input value={productSupplier} onChange={e => setProductSupplier(e.target.value)} className="mt-1" /></div>
                <div className="flex gap-2">
                  <Button onClick={handleSaveProduct} className="flex-1" style={{ background: '#E5A53C' }}>{t('save')}</Button>
                  <Button onClick={() => { resetProductForm(); setShowProductForm(false); }} variant="ghost">{t('cancel')}</Button>
                </div>
              </CardContent>
            </Card>
          )}
          <div className="space-y-3">
            {products.length === 0 ? (<Card><CardContent className="p-6 text-center text-sm" style={{ color: '#8B7355' }}>{t('noProducts')}</CardContent></Card>) : (
              products.map(product => {
                const isLow = product.currentStock <= product.reorderLevel;
                return (<Card key={product.id} className={`overflow-hidden transition-all hover:shadow-md ${isLow ? 'ring-1 ring-red-300' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2"><p className="font-bold text-sm">{product.name}</p>{isLow && <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">{t('lowStock')}</span>}</div>
                        <p className="text-xs mt-1" style={{ color: '#8B7355' }}>{t('currentStock')}: {product.currentStock} {t(product.unit as any)} · {t('reorderLevel')}: {product.reorderLevel}</p>
                        <p className="text-xs" style={{ color: '#A08B6D' }}>{product.supplier} · {product.avgUnitPrice.toFixed(2)} {t('omr')}/{t(product.unit as any)}</p>
                      </div>
                      <div className="flex gap-1 ml-2">
                        <button onClick={() => handleEditProduct(product)} className="p-1.5 rounded-lg hover:bg-amber-100 transition-colors" style={{ color: '#8B6914' }}>✏️</button>
                        <button onClick={() => setDeleteProductDialog(product.id)} className="p-1.5 rounded-lg hover:bg-red-100 transition-colors" style={{ color: '#dc2626' }}>🗑</button>
                      </div>
                    </div>
                  </CardContent>
                </Card>);
              })
            )}
          </div>
        </div>
      )}

      {activeTab === 'dishes' && (
        <div className="space-y-4">
          <Button onClick={() => { resetDishForm(); setShowDishForm(true); }} className="w-full gap-2" variant="outline"><span>+</span> {t('addDish')}</Button>
          {showDishForm && (
            <Card className="animate-fadeIn">
              <CardHeader><CardTitle className="text-base">{editingDish ? t('editProduct') : t('addDish')}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div><Label className="text-xs">{t('dishName')} *</Label><Input value={dishName} onChange={e => setDishName(e.target.value)} className="mt-1" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label className="text-xs">{t('dishPrice')} *</Label><Input type="number" step="0.01" value={dishPrice} onChange={e => setDishPrice(e.target.value)} className="mt-1" /></div>
                  <div><Label className="text-xs">{t('dishCost')}</Label><Input type="number" step="0.01" value={dishCost} onChange={e => setDishCost(e.target.value)} className="mt-1" /></div>
                </div>
                {dishPrice && dishCost && (
                  <div className="p-2 rounded-lg text-center text-sm" style={{ background: '#F5E6C8' }}>
                    <span style={{ color: '#8B6914' }}>{t('profit')}: </span>
                    <span className="font-bold" style={{ color: '#16a34a' }}>{(parseFloat(dishPrice) - parseFloat(dishCost)).toFixed(2)} {t('omr')}</span>
                    <span style={{ color: '#8B6914' }}> ({((1 - parseFloat(dishCost) / parseFloat(dishPrice)) * 100).toFixed(0)}%)</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button onClick={handleSaveDish} className="flex-1" style={{ background: '#E5A53C' }}>{t('save')}</Button>
                  <Button onClick={() => { resetDishForm(); setShowDishForm(false); }} variant="ghost">{t('cancel')}</Button>
                </div>
              </CardContent>
            </Card>
          )}
          <div className="space-y-3">
            {dishes.length === 0 ? (<Card><CardContent className="p-6 text-center text-sm" style={{ color: '#8B7355' }}>No dishes found</CardContent></Card>) : (
              dishes.map(dish => (<Card key={dish.id} className="overflow-hidden transition-all hover:shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-bold text-sm">{dish.name}</p>
                      <p className="text-xs mt-1" style={{ color: '#8B7355' }}>{t('dishPrice')}: {dish.price.toFixed(2)} {t('omr')} · {t('dishCost')}: {dish.cost.toFixed(2)} {t('omr')}</p>
                      <p className="text-xs font-medium" style={{ color: '#16a34a' }}>{t('profit')}: {(dish.price - dish.cost).toFixed(2)} {t('omr')} ({dish.price > 0 ? ((1 - dish.cost / dish.price) * 100).toFixed(0) : 0}%)</p>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <button onClick={() => handleEditDish(dish)} className="p-1.5 rounded-lg hover:bg-amber-100 transition-colors" style={{ color: '#8B6914' }}>✏️</button>
                      <button onClick={() => setDeleteDishDialog(dish.id)} className="p-1.5 rounded-lg hover:bg-red-100 transition-colors" style={{ color: '#dc2626' }}>🗑</button>
                    </div>
                  </div>
                </CardContent>
              </Card>))
            )}
          </div>
        </div>
      )}

      <Dialog open={!!deleteProductDialog} onOpenChange={() => setDeleteProductDialog(null)}>
        <DialogContent><DialogHeader><DialogTitle>{t('delete')}</DialogTitle></DialogHeader>
          <p className="text-sm" style={{ color: '#8B7355' }}>{t('resetConfirm')}</p>
          <div className="flex gap-2 justify-end mt-4"><Button variant="outline" onClick={() => setDeleteProductDialog(null)}>{t('no')}</Button><Button variant="destructive" onClick={() => deleteProductDialog && handleDeleteProduct(deleteProductDialog)}>{t('yes')}</Button></div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteDishDialog} onOpenChange={() => setDeleteDishDialog(null)}>
        <DialogContent><DialogHeader><DialogTitle>{t('delete')}</DialogTitle></DialogHeader>
          <p className="text-sm" style={{ color: '#8B7355' }}>{t('resetConfirm')}</p>
          <div className="flex gap-2 justify-end mt-4"><Button variant="outline" onClick={() => setDeleteDishDialog(null)}>{t('no')}</Button><Button variant="destructive" onClick={() => deleteDishDialog && handleDeleteDish(deleteDishDialog)}>{t('yes')}</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
