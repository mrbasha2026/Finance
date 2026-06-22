// Pure utility functions for ExcelUpload — extracted for testability.

export interface LeafCategory {
  id:     string;
  nameAr: string;
  name:   string;
  pnlKey: string;
  type:   string;
}

export interface ApiCategory {
  id:           string;
  nameAr:       string;
  name:         string;
  pnlKey:       string | null;
  type:         string;
  isCalculated: boolean;
  children:     ApiCategory[];
}

// xlsx floating-point issue: dates like Jan 1 get stored as 45657.9994 (23:59:xx on Dec 31)
// instead of 45658.0. Detect 23:59:xx and snap to next day.
export function xlsxDateToStr(d: Date): string {
  let year  = d.getFullYear();
  let month = d.getMonth();
  let day   = d.getDate();
  if (d.getHours() === 23 && d.getMinutes() === 59) {
    const next = new Date(year, month, day + 1);
    year  = next.getFullYear();
    month = next.getMonth();
    day   = next.getDate();
  }
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Normalize Arabic text for fuzzy matching:
// removes diacritics, unifies alef forms, taa marbuta, alef maqsura
export function normalizeAr(text: string): string {
  return text
    .trim()
    .replace(/[ً-ٰٟ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase();
}

// API returns a FLAT list of ALL categories (Prisma findMany with no where clause).
// Leaves are those with no children and a pnlKey. No recursion needed.
export function extractLeaves(cats: ApiCategory[]): LeafCategory[] {
  return cats
    .filter((c) => (c.children?.length ?? 0) === 0 && c.pnlKey && !c.isCalculated)
    .map((c) => ({ id: c.id, nameAr: c.nameAr, name: c.name, pnlKey: c.pnlKey!, type: c.type }));
}

export function buildNameMap(leaves: LeafCategory[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const cat of leaves) {
    map[normalizeAr(cat.nameAr)]       = cat.pnlKey;
    map[cat.name.toLowerCase().trim()] = cat.pnlKey;
    map[cat.pnlKey.toLowerCase()]      = cat.pnlKey;
  }
  return map;
}

export function resolveAccount(
  accountKey:    string,
  accountNameAr: string,
  nameMap:       Record<string, string>,
  dbMappings:    Record<string, string>,
): string | null {
  const keyLow   = accountKey?.trim().toLowerCase();
  const nameNorm = accountNameAr ? normalizeAr(accountNameAr) : "";

  if (keyLow   && nameMap[keyLow])   return nameMap[keyLow];
  if (nameNorm && nameMap[nameNorm]) return nameMap[nameNorm];
  if (accountKey    && dbMappings[accountKey.trim()])    return dbMappings[accountKey.trim()];
  if (accountNameAr && dbMappings[accountNameAr.trim()]) return dbMappings[accountNameAr.trim()];
  if (nameNorm && dbMappings[nameNorm]) return dbMappings[nameNorm];
  return null;
}

// Column name map shared between utils and the component
export const COL_KEYS: Record<string, string> = {
  "اسم الشركة": "companyName", "الشركة": "companyName",
  "company": "companyName", "companyname": "companyName",
  "التاريخ": "date", "date": "date",
  "رقم القيد": "entryNumber", "entrynumber": "entryNumber",
  "كود الحساب": "accountKey", "كود": "accountKey",
  "accountkey": "accountKey", "account": "accountKey",
  "اسم الحساب": "accountNameAr",
  "accountname": "accountNameAr", "accountnamear": "accountNameAr",
  "الوصف": "description", "description": "description",
  "مدين": "debit", "debit": "debit",
  "دائن": "credit", "credit": "credit",
  "المرجع": "reference", "reference": "reference",
  "العملة": "currency", "currency": "currency",
};
