/* eslint-disable @typescript-eslint/no-explicit-any */
import { getSupabase, isSupabaseConnected } from './supabase';
import * as localDB from './db';
import type { OrderItem } from './db';

export type { OrderItem };

export interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  area: string;
  orderDate: string;
  deliveryDate: string;
  type: 'regular' | 'advance';
  items: OrderItem[];
  deliveryFee: number;
  deposit: number;
  total: number;
  status: 'pending' | 'completed' | 'cancelled';
  notes: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  date: string;
  description: string;
  receipt: string | null;
  createdAt: string;
}

export interface Purchase {
  id: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  supplier: string;
  date: string;
  receipt: string | null;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  reorderLevel: number;
  avgUnitPrice: number;
  supplier: string;
  createdAt: string;
}

export interface Dish {
  id: string;
  name: string;
  nameEn?: string;
  price: number;
  cost: number;
  createdAt: string;
}

export interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
  orders: number;
}

function rowToOrder(row: any): Order {
  return {
    id: row.id,
    customerName: row.customer_name || '',
    customerPhone: row.customer_phone || '',
    area: row.area || '',
    orderDate: row.order_date || '',
    deliveryDate: row.delivery_date || '',
    type: row.type || 'regular',
    items: (row.items || []) as OrderItem[],
    deliveryFee: row.delivery_fee || 0,
    deposit: row.deposit || 0,
    total: row.total || 0,
    status: row.status || 'pending',
    notes: row.notes || '',
    createdAt: row.created_at || new Date().toISOString(),
  };
}

function rowToExpense(row: any): Expense {
  return {
    id: row.id,
    category: row.category || '',
    amount: row.amount || 0,
    date: row.date || '',
    description: row.description || '',
    receipt: row.receipt_url || null,
    createdAt: row.created_at || new Date().toISOString(),
  };
}

function rowToProduct(row: any): Product {
  return {
    id: row.id,
    name: row.name || '',
    unit: row.unit || '',
    currentStock: row.current_stock || 0,
    reorderLevel: row.reorder_level || 0,
    avgUnitPrice: row.avg_unit_price || 0,
    supplier: row.supplier || '',
    createdAt: row.created_at || new Date().toISOString(),
  };
}

function rowToDish(row: any): Dish {
  return {
    id: row.id,
    name: row.name || '',
    nameEn: row.name_en || undefined,
    price: row.price || 0,
    cost: row.cost || 0,
    createdAt: row.created_at || new Date().toISOString(),
  };
}

function rowToPurchase(row: any): Purchase {
  return {
    id: row.id,
    productName: row.product_name || '',
    quantity: row.quantity || 0,
    unit: row.unit || '',
    unitPrice: row.unit_price || 0,
    total: row.total || 0,
    supplier: row.supplier || '',
    date: row.date || '',
    receipt: row.receipt_url || null,
    createdAt: row.created_at || new Date().toISOString(),
  };
}

// ==================== SYNC STATUS ====================
export function isCloudConnected(): boolean {
  return isSupabaseConnected();
}

