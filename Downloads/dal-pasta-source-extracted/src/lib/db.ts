// Types
export interface OrderItem {
  dishName: string;
  dishNameEn?: string;
  quantity: number;
  price: number;
  cost: number;
}

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
  tablewareFee?: number;
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
  category: string;
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
  price: number;
  cost: number;
  createdAt: string;
}

export interface AppSettings {
  pin: string;
  currency: string;
  lang: 'ar' | 'en';
}

export interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
  orders: number;
}

// Storage Keys
const KEYS = {
  orders: 'dp_orders',
  expenses: 'dp_expenses',
  purchases: 'dp_purchases',
  products: 'dp_products',
  dishes: 'dp_dishes',
  settings: 'dp_settings',
  receipts: 'dp_receipts_',
};

// UUID fallback for environments without crypto
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// Helper functions
function getItem<T>(key: string, fallback: T[]): T[] {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch {
    return fallback;
  }
}

function setItem(key: string, data: unknown): void {
  localStorage.setItem(key, JSON.stringify(data));
}

// Settings
export const SettingsDB = {
  get(): AppSettings {
    const defaults: AppSettings = { pin: '1234', currency: 'OMR', lang: 'ar' };
    try {
      const data = localStorage.getItem(KEYS.settings);
      return data ? { ...defaults, ...JSON.parse(data) } : defaults;
    } catch {
      return defaults;
    }
  },
  set(settings: Partial<AppSettings>): void {
    setItem(KEYS.settings, { ...this.get(), ...settings });
  },
  verifyPin(pin: string): boolean {
    return this.get().pin === pin;
  },
  changePin(currentPin: string, newPin: string): boolean {
    if (this.get().pin !== currentPin) return false;
    this.set({ pin: newPin });
    return true;
  },
};

