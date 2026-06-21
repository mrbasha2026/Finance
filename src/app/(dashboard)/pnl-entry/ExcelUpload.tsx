"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Check, Link2, Search, ChevronDown, X, Download, Plus, Loader2 } from "lucide-react";
import { Company } from "@/lib/pnl-types";

// ── Types ──────────────────────────────────────────────────────────────────────
interface LeafCategory {
  id:     string;
  nameAr: string;
  name:   string;
  pnlKey: string;
  type:   string;
}

interface ApiCategory {
  id:       string;
  nameAr:   string;
  name:     string;
  pnlKey:   string | null;
  type:     string;
  children: ApiCategory[];
}

interface ParsedEntry {
  companyName:  string;
  period:       string;   // "YYYY-MM"
  date:         string;   // "YYYY-MM-DD"
  entryNumber:  string;
  accountKey:   string;
  accountNameAr: string;
  description:  string;
  debit:        number;
  credit:       number;
  reference:    string;
  currency:     string;
}

interface UnmappedAccount {
  accountKey:   string;
  accountNameAr: string;
}

interface PeriodSummary {
  period:     string;
  entryCount: number;
}

interface CompanyGroup {
  companyName:      string;
  currency:         string;
  periods:          PeriodSummary[];
  unmappedAccounts: UnmappedAccount[];
  allEntries:       ParsedEntry[];
}

interface SaveDataset {
  companyId:   string;
  companyName: string;
  period:      string;
  currency:    string;
  lineItems:   { key: string; amount: number }[];
  mode:        "merge" | "replace";
}