// ==================== ORDERS ====================
export const OrderDB = {
  async getAll(): Promise<Order[]> {
    if (isSupabaseConnected()) {
      const sb = getSupabase();
      if (sb) {
        const { data, error } = await sb.from('orders').select('*').order('delivery_date', { ascending: false }).order('created_at', { ascending: false });
        if (!error && data) return (data as any[]).map(rowToOrder);
      }
    }
    return localDB.OrderDB.getAll();
  },

  async add(order: Omit<Order, 'id' | 'createdAt'>): Promise<Order> {
    if (isSupabaseConnected()) {
      const sb = getSupabase();
      if (sb) {
        const { data, error } = await sb.from('orders').insert({
          customer_name: order.customerName,
          customer_phone: order.customerPhone,
          area: order.area,
          order_date: order.orderDate,
          delivery_date: order.deliveryDate,
          type: order.type,
          items: order.items,
          delivery_fee: order.deliveryFee,
          deposit: order.deposit,
          total: order.total,
          status: order.status,
          notes: order.notes,
        }).select().single();
        if (!error && data) return rowToOrder(data);
      }
    }
    return localDB.OrderDB.add(order);
  },

  async update(id: string, order: Partial<Order>): Promise<Order | null> {
    if (isSupabaseConnected()) {
      const sb = getSupabase();
      if (sb) {
        const updateData: any = {};
        if (order.customerName !== undefined) updateData.customer_name = order.customerName;
        if (order.customerPhone !== undefined) updateData.customer_phone = order.customerPhone;
        if (order.area !== undefined) updateData.area = order.area;
        if (order.orderDate !== undefined) updateData.order_date = order.orderDate;
        if (order.deliveryDate !== undefined) updateData.delivery_date = order.deliveryDate;
        if (order.type !== undefined) updateData.type = order.type;
        if (order.items !== undefined) updateData.items = order.items;
        if (order.deliveryFee !== undefined) updateData.delivery_fee = order.deliveryFee;
        if (order.deposit !== undefined) updateData.deposit = order.deposit;
        if (order.total !== undefined) updateData.total = order.total;
        if (order.status !== undefined) updateData.status = order.status;
        if (order.notes !== undefined) updateData.notes = order.notes;
        const { error } = await sb.from('orders').update(updateData).eq('id', id);
        if (!error) { const all = await this.getAll(); return all.find(o => o.id === id) || null; }
      }
    }
    return localDB.OrderDB.update(id, order);
  },

  async delete(id: string): Promise<boolean> {
    if (isSupabaseConnected()) {
      const sb = getSupabase();
      if (sb) { const { error } = await sb.from('orders').delete().eq('id', id); if (!error) return true; }
    }
    return localDB.OrderDB.delete(id);
  },

  async getById(id: string): Promise<Order | undefined> {
    const all = await this.getAll();
    return all.find(o => o.id === id);
  },

  async getToday(): Promise<Order[]> {
    const today = new Date().toISOString().split('T')[0];
    const all = await this.getAll();
    return all.filter(o => o.orderDate === today);
  },

  async getPendingAdvance(): Promise<Order[]> {
    const all = await this.getAll();
    return all.filter(o => o.type === 'advance' && o.status === 'pending');
  },
};

// ==================== EXPENSES ====================
export const ExpenseDB = {
  async getAll(): Promise<Expense[]> {
    if (isSupabaseConnected()) {
      const sb = getSupabase();
      if (sb) {
        const { data, error } = await sb.from('expenses').select('*').order('date', { ascending: false });
        if (!error && data) return (data as any[]).map(rowToExpense);
      }
    }
    return localDB.ExpenseDB.getAll();
  },

  async add(expense: Omit<Expense, 'id' | 'createdAt'>): Promise<Expense> {
    if (isSupabaseConnected()) {
      const sb = getSupabase();
      if (sb) {
        const { data, error } = await sb.from('expenses').insert({
          category: expense.category, amount: expense.amount, date: expense.date,
          description: expense.description, receipt_url: expense.receipt,
        }).select().single();
        if (!error && data) return rowToExpense(data);
      }
    }
    return localDB.ExpenseDB.add(expense);
  },

  async update(id: string, expense: Partial<Expense>): Promise<Expense | null> {
    if (isSupabaseConnected()) {
      const sb = getSupabase();
      if (sb) {
        const updateData: any = {};
        if (expense.category !== undefined) updateData.category = expense.category;
        if (expense.amount !== undefined) updateData.amount = expense.amount;
        if (expense.date !== undefined) updateData.date = expense.date;
        if (expense.description !== undefined) updateData.description = expense.description;
        if (expense.receipt !== undefined) updateData.receipt_url = expense.receipt;
        const { error } = await sb.from('expenses').update(updateData).eq('id', id);
        if (!error) { const all = await this.getAll(); return all.find(e => e.id === id) || null; }
      }
    }
    return localDB.ExpenseDB.update(id, expense);
  },

  async delete(id: string): Promise<boolean> {
    if (isSupabaseConnected()) {
      const sb = getSupabase();
      if (sb) { const { error } = await sb.from('expenses').delete().eq('id', id); if (!error) return true; }
    }
    return localDB.ExpenseDB.delete(id);
  },

  async getById(id: string): Promise<Expense | undefined> {
    const all = await this.getAll();
    return all.find(e => e.id === id);
  },
};