// Orders
export const OrderDB = {
  getAll(): Order[] {
    return getItem<Order>(KEYS.orders, []).sort((a, b) => {
      const dateDiff = b.deliveryDate.localeCompare(a.deliveryDate);
      if (dateDiff !== 0) return dateDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  },
  add(order: Omit<Order, 'id' | 'createdAt'>): Order {
    const orders = this.getAll();
    const newOrder: Order = { ...order, id: generateId(), createdAt: new Date().toISOString() };
    orders.unshift(newOrder);
    setItem(KEYS.orders, orders);
    return newOrder;
  },
  update(id: string, data: Partial<Order>): Order | null {
    const orders = this.getAll();
    const idx = orders.findIndex(o => o.id === id);
    if (idx === -1) return null;
    orders[idx] = { ...orders[idx], ...data };
    setItem(KEYS.orders, orders);
    return orders[idx];
  },
  delete(id: string): boolean {
    const orders = this.getAll().filter(o => o.id !== id);
    setItem(KEYS.orders, orders);
    return true;
  },
  getById(id: string): Order | undefined {
    return this.getAll().find(o => o.id === id);
  },
  getToday(): Order[] {
    const today = new Date().toISOString().split('T')[0];
    return this.getAll().filter(o => o.orderDate === today);
  },
  getPendingAdvance(): Order[] {
    return this.getAll().filter(o => o.type === 'advance' && o.status === 'pending');
  },
};

// Expenses
export const ExpenseDB = {
  getAll(): Expense[] {
    return getItem<Expense>(KEYS.expenses, []).sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  },
  add(expense: Omit<Expense, 'id' | 'createdAt'>): Expense {
    const expenses = this.getAll();
    const newExpense: Expense = { ...expense, id: generateId(), createdAt: new Date().toISOString() };
    expenses.unshift(newExpense);
    setItem(KEYS.expenses, expenses);
    return newExpense;
  },
  update(id: string, data: Partial<Expense>): Expense | null {
    const expenses = this.getAll();
    const idx = expenses.findIndex(e => e.id === id);
    if (idx === -1) return null;
    expenses[idx] = { ...expenses[idx], ...data };
    setItem(KEYS.expenses, expenses);
    return expenses[idx];
  },
  delete(id: string): boolean {
    const expenses = this.getAll().filter(e => e.id !== id);
    setItem(KEYS.expenses, expenses);
    return true;
  },
  getById(id: string): Expense | undefined {
    return this.getAll().find(e => e.id === id);
  },
  getByMonth(month: string): Expense[] {
    return this.getAll().filter(e => e.date.startsWith(month));
  },
  getByCategory(category: string): Expense[] {
    return this.getAll().filter(e => e.category === category);
  },
};

// Purchases
export const PurchaseDB = {
  getAll(): Purchase[] {
    return getItem<Purchase>(KEYS.purchases, []).sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  },
  add(purchase: Omit<Purchase, 'id' | 'createdAt'>): Purchase {
    const purchases = this.getAll();
    const newPurchase: Purchase = { ...purchase, id: generateId(), createdAt: new Date().toISOString() };
    purchases.unshift(newPurchase);
    setItem(KEYS.purchases, purchases);
    // Update product stock
    this.updateProductStock(newPurchase);
    return newPurchase;
  },
  updateProductStock(purchase: Purchase): void {
    const products = ProductDB.getAll();
    const existing = products.find(p => p.name.toLowerCase() === purchase.productName.toLowerCase());
    if (existing) {
      existing.currentStock += purchase.quantity;
      existing.avgUnitPrice = (existing.avgUnitPrice + purchase.unitPrice) / 2;
      setItem(KEYS.products, products);
    } else {
      ProductDB.add({
        name: purchase.productName,
        unit: purchase.unit,
        currentStock: purchase.quantity,
        reorderLevel: 5,
        avgUnitPrice: purchase.unitPrice,
        supplier: purchase.supplier,
      });
    }
  },
  update(id: string, data: Partial<Purchase>): Purchase | null {
    const purchases = this.getAll();
    const idx = purchases.findIndex(p => p.id === id);
    if (idx === -1) return null;
    purchases[idx] = { ...purchases[idx], ...data };
    setItem(KEYS.purchases, purchases);
    return purchases[idx];
  },
  delete(id: string): boolean {
    const purchases = this.getAll().filter(p => p.id !== id);
    setItem(KEYS.purchases, purchases);
    return true;
  },
  getById(id: string): Purchase | undefined {
    return this.getAll().find(p => p.id === id);
  },
};

// Products
export const ProductDB = {
  getAll(): Product[] {
    return getItem<Product>(KEYS.products, []);
  },
  add(product: Omit<Product, 'id' | 'createdAt'>): Product {
    const products = this.getAll();
    const newProduct: Product = { ...product, id: generateId(), createdAt: new Date().toISOString() };
    products.push(newProduct);
    setItem(KEYS.products, products);
    return newProduct;
  },
  update(id: string, data: Partial<Product>): Product | null {
    const products = this.getAll();
    const idx = products.findIndex(p => p.id === id);
    if (idx === -1) return null;
    products[idx] = { ...products[idx], ...data };
    setItem(KEYS.products, products);
    return products[idx];
  },
  delete(id: string): boolean {
    const products = this.getAll().filter(p => p.id !== id);
    setItem(KEYS.products, products);
    return true;
  },
  getLowStock(): Product[] {
    return this.getAll().filter(p => p.currentStock <= p.reorderLevel);
  },
  getById(id: string): Product | undefined {
    return this.getAll().find(p => p.id === id);
  },
};

// Dishes
export const DishDB = {
  getAll(): Dish[] {
    return getItem<Dish>(KEYS.dishes, []);
  },
  add(dish: Omit<Dish, 'id' | 'createdAt'>): Dish {
    const dishes = this.getAll();
    const newDish: Dish = { ...dish, id: generateId(), createdAt: new Date().toISOString() };
    dishes.push(newDish);
    setItem(KEYS.dishes, dishes);
    return newDish;
  },
  update(id: string, data: Partial<Dish>): Dish | null {
    const dishes = this.getAll();
    const idx = dishes.findIndex(d => d.id === id);
    if (idx === -1) return null;
    dishes[idx] = { ...dishes[idx], ...data };
    setItem(KEYS.dishes, dishes);
    return dishes[idx];
  },
  delete(id: string): boolean {
    const dishes = this.getAll().filter(d => d.id !== id);
    setItem(KEYS.dishes, dishes);
    return true;
  },
  getById(id: string): Dish | undefined {
    return this.getAll().find(d => d.id === id);
  },
};

// Receipts (stored as base64)
export const ReceiptDB = {
  save(id: string, base64: string): void {
    localStorage.setItem(KEYS.receipts + id, base64);
  },
  get(id: string): string | null {
    return localStorage.getItem(KEYS.receipts + id);
  },
  delete(id: string): void {
    localStorage.removeItem(KEYS.receipts + id);
  },
};

// Reports
export const ReportDB = {
  getMonthlyData(): MonthlyData[] {
    const orders = OrderDB.getAll().filter(o => o.status === 'completed');
    const expenses = ExpenseDB.getAll();
    const months: Record<string, MonthlyData> = {};

    orders.forEach(o => {
      const month = o.deliveryDate.substring(0, 7);
      if (!months[month]) months[month] = { month, income: 0, expenses: 0, orders: 0 };
      months[month].income += o.total;
      months[month].orders += 1;
    });

    expenses.forEach(e => {
      const month = e.date.substring(0, 7);
      if (!months[month]) months[month] = { month, income: 0, expenses: 0, orders: 0 };
      months[month].expenses += e.amount;
    });

    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month));
  },
  getCategoryBreakdown(): { category: string; amount: number; percentage: number }[] {
    const expenses = ExpenseDB.getAll();
    const categories: Record<string, number> = {};
    let total = 0;
    expenses.forEach(e => {
      categories[e.category] = (categories[e.category] || 0) + e.amount;
      total += e.amount;
    });
    return Object.entries(categories)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  },
  getTopDishes(): { name: string; count: number; revenue: number }[] {
    const orders = OrderDB.getAll().filter(o => o.status === 'completed');
    const dishes: Record<string, { count: number; revenue: number }> = {};
    orders.forEach(o => {
      o.items.forEach(item => {
        if (!dishes[item.dishName]) dishes[item.dishName] = { count: 0, revenue: 0 };
        dishes[item.dishName].count += item.quantity;
        dishes[item.dishName].revenue += item.price * item.quantity;
      });
    });
    return Object.entries(dishes)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  },
  getThisMonthStats(): { income: number; expenses: number; orders: number; avgOrder: number } {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const orders = OrderDB.getAll().filter(o => o.deliveryDate.startsWith(month) && o.status === 'completed');
    const expenses = ExpenseDB.getAll().filter(e => e.date.startsWith(month));
    const income = orders.reduce((s, o) => s + o.total, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    return {
      income,
      expenses: totalExpenses,
      orders: orders.length,
      avgOrder: orders.length > 0 ? income / orders.length : 0,
    };
  },
};

// Backup & Restore
export function exportAll(): string {
  const data = {
    orders: OrderDB.getAll(),
    expenses: ExpenseDB.getAll(),
    purchases: PurchaseDB.getAll(),
    products: ProductDB.getAll(),
    dishes: DishDB.getAll(),
    settings: SettingsDB.get(),
    exportDate: new Date().toISOString(),
  };
  return JSON.stringify(data, null, 2);
}

export function importAll(json: string): boolean {
  try {
    const data = JSON.parse(json);
    if (data.orders) setItem(KEYS.orders, data.orders);
    if (data.expenses) setItem(KEYS.expenses, data.expenses);
    if (data.purchases) setItem(KEYS.purchases, data.purchases);
    if (data.products) setItem(KEYS.products, data.products);
    if (data.dishes) setItem(KEYS.dishes, data.dishes);
    return true;
  } catch {
    return false;
  }
}

export function resetAll(): void {
  Object.values(KEYS).forEach(key => {
    if (key === KEYS.receipts) {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k?.startsWith(KEYS.receipts)) localStorage.removeItem(k);
      }
    } else {
      localStorage.removeItem(key);
    }
  });
}