// ── Column name map ────────────────────────────────────────────────────────────
const COL_KEYS: Record<string, string> = {
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


// ── Helpers ────────────────────────────────────────────────────────────────────
function extractLeaves(cats: ApiCategory[]): LeafCategory[] {
  return cats
    .filter((c) => (c.children?.length ?? 0) === 0 && c.pnlKey)
    .map((c) => ({ id: c.id, nameAr: c.nameAr, name: c.name, pnlKey: c.pnlKey!, type: c.type }));
}

function buildNameMap(leaves: LeafCategory[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const cat of leaves) {
    map[cat.nameAr.toLowerCase().trim()] = cat.pnlKey;
    map[cat.name.toLowerCase().trim()]   = cat.pnlKey;
    map[cat.pnlKey.toLowerCase().trim()] = cat.pnlKey;
  }
  return map;
}

function resolveAccount(
  accountKey:   string,
  accountNameAr: string,
  nameMap:      Record<string, string>,
  dbMappings:   Record<string, string>,
): string | null {
  const keyLow  = accountKey?.trim().toLowerCase();
  const nameLow = accountNameAr?.trim().toLowerCase();

  if (keyLow  && nameMap[keyLow])  return nameMap[keyLow];
  if (nameLow && nameMap[nameLow]) return nameMap[nameLow];
  if (accountKey  && dbMappings[accountKey.trim()])  return dbMappings[accountKey.trim()];
  if (accountNameAr && dbMappings[accountNameAr.trim()]) return dbMappings[accountNameAr.trim()];
  return null;
}

// ── Inline add-category form state ────────────────────────────────────────────
interface AddCatForm {
  nameAr:     string;
  name:       string;
  type:       string;
  parentId:   string;
  isTotal:    boolean;
  isSubtotal: boolean;
}
const EMPTY_ADD: AddCatForm = { nameAr: "", name: "", type: "expense", parentId: "", isTotal: false, isSubtotal: false };

// ── Searchable pnlKey selector ─────────────────────────────────────────────────
function PnLKeySelect({
  value, onChange, categories, allCategories, onCategoryCreated,
}: {
  value:               string;
  onChange:            (key: string) => void;
  categories:          LeafCategory[];
  allCategories:       ApiCategory[];
  onCategoryCreated:   (cat: LeafCategory) => void;
}) {
  const [open,     setOpen]     = useState(false);
  const [query,    setQuery]    = useState("");
  const [showForm, setShowForm] = useState(false);
  const [addForm,  setAddForm]  = useState<AddCatForm>(EMPTY_ADD);
  const [saving,   setSaving]   = useState(false);
  const ref                     = useRef<HTMLDivElement>(null);
  const selected                = categories.find((c) => c.pnlKey === value);

  const filtered = query.trim()
    ? categories.filter(
        (c) =>
          c.nameAr.includes(query) ||
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.pnlKey.toLowerCase().includes(query.toLowerCase())
      )
    : categories;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) { setOpen(false); setShowForm(false); }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function openAddForm() {
    setAddForm({ ...EMPTY_ADD, nameAr: query });
    setShowForm(true);
  }

  async function handleCreate() {
    if (!addForm.nameAr.trim() || !addForm.name.trim()) {
      toast.error("الاسم بالعربية والإنجليزية مطلوبان");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/categories", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        name:         addForm.name.trim(),
        nameAr:       addForm.nameAr.trim(),
        type:         addForm.type,
        parentId:     addForm.parentId || null,
        isCalculated: false,
        isTotal:      addForm.isTotal,
        isSubtotal:   addForm.isSubtotal,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const { category } = await res.json();
      const leaf: LeafCategory = {
        id:     category.id,
        nameAr: category.nameAr,
        name:   category.name,
        pnlKey: category.pnlKey,
        type:   category.type,
      };
      onCategoryCreated(leaf);
      onChange(category.pnlKey);
      toast.success(`تم إنشاء التصنيف "${category.nameAr}"`);
      setShowForm(false);
      setOpen(false);
      setQuery("");
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "حدث خطأ أثناء الإنشاء");
    }
  }

  return (
    <div ref={ref} className="relative min-w-[200px]">
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setQuery(""); setShowForm(false); }}
        className={`w-full flex items-center justify-between gap-2 border rounded-lg px-2.5 py-1.5 text-xs bg-background focus:outline-none transition-colors ${
          value
            ? "border-green-300 dark:border-green-700 text-foreground"
            : "border-amber-300 dark:border-amber-700 text-muted-foreground"
        }`}
      >
        <span className="truncate text-right">
          {selected ? selected.nameAr : "تجاهل هذا الحساب"}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {value && (
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); onChange(""); }}
              className="hover:text-destructive transition-colors"
            >
              <X size={10} />
            </span>
          )}
          <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open && (
        <div className="relative left-0 top-full mt-1 z-50 w-80 bg-card border rounded-xl shadow-xl overflow-hidden">

          {/* ── Add form ── */}
          {showForm ? (
            <div className="p-3 space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b">
                <span className="text-xs font-semibold">إضافة بند جديد</span>
                <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
                  <X size={13} />
                </button>
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">الاسم بالعربية *</label>
                <input
                  autoFocus
                  value={addForm.nameAr}
                  onChange={(e) => setAddForm((f) => ({ ...f, nameAr: e.target.value }))}
                  placeholder="مصروفات التسويق"
                  className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">الاسم بالإنجليزية *</label>
                <input
                  value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Marketing Expenses"
                  className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-background font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">النوع</label>
                <select
                  value={addForm.type}
                  onChange={(e) => setAddForm((f) => ({ ...f, type: e.target.value }))}
                  className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="revenue">إيراد</option>
                  <option value="expense">مصروف</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">تحت بند (اختياري)</label>
                <select
                  value={addForm.parentId}
                  onChange={(e) => setAddForm((f) => ({ ...f, parentId: e.target.value }))}
                  className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">— بند رئيسي (بدون أب) —</option>
                  {allCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.nameAr}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-4 pt-0.5">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={addForm.isTotal}
                    onChange={(e) => setAddForm((f) => ({ ...f, isTotal: e.target.checked }))}
                    className="rounded"
                  />
                  إجمالي رئيسي (bold)
                </label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={addForm.isSubtotal}
                    onChange={(e) => setAddForm((f) => ({ ...f, isSubtotal: e.target.checked }))}
                    className="rounded"
                  />
                  إجمالي فرعي
                </label>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleCreate}
                  disabled={saving || !addForm.nameAr.trim() || !addForm.name.trim()}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 font-medium"
                >
                  {saving ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                  إضافة
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-3 py-1.5 text-xs border rounded-lg hover:bg-muted"
                >
                  إلغاء
                </button>
              </div>
            </div>

          ) : (
            /* ── Search + list ── */
            <>
              <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
                <Search size={13} className="text-muted-foreground flex-shrink-0" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="ابحث بالعربي أو الإنجليزي..."
                  className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
                />
                {query && (
                  <button onClick={() => setQuery("")}>
                    <X size={11} className="text-muted-foreground" />
                  </button>
                )}
              </div>
              <button
                onClick={() => { onChange(""); setOpen(false); }}
                className="w-full text-right px-3 py-2 text-xs text-muted-foreground hover:bg-muted transition-colors border-b"
              >
                — تجاهل هذا الحساب
              </button>
              <div className="max-h-52 overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="py-3 text-center space-y-1.5">
                    <p className="text-xs text-muted-foreground">
                      {query.trim() ? `لا توجد نتائج لـ "${query}"` : "لا توجد تصنيفات"}
                    </p>
                    <button
                      onClick={openAddForm}
                      className="flex items-center gap-1 text-xs text-primary hover:underline mx-auto"
                    >
                      <Plus size={11} /> إضافة تصنيف جديد
                    </button>
                  </div>
                ) : (
                  filtered.map((cat) => (
                    <button
                      key={cat.pnlKey}
                      onClick={() => { onChange(cat.pnlKey); setOpen(false); setQuery(""); }}
                      className={`w-full text-right px-3 py-2 text-xs hover:bg-muted transition-colors flex items-center justify-between gap-2 ${
                        cat.pnlKey === value ? "bg-primary/10 text-primary font-medium" : ""
                      }`}
                    >
                      <span className="truncate">{cat.nameAr}</span>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0 font-mono opacity-60">
                        {cat.pnlKey}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function ExcelUpload() {
  const [companies,    setCompanies]    = useState<Company[]>([]);
  const [leafCats,     setLeafCats]     = useState<LeafCategory[]>([]);
  const [allCats,      setAllCats]      = useState<ApiCategory[]>([]);
  const [nameMap,      setNameMap]      = useState<Record<string, string>>({});
  const [dbMappings,   setDbMappings]   = useState<Record<string, string>>({});
  const [userMappings, setUserMappings] = useState<Record<string, string>>({}); // accountKey → pnlKey
  const [dragging,     setDragging]     = useState(false);
  const [groups,       setGroups]       = useState<CompanyGroup[]>([]);
  const [companyMap,   setCompanyMap]   = useState<Record<string, string>>({});
  const [selected,     setSelected]     = useState<Set<string>>(new Set());
  const [saving,       setSaving]       = useState(false);
  const [existingKeys, setExistingKeys] = useState<Set<string>>(new Set());
  const [mode,         setMode]         = useState<"merge" | "replace">("replace");

  useEffect(() => {
    fetch("/api/companies")
      .then((r) => r.json())
      .then((d) => setCompanies(d.companies ?? []));

    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => {
        const cats   = d.categories ?? [];
        const leaves = extractLeaves(cats);
        setAllCats(cats);
        setLeafCats(leaves);
        setNameMap(buildNameMap(leaves));
      });

    fetch("/api/pnl/label-mappings")
      .then((r) => r.json())
      .then((d) => setDbMappings(d.mappings ?? {}));

    fetch("/api/pnl/save-batch")
      .then((r) => r.json())
      .then((d) => {
        const keys = new Set<string>(
          (d.datasets ?? []).map((ds: { companyId: string; period: string }) => `${ds.companyId}_${ds.period}`)
        );
        setExistingKeys(keys);
      });
  }, []);

  // ── Parse uploaded file ──────────────────────────────────────────────────────
  function parseFile(
    file:              File,
    currentCompanies:  Company[],
    currentNameMap:    Record<string, string>,
    currentDbMappings: Record<string, string>,
  ) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const XLSX = await import("xlsx");
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const wb   = XLSX.read(data, { type: "array", cellDates: true });
      const allEntries: ParsedEntry[] = [];

      for (const sheetName of wb.SheetNames) {
        if (
          sheetName.includes("تعليمات") ||
          sheetName.includes("دليل") ||
          sheetName.toLowerCase().includes("instruction") ||
          sheetName.toLowerCase().includes("reference")
        ) continue;

        const ws   = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
        if (rows.length < 2) continue;

        // Detect column indices from header row
        const headerRow = rows[0] as (string | number)[];
        const colMap: Record<number, string> = {};
        for (let i = 0; i < headerRow.length; i++) {
          const h = String(headerRow[i]).trim().toLowerCase();
          const key = COL_KEYS[h] || COL_KEYS[String(headerRow[i]).trim()];
          if (key) colMap[i] = key;
        }

        // Skip sheet if no recognized columns
        if (!Object.values(colMap).includes("accountKey") && !Object.values(colMap).includes("debit")) continue;

        for (const rawRow of rows.slice(1)) {
          const row = rawRow as unknown[];
          const cell: Record<string, unknown> = {};
          for (const [i, key] of Object.entries(colMap)) {
            cell[key] = row[Number(i)];
          }

          if (!cell.accountKey && !cell.debit && !cell.credit) continue;

          // Normalize date
          let dateStr = "";
          if (cell.date instanceof Date) {
            dateStr = (cell.date as Date).toISOString().split("T")[0];
          } else if (cell.date) {
            const d = new Date(String(cell.date).trim());
            if (!isNaN(d.getTime())) dateStr = d.toISOString().split("T")[0];
            else dateStr = String(cell.date).trim();
          }

          // Derive period from date (YYYY-MM)
          if (!dateStr) continue;
          const dateObj = new Date(dateStr);
          if (isNaN(dateObj.getTime())) continue;
          const period = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}`;

          const companyName = String(cell.companyName ?? sheetName).trim() || sheetName;

          allEntries.push({
            companyName,
            period,
            date:         dateStr || `${period}-01`,
            entryNumber:  String(cell.entryNumber ?? "").trim(),
            accountKey:   String(cell.accountKey ?? "").trim(),
            accountNameAr: String(cell.accountNameAr ?? "").trim(),
            description:  String(cell.description ?? "").trim(),
            debit:        parseFloat(String(cell.debit  ?? 0).replace(/,/g, "")) || 0,
            credit:       parseFloat(String(cell.credit ?? 0).replace(/,/g, "")) || 0,
            reference:    String(cell.reference ?? "").trim(),
            currency:     String(cell.currency ?? "SAR").trim() || "SAR",
          });
        }
      }

      if (!allEntries.length) {
        toast.error("لم يُعثر على قيود في الملف — تحقق من تنسيق الأعمدة");
        return;
      }

      buildGroups(allEntries, currentCompanies, currentNameMap, currentDbMappings);
    };
    reader.readAsArrayBuffer(file);
  }

  function buildGroups(
    entries:           ParsedEntry[],
    currentCompanies:  Company[],
    currentNameMap:    Record<string, string>,
    currentDbMappings: Record<string, string>,
  ) {
    // Group entries by company name
    const byCompany: Record<string, ParsedEntry[]> = {};
    for (const e of entries) {
      if (!byCompany[e.companyName]) byCompany[e.companyName] = [];
      byCompany[e.companyName].push(e);
    }

    const newGroups: CompanyGroup[] = Object.entries(byCompany).map(([companyName, ents]) => {
      // Period counts
      const periodCounts: Record<string, number> = {};
      for (const e of ents) {
        periodCounts[e.period] = (periodCounts[e.period] ?? 0) + 1;
      }
      const periods = Object.entries(periodCounts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, entryCount]) => ({ period, entryCount }));

      // Find unmapped unique accounts
      const seenKeys  = new Set<string>();
      const unmapped: UnmappedAccount[] = [];
      for (const e of ents) {
        if (!e.accountKey || seenKeys.has(e.accountKey)) continue;
        seenKeys.add(e.accountKey);
        if (!resolveAccount(e.accountKey, e.accountNameAr, currentNameMap, currentDbMappings)) {
          unmapped.push({ accountKey: e.accountKey, accountNameAr: e.accountNameAr });
        }
      }

      const currency = ents.find((e) => e.currency)?.currency ?? "SAR";
      return { companyName, currency, periods, unmappedAccounts: unmapped, allEntries: ents };
    });

    setGroups(newGroups);
    setUserMappings({});

    // Select all by default
    const allSel = new Set<string>();
    for (const g of newGroups) {
      for (const p of g.periods) allSel.add(`${g.companyName}::${p.period}`);
    }
    setSelected(allSel);

    // Auto-match companies by name
    const autoMap: Record<string, string> = {};
    for (const g of newGroups) {
      const match = currentCompanies.find(
        (c) => c.name === g.companyName || c.name.includes(g.companyName) || g.companyName.includes(c.name)
      );
      if (match) autoMap[g.companyName] = match.id;
    }
    setCompanyMap(autoMap);
  }

  function handleCategoryCreated(cat: LeafCategory) {
    setLeafCats((prev) => [...prev, cat]);
    setAllCats((prev) => [...prev, { id: cat.id, nameAr: cat.nameAr, name: cat.name, pnlKey: cat.pnlKey, type: cat.type, children: [] }]);
    setNameMap((prev) => ({
      ...prev,
      [cat.nameAr.toLowerCase().trim()]: cat.pnlKey,
      [cat.name.toLowerCase().trim()]:   cat.pnlKey,
      [cat.pnlKey.toLowerCase().trim()]: cat.pnlKey,
    }));
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) parseFile(file, companies, nameMap, dbMappings);
    },
    [companies, nameMap, dbMappings],
  );

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) parseFile(file, companies, nameMap, dbMappings);
    e.target.value = "";
  }

  // ── Selection ────────────────────────────────────────────────────────────────
  function togglePeriod(companyName: string, period: string) {
    const key = `${companyName}::${period}`;
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function toggleCompany(companyName: string) {
    const group = groups.find((g) => g.companyName === companyName);
    if (!group) return;
    const allSel = group.periods.every((p) => selected.has(`${companyName}::${p.period}`));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of group.periods) {
        allSel ? next.delete(`${companyName}::${p.period}`) : next.add(`${companyName}::${p.period}`);
      }
      return next;
    });
  }

  // ── Save ─────────────────────────────────────────────────────────────────────
  async function handleSave() {
    // 1. Persist new user mappings (with Arabic account names)
    const newMappings: Record<string, string> = {};
    const newNames:    Record<string, string> = {};
    for (const [accountKey, pnlKey] of Object.entries(userMappings)) {
      if (!dbMappings[accountKey]) {
        newMappings[accountKey] = pnlKey;
        // Collect Arabic name for this accountKey from any group
        for (const group of groups) {
          const acc = group.unmappedAccounts.find((a) => a.accountKey === accountKey);
          if (acc?.accountNameAr) { newNames[accountKey] = acc.accountNameAr; break; }
        }
      }
    }
    if (Object.keys(newMappings).length > 0) {
      await fetch("/api/pnl/label-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappings: newMappings, names: newNames }),
      });
      setDbMappings((prev) => ({ ...prev, ...newMappings }));
    }

    const effectiveDbMappings = { ...dbMappings, ...newMappings };

    const datasets:       SaveDataset[]   = [];
    const journalEntries: ParsedEntry[]   = [];

    for (const group of groups) {
      const companyId = companyMap[group.companyName] ?? "";

      for (const ps of group.periods) {
        if (!selected.has(`${group.companyName}::${ps.period}`)) continue;

        const periodEntries = group.allEntries.filter((e) => e.period === ps.period);
        const resolvedEntries = periodEntries.map((entry) => {
          const resolvedKey =
            resolveAccount(entry.accountKey, entry.accountNameAr, nameMap, effectiveDbMappings) ??
            userMappings[entry.accountKey];
          return resolvedKey ? { ...entry, accountKey: resolvedKey } : entry;
        });
        journalEntries.push(...resolvedEntries);

        // Aggregate by accountKey → pnlKey with sign-aware amounts
        const pnlAmounts: Record<string, number> = {};

        for (const entry of periodEntries) {
          const pnlKey =
            resolveAccount(entry.accountKey, entry.accountNameAr, nameMap, effectiveDbMappings) ??
            userMappings[entry.accountKey];
          if (!pnlKey) continue;

          const cat    = leafCats.find((c) => c.pnlKey === pnlKey);
          // Revenue accounts: credit increases income → credit − debit
          // Expense accounts (and unknown): debit increases cost → debit − credit
          const net    = cat?.type === "revenue"
            ? entry.credit - entry.debit
            : entry.debit   - entry.credit;

          pnlAmounts[pnlKey] = (pnlAmounts[pnlKey] ?? 0) + net;
        }

        const lineItems = Object.entries(pnlAmounts).map(([key, amount]) => ({ key, amount }));
        if (!lineItems.length) continue;

        datasets.push({
          companyId,
          companyName: group.companyName,
          period:      ps.period,
          currency:    group.currency,
          lineItems,
          mode: isPeriodExisting(group.companyName, ps.period) ? mode : "replace",
        });
      }
    }

    if (!datasets.length) { toast.error("لا توجد بيانات قابلة للحفظ — تحقق من ربط الحسابات"); return; }

    const MAX_JOURNAL = 5000;
    const cappedJournalEntries = journalEntries.slice(0, MAX_JOURNAL);
    const journalTruncated = journalEntries.length > MAX_JOURNAL;

    setSaving(true);
    const res = await fetch("/api/pnl/save-batch", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ datasets, journalEntries: cappedJournalEntries }),
    });
    setSaving(false);

    if (res.ok) {
      const { saved } = await res.json();
      toast.success(`تم حفظ ${saved} فترة بنجاح`);
      if (journalTruncated) {
        toast.warning(`تم حفظ أول ${MAX_JOURNAL.toLocaleString()} قيد فقط من أصل ${journalEntries.length.toLocaleString()} — الملف كبير جداً`);
      }
      setGroups([]);
      setSelected(new Set());
      setCompanyMap({});
      setUserMappings({});
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || "حدث خطأ أثناء الحفظ");
    }
  }

  function isPeriodExisting(companyName: string, period: string): boolean {
    const cId = companyMap[companyName];
    return !!cId && existingKeys.has(`${cId}_${period}`);
  }

  // ── Derived ──────────────────────────────────────────────────────────────────
  const totalSelected = selected.size;
  const hasExistingSelected = [...selected].some((key) => {
    const sep = key.indexOf("::");
    return isPeriodExisting(key.slice(0, sep), key.slice(sep + 2));
  });

  function pendingUnmapped(group: CompanyGroup) {
    return group.unmappedAccounts.filter(
      (u) => !userMappings[u.accountKey] && !dbMappings[u.accountKey],
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Drop zone */}
      {!groups.length && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
            dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
          }`}
        >
          <FileSpreadsheet size={40} className="mx-auto mb-3 text-muted-foreground" />
          <p className="font-medium mb-1">اسحب وأفلت ملف Excel هنا</p>
          <p className="text-sm text-muted-foreground mb-4">أو</p>
          <label className="cursor-pointer inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            <Upload size={14} /> اختر ملفاً
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileInput} className="hidden" />
          </label>
          <p className="text-xs text-muted-foreground mt-4">
            كل سطر في الملف يمثّل قيداً — النظام يجمّع الحسابات تلقائياً ويبني P&L
          </p>
          <a
            href="/api/pnl/template"
            download="PnL_JournalEntries_Template.xlsx"
            className="mt-3 inline-flex items-center gap-2 text-xs text-primary hover:underline"
          >
            <Download size={13} /> تحميل قالب القيود
          </a>
        </div>
      )}

      {/* Results */}
      {groups.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">
                {groups.length} {groups.length === 1 ? "شركة" : "شركات"} —{" "}
                <span className="text-primary">{totalSelected} فترة مختارة</span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                الحسابات تُجمَّع تلقائياً حسب الربط · الشركات الجديدة تُنشأ تلقائياً
              </p>
            </div>
            <label className="cursor-pointer inline-flex items-center gap-1.5 text-xs border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors">
              <Upload size={12} /> رفع ملف آخر
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileInput} className="hidden" />
            </label>
          </div>

          {groups.map((group) => {
            const allSel  = group.periods.every((p) => selected.has(`${group.companyName}::${p.period}`));
            const someSel = group.periods.some((p)  => selected.has(`${group.companyName}::${p.period}`));
            const pending = pendingUnmapped(group);
            const resolvedByUser = group.unmappedAccounts.filter((u) => userMappings[u.accountKey]).length;

            return (
              <div key={group.companyName} className="rounded-xl border bg-card overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 border-b">
                  <input
                    type="checkbox"
                    checked={allSel}
                    ref={(el) => { if (el) el.indeterminate = someSel && !allSel; }}
                    onChange={() => toggleCompany(group.companyName)}
                    className="w-4 h-4 rounded accent-primary flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{group.companyName}</p>
                    <p className="text-xs text-muted-foreground">
                      {group.periods.length} فترة · {group.currency} ·{" "}
                      {group.allEntries.length} قيد
                      {pending.length > 0 && (
                        <span className="text-amber-600 mr-2">· {pending.length} حساب بحاجة ربط</span>
                      )}
                      {resolvedByUser > 0 && (
                        <span className="text-green-600 mr-2">· {resolvedByUser} تم ربطه</span>
                      )}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <select
                      value={companyMap[group.companyName] ?? ""}
                      onChange={(e) =>
                        setCompanyMap((prev) => ({ ...prev, [group.companyName]: e.target.value }))
                      }
                      className="border rounded-lg px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 min-w-[160px]"
                    >
                      <option value="">إنشاء تلقائي</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-muted-foreground mt-0.5 text-center">
                      {companyMap[group.companyName] ? "شركة موجودة" : "ستُنشأ بالاسم أعلاه"}
                    </p>
                  </div>
                </div>

                {/* Period chips */}
                <div className="px-4 pt-3 pb-2 flex flex-wrap gap-2">
                  {group.periods.map((ps) => {
                    const key      = `${group.companyName}::${ps.period}`;
                    const isSel    = selected.has(key);
                    const isExist  = isPeriodExisting(group.companyName, ps.period);
                    return (
                      <button
                        key={ps.period}
                        onClick={() => togglePeriod(group.companyName, ps.period)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          isSel
                            ? "bg-primary/10 border-primary/40 text-primary"
                            : "bg-muted/30 border-border text-muted-foreground hover:border-primary/30"
                        }`}
                      >
                        {isSel && <Check size={10} />}
                        {ps.period}
                        <span className="opacity-60">({ps.entryCount} قيد)</span>
                        {isExist && (
                          <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            موجود
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Unmapped accounts */}
                {group.unmappedAccounts.length > 0 && (
                  <div className="mx-3 mb-3 rounded-lg border border-amber-200 dark:border-amber-800 overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800">
                      <Link2 size={13} className="text-amber-600 dark:text-amber-400" />
                      <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                        ربط الحسابات — {group.unmappedAccounts.length} حساب غير مُعرَّف
                      </span>
                      {pending.length === 0 && (
                        <span className="mr-auto text-[10px] text-green-600 flex items-center gap-1">
                          <Check size={10} /> تم ربط الكل
                        </span>
                      )}
                    </div>
                    <div className="divide-y">
                      {group.unmappedAccounts.map((acc) => {
                        const currentKey = userMappings[acc.accountKey] ?? dbMappings[acc.accountKey] ?? "";
                        const isFromDb   = !!dbMappings[acc.accountKey] && !userMappings[acc.accountKey];
                        return (
                          <div
                            key={acc.accountKey}
                            className="flex items-center gap-3 px-3 py-2 bg-card hover:bg-muted/20 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-mono text-muted-foreground">{acc.accountKey}</p>
                              {acc.accountNameAr && (
                                <p className="text-xs truncate">{acc.accountNameAr}</p>
                              )}
                            </div>
                            {isFromDb && (
                              <span className="text-[10px] text-blue-500 whitespace-nowrap">من الفهرس</span>
                            )}
                            <PnLKeySelect
                              value={currentKey}
                              categories={leafCats}
                              allCategories={allCats}
                              onCategoryCreated={handleCategoryCreated}
                              onChange={(val) =>
                                setUserMappings((prev) => {
                                  const next = { ...prev };
                                  if (val) next[acc.accountKey] = val;
                                  else delete next[acc.accountKey];
                                  return next;
                                })
                              }
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Save area */}
          <div className="flex items-center justify-between gap-4 pt-1 flex-wrap">
            {hasExistingSelected ? (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">للفترات الموجودة:</span>
                <div className="flex rounded-lg border overflow-hidden">
                  <button
                    onClick={() => setMode("merge")}
                    className={`px-3 py-1.5 font-medium transition-colors ${
                      mode === "merge"
                        ? "bg-primary text-white"
                        : "hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    دمج
                  </button>
                  <button
                    onClick={() => setMode("replace")}
                    className={`px-3 py-1.5 font-medium transition-colors border-r ${
                      mode === "replace"
                        ? "bg-destructive text-white"
                        : "hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    استبدال
                  </button>
                </div>
              </div>
            ) : (
              <span />
            )}
            <button
              onClick={handleSave}
              disabled={saving || totalSelected === 0}
              className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Check size={15} />
              {saving ? "جارٍ الحفظ..." : `حفظ ${totalSelected} فترة`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