// ==================== PRODUCTS ====================
export const ProductDB = {
  async getAll(): Promise<Product[]> {
    if (isSupabaseConnected()) {
      const sb = getSupabase();
      if (sb) {
        const { data, error } = await sb.from('products').select('*');
        if (!error && data) return (data as any[]).map(rowToProduct);
      }
    }
    return localDB.ProductDB.getAll();
  },

  async add(product: Omit<Product, 'id' | 'createdAt'>): Promise<Product> {
    if (isSupabaseConnected()) {
      const sb = getSupabase();
      if (sb) {
        const { data, error } = await sb.from('products').insert({
          name: product.name, unit: product.unit, current_stock: product.currentStock,
          reorder_level: product.reorderLevel, avg_unit_price: product.avgUnitPrice, supplier: product.supplier,
        }).select().single();
        if (!error && data) return rowToProduct(data);
      }
    }
    return localDB.ProductDB.add(product);
  },

  async update(id: string, product: Partial<Product>): Promise<Product | null> {
    if (isSupabaseConnected()) {
      const sb = getSupabase();
      if (sb) {
        const updateData: any = {};
        if (product.name !== undefined) updateData.name = product.name;
        if (product.unit !== undefined) updateData.unit = product.unit;
        if (product.currentStock !== undefined) updateData.current_stock = product.currentStock;
        if (product.reorderLevel !== undefined) updateData.reorder_level = product.reorderLevel;
        if (product.avgUnitPrice !== undefined) updateData.avg_unit_price = product.avgUnitPrice;
        if (product.supplier !== undefined) updateData.supplier = product.supplier;
        const { error } = await sb.from('products').update(updateData).eq('id', id);
        if (!error) { const all = await this.getAll(); return all.find(p => p.id === id) || null; }
      }
    }
    return localDB.ProductDB.update(id, product);
  },

  async delete(id: string): Promise<boolean> {
    if (isSupabaseConnected()) {
      const sb = getSupabase();
      if (sb) { const { error } = await sb.from('products').delete().eq('id', id); if (!error) return true; }
    }
    return localDB.ProductDB.delete(id);
  },

  async getLowStock(): Promise<Product[]> {
    const all = await this.getAll();
    return all.filter(p => p.currentStock <= p.reorderLevel);
  },
};

// ==================== DISHES ====================
export const DishDB = {
  async getAll(): Promise<Dish[]> {
    if (isSupabaseConnected()) {
      const sb = getSupabase();
      if (sb) {
        const { data, error } = await sb.from('dishes').select('*');
        if (!error && data) return (data as any[]).map(rowToDish);
      }
    }
    return localDB.DishDB.getAll();
  },

  async add(dish: Omit<Dish, 'id' | 'createdAt'>): Promise<Dish> {
    if (isSupabaseConnected()) {
      const sb = getSupabase();
      if (sb) {
        const insertData: any = { name: dish.name, price: dish.price, cost: dish.cost };
        if (dish.nameEn) insertData.name_en = dish.nameEn;
        const { data, error } = await sb.from('dishes').insert(insertData).select().single();
        if (!error && data) return rowToDish(data);
      }
    }
    return localDB.DishDB.add(dish);
  },

  async update(id: string, dish: Partial<Dish>): Promise<Dish | null> {
    if (isSupabaseConnected()) {
      const sb = getSupabase();
      if (sb) {
        const updateData: any = {};
        if (dish.name !== undefined) updateData.name = dish.name;
        if (dish.nameEn !== undefined) updateData.name_en = dish.nameEn;
        if (dish.price !== undefined) updateData.price = dish.price;
        if (dish.cost !== undefined) updateData.cost = dish.cost;
        const { error } = await sb.from('dishes').update(updateData).eq('id', id);
        if (!error) { const all = await this.getAll(); return all.find(d => d.id === id) || null; }
      }
    }
    return localDB.DishDB.update(id, dish);
  },

  async delete(id: string): Promise<boolean> {
    if (isSupabaseConnected()) {
      const sb = getSupabase();
      if (sb) { const { error } = await sb.from('dishes').delete().eq('id', id); if (!error) return true; }
    }
    return localDB.DishDB.delete(id);
  },
};