// Seed sample data
export function seedData(): void {
  const existing = OrderDB.getAll();
  if (existing.length > 0) return;

  // Seed dishes
  const sampleDishes = [
    { name: 'Chicken Alfredo', price: 4.5, cost: 2.5 },
    { name: 'Pasta Primavera', price: 3.5, cost: 1.8 },
    { name: 'Beef Lasagna', price: 5.0, cost: 2.8 },
    { name: 'Shrimp Scampi', price: 6.0, cost: 3.2 },
    { name: 'Carbonara', price: 4.0, cost: 2.0 },
    { name: 'Margherita Pizza', price: 3.0, cost: 1.2 },
    { name: 'Caesar Salad', price: 2.5, cost: 1.0 },
    { name: 'Garlic Bread', price: 1.5, cost: 0.5 },
    { name: 'Tiramisu', price: 2.5, cost: 1.0 },
    { name: 'Penne Arrabbiata', price: 3.5, cost: 1.5 },
  ];
  sampleDishes.forEach(d => DishDB.add(d));

  // Seed products
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
  sampleProducts.forEach(p => ProductDB.add(p));

  // Seed a sample order
  const today = new Date().toISOString().split('T')[0];
  OrderDB.add({
    customerName: 'فاطمة',
    customerPhone: '96891234567',
    area: 'الخوير',
    orderDate: today,
    deliveryDate: today,
    type: 'regular',
    items: [
      { dishName: 'Chicken Alfredo', quantity: 2, price: 4.5, cost: 2.5 },
      { dishName: 'Garlic Bread', quantity: 1, price: 1.5, cost: 0.5 },
    ],
    deliveryFee: 1.0,
    deposit: 0,
    total: 11.5,
    status: 'completed',
    notes: 'عميلة دائمة',
  });

  // Seed sample expenses
  ExpenseDB.add({
    category: 'electricity',
    amount: 25.0,
    date: today,
    description: 'فاتورة كهرباء مايو',
    receipt: null,
  });

  ExpenseDB.add({
    category: 'groceries',
    amount: 35.5,
    date: today,
    description: 'مشتريات بقالة أسبوعية',
    receipt: null,
  });
}
