/* eslint-disable @typescript-eslint/no-explicit-any */

/** حجم الدفعة المطلوب في كل طلب. قد يردّ الخادم أقل منه إذا كان حدّه الأقصى أصغر. */
export const FETCH_PAGE_SIZE = 1000;

/**
 * يقرأ كل صفوف جدول على دفعات متتالية مرتبة بالمعرّف، حتى لا تُقطع النتائج عند حد الخادم.
 *
 * - الترقيم بالمعرّف لا بالإزاحة: إضافة صف أو حذفه أثناء القراءة لا يُسقط صفًا ولا يكرره،
 *   فلا تختل المجاميع المحاسبية. لذلك يرتب المستدعي النتيجة بنفسه بعد القراءة.
 * - لا تتوقف القراءة إلا عند دفعة فارغة، لأن دفعة ناقصة قد تعني فقط أن حد الخادم أصغر من الدفعة.
 * - عند فشل أي دفعة تُرجع `error` بلا بيانات، فلا تُعرض أبدًا قائمة ناقصة على أنها كاملة.
 */
export async function fetchAllRows(
  sb: { from: (table: string) => any },
  table: string,
  pageSize: number = FETCH_PAGE_SIZE,
): Promise<{ data: any[] | null; error: unknown }> {
  const rows: any[] = [];
  let lastId: string | null = null;
  for (;;) {
    let query = sb.from(table).select('*').order('id', { ascending: true }).limit(pageSize);
    if (lastId !== null) query = query.gt('id', lastId);
    const { data, error } = await query;
    if (error) return { data: null, error };
    if (!data || data.length === 0) return { data: rows, error: null };
    rows.push(...data);
    lastId = data[data.length - 1].id;
  }
}