// ==================== PURCHASES ====================
export const PurchaseDB = {
  async getAll(): Promise<Purchase[]> {
    if (isSupabaseConnected()) {
      const sb = getSupabase();
      if (sb) {
        const { data, error } = await sb.from('purchases').select('*').order('date', { ascending: false });
        if (!error && data) return (data as any[]).map(rowToPurchase);
      }
    }
    return localDB.PurchaseDB.getAll();
  },

  async add(purchase: Omit<Purchase, 'id' | 'createdAt'>): Promise<Purchase> {
    if (isSupabaseConnected()) {
      const sb = getSupabase();
      if (sb) {
        const { data, error } = await sb.from('purchases').insert({
          product_name: purchase.productName, quantity: purchase.quantity, unit: purchase.unit,
          unit_price: purchase.unitPrice, total: purchase.total, supplier: purchase.supplier,
          date: purchase.date, receipt_url: purchase.receipt,
        }).select().single();
        if (!error && data) {
          const row = rowToPurchase(data);
          const products = await ProductDB.getAll();
          const existing = products.find(p => p.name.toLowerCase() === row.productName.toLowerCase());
          if (existing) {
            await ProductDB.update(existing.id, { currentStock: existing.currentStock + row.quantity, avgUnitPrice: (existing.avgUnitPrice + row.unitPrice) / 2 });
          } else {
            await ProductDB.add({ name: row.productName, unit: row.unit, currentStock: row.quantity, reorderLevel: 5, avgUnitPrice: row.unitPrice, supplier: row.supplier });
          }
          return row;
        }
      }
    }
    return localDB.PurchaseDB.add(purchase);
  },

  async update(id: string, purchase: Partial<Purchase>): Promise<Purchase | null> {
    if (isSupabaseConnected()) {
      const sb = getSupabase();
      if (sb) {
        const updateData: any = {};
        if (purchase.productName !== undefined) updateData.product_name = purchase.productName;
        if (purchase.quantity !== undefined) updateData.quantity = purchase.quantity;
        if (purchase.unit !== undefined) updateData.unit = purchase.unit;
        if (purchase.unitPrice !== undefined) updateData.unit_price = purchase.unitPrice;
        if (purchase.total !== undefined) updateData.total = purchase.total;
        if (purchase.supplier !== undefined) updateData.supplier = purchase.supplier;
        if (purchase.date !== undefined) updateData.date = purchase.date;
        if (purchase.receipt !== undefined) updateData.receipt_url = purchase.receipt;
        const { error } = await sb.from('purchases').update(updateData).eq('id', id);
        if (!error) { const all = await this.getAll(); return all.find(p => p.id === id) || null; }
      }
    }
    return localDB.PurchaseDB.update(id, purchase);
  },

  async delete(id: string): Promise<boolean> {
    if (isSupabaseConnected()) {
      const sb = getSupabase();
      if (sb) { const { error } = await sb.from('purchases').delete().eq('id', id); if (!error) return true; }
    }
    return localDB.PurchaseDB.delete(id);
  },

  async getById(id: string): Promise<Purchase | undefined> {
    const all = await this.getAll();
    return all.find(p => p.id === id);
  },
};

// ==================== REPORTS ====================
export const ReportDB = {
  async getMonthlyData(): Promise<MonthlyData[]> {
    const orders = (await OrderDB.getAll()).filter(o => o.status === 'completed');
    const expenses = await ExpenseDB.getAll();
    const months: Record<string, MonthlyData> = {};
    orders.forEach(o => {
      const month = o.deliveryDate.substring(0, 7);
      if (!months[month]) months[month] = { month, income: 0, expenses: 0, orders: 0 };
      months[month].income += o.total; months[month].orders += 1;
    });
    expenses.forEach(e => {
      const month = e.date.substring(0, 7);
      if (!months[month]) months[month] = { month, income: 0, expenses: 0, orders: 0 };
      months[month].expenses += e.amount;
    });
    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month));
  },

  async getCategoryBreakdown(month?: string) {
    const expenses = await ExpenseDB.getAll();
    const filtered = month ? expenses.filter(e => e.date.startsWith(month)) : expenses;
    const categories: Record<string, number> = {};
    let total = 0;
    filtered.forEach(e => { categories[e.category] = (categories[e.category] || 0) + e.amount; total += e.amount; });
    return Object.entries(categories).map(([category, amount]) => ({
      category, amount, percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
    })).sort((a, b) => b.amount - a.amount);
  },

  async getTopDishes() {
    const orders = (await OrderDB.getAll()).filter(o => o.status === 'completed');
    const dishes: Record<string, { count: number; revenue: number }> = {};
    orders.forEach(o => {
      o.items.forEach(item => {
        if (!dishes[item.dishName]) dishes[item.dishName] = { count: 0, revenue: 0 };
        dishes[item.dishName].count += item.quantity;
        dishes[item.dishName].revenue += item.price * item.quantity;
      });
    });
    return Object.entries(dishes).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.count - a.count).slice(0, 10);
  },

  async getThisMonthStats() {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const orders = (await OrderDB.getAll()).filter(o => o.deliveryDate.startsWith(month) && o.status === 'completed');
    const expenses = (await ExpenseDB.getAll()).filter(e => e.date.startsWith(month));
    const income = orders.reduce((s, o) => s + o.total, 0);
    return { income, expenses: expenses.reduce((s, e) => s + e.amount, 0), orders: orders.length, avgOrder: orders.length > 0 ? income / orders.length : 0 };
  },
};

// ==================== SETTINGS ====================
export const SettingsDB = {
  get() {
    const defaults = { pin: '1234', currency: 'OMR', lang: 'ar' as const };
    try { const data = localStorage.getItem('dp_settings'); return data ? { ...defaults, ...JSON.parse(data) } : defaults; } catch { return defaults; }
  },
  set(settings: Partial<{ pin: string; currency: string; lang: 'ar' | 'en' }>) {
    localStorage.setItem('dp_settings', JSON.stringify({ ...this.get(), ...settings }));
  },
  verifyPin(pin: string): boolean { return this.get().pin === pin; },
  changePin(currentPin: string, newPin: string): boolean {
    if (this.get().pin !== currentPin) return false;
    this.set({ pin: newPin }); return true;
  },
};

// ==================== RECEIPTS ====================
const RECEIPT_PREFIX = 'dp_receipts_';
export const ReceiptDB = {
  save(id: string, base64: string) { localStorage.setItem(RECEIPT_PREFIX + id, base64); },
  get(id: string): string | null { return localStorage.getItem(RECEIPT_PREFIX + id); },
  delete(id: string) { localStorage.removeItem(RECEIPT_PREFIX + id); },
};

// ==================== BACKUP & RESTORE ====================
export async function exportAll(): Promise<string> {
  const data = {
    orders: await OrderDB.getAll(), expenses: await ExpenseDB.getAll(), purchases: await PurchaseDB.getAll(),
    products: await ProductDB.getAll(), dishes: await DishDB.getAll(), settings: SettingsDB.get(),
    exportDate: new Date().toISOString(),
  };
  return JSON.stringify(data, null, 2);
}

export function importAll(json: string): boolean {
  try {
    const data = JSON.parse(json);
    if (data.orders) localStorage.setItem('dp_orders', JSON.stringify(data.orders));
    if (data.expenses) localStorage.setItem('dp_expenses', JSON.stringify(data.expenses));
    if (data.purchases) localStorage.setItem('dp_purchases', JSON.stringify(data.purchases));
    if (data.products) localStorage.setItem('dp_products', JSON.stringify(data.products));
    if (data.dishes) localStorage.setItem('dp_dishes', JSON.stringify(data.dishes));
    return true;
  } catch { return false; }
}

// ==================== CUSTOMERS ====================
export interface Customer {
  id: string;
  name: string;
  phone: string;
  area: string;
  notes: string;
  createdAt: string;
}

export const CustomerDB = {
  async getAll(): Promise<Customer[]> {
    if (isSupabaseConnected()) {
      const sb = getSupabase();
      if (sb) {
        const { data, error } = await sb.from('customers').select('*').order('name');
        if (!error && data) return data as Customer[];
      }
    }
    return JSON.parse(localStorage.getItem('dp_customers') || '[]');
  },
  async add(c: Omit<Customer, 'id' | 'createdAt'>): Promise<Customer> {
    const newC: Customer = { ...c, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    if (isSupabaseConnected()) {
      const sb = getSupabase();
      if (sb) { await sb.from('customers').insert({ ...c, created_at: newC.createdAt }); }
    }
    const all = JSON.parse(localStorage.getItem('dp_customers') || '[]');
    localStorage.setItem('dp_customers', JSON.stringify([...all, newC]));
    return newC;
  },
  async update(id: string, c: Partial<Customer>): Promise<void> {
    if (isSupabaseConnected()) {
      const sb = getSupabase();
      if (sb) { await sb.from('customers').update(c).eq('id', id); }
    }
    const all: Customer[] = JSON.parse(localStorage.getItem('dp_customers') || '[]');
    localStorage.setItem('dp_customers', JSON.stringify(all.map(x => x.id === id ? { ...x, ...c } : x)));
  },
  async delete(id: string): Promise<void> {
    if (isSupabaseConnected()) {
      const sb = getSupabase();
      if (sb) { await sb.from('customers').delete().eq('id', id); }
    }
    const all: Customer[] = JSON.parse(localStorage.getItem('dp_customers') || '[]');
    localStorage.setItem('dp_customers', JSON.stringify(all.filter(x => x.id !== id)));
  },
};

export function resetAll() {
  ['dp_orders', 'dp_expenses', 'dp_purchases', 'dp_products', 'dp_dishes', 'dp_settings'].forEach(k => localStorage.removeItem(k));
  for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k?.startsWith(RECEIPT_PREFIX)) localStorage.removeItem(k); }
}

// ==================== SEED DATA ====================
export async function seedData() {
  const existing = await OrderDB.getAll();
  if (existing.length > 0) return;

  const sampleProducts = [
    { name: 'Pasta', unit: 'kg', currentStock: 15, reorderLevel: 5, avgUnitPrice: 1.2, supplier: 'Carrefour' },
    { name: 'Chicken Breast', unit: 'kg', currentStock: 8, reorderLevel: 3, avgUnitPrice: 2.5, supplier: 'Lulu' },
    { name: 'Cheese', unit: 'kg', currentStock: 4, reorderLevel: 2, avgUnitPrice: 3.0, supplier: 'Carrefour' },
    { name: 'Tomato Sauce', unit: 'bottle', currentStock: 6, reorderLevel: 3, avgUnitPrice: 1.5, supplier: 'Lulu' },
    { name: 'Olive Oil', unit: 'bottle', currentStock: 3, reorderLevel: 2, avgUnitPrice: 4.0, supplier: 'Carrefour' },
    { name: 'Garlic', unit: 'kg', currentStock: 2, reorderLevel: 1, avgUnitPrice: 1.0, supplier: 'Market' },
    { name: 'Mushrooms', unit: 'kg', currentStock: 1, reorderLevel: 2, avgUnitPrice: 3.5, supplier: 'Lulu' },
    { name: 'Cream', unit: 'pack', currentStock: 5, reorderLevel: 3, avgUnitPrice: 2.0, supplier: 'Carrefour' },
  ];
  for (const p of sampleProducts) await ProductDB.add(p);

  const today = new Date().toISOString().split('T')[0];
  await OrderDB.add({
    customerName: 'فاطمة', customerPhone: '96891234567', area: 'الخوير',
    orderDate: today, deliveryDate: today, type: 'regular',
    items: [{ dishName: 'Chicken Alfredo', quantity: 2, price: 4.5, cost: 2.5 }, { dishName: 'Garlic Bread', quantity: 1, price: 1.5, cost: 0.5 }],
    deliveryFee: 1.0, deposit: 0, total: 11.5, status: 'completed', notes: 'عميلة دائمة',
  });

  await ExpenseDB.add({ category: 'electricity', amount: 25.0, date: today, description: 'فاتورة كهرباء مايو', receipt: null });
  await ExpenseDB.add({ category: 'groceries', amount: 35.5, date: today, description: 'مشتريات بقالة أسبوعية', receipt: null });
}
