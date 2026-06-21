"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  CompanyPnL,
  JournalEntry,
  PeriodType,
  ComparisonType,
} from "@/lib/pnl-types";
import { aggregateData } from "@/lib/pnl-calculations";

interface PnLState {
  companies: CompanyPnL[];
  journalEntries: JournalEntry[];
  selectedCompanyNames: string[];
  selectedPeriods: string[];
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  notes: Record<string, string>;
  periodType: PeriodType;
  comparisonType: ComparisonType;
  activeFiscalYear: string | null;

  // Actions
  addCompanies: (datasets: CompanyPnL[]) => void;
  addJournalEntries: (entries: JournalEntry[]) => void;
  removeDataset: (id: string) => void;
  removeCompanyGroup: (companyName: string) => void;
  toggleCompanyName: (name: string) => void;
  togglePeriod: (period: string) => void;
  selectAllCompanies: () => void;
  deselectAllCompanies: () => void;
  selectAllPeriods: () => void;
  deselectAllPeriods: () => void;
  setDateRange: (start: string | null, end: string | null) => void;
  setPeriodType: (type: PeriodType) => void;
  setComparisonType: (type: ComparisonType) => void;
  setActiveFiscalYear: (year: string | null) => void;
  setNote: (key: string, note: string) => void;
  clearAll: () => void;
  loadFromDB: (datasets: CompanyPnL[], entries: JournalEntry[]) => void;

  // Selectors
  getFiltered: () => CompanyPnL[];
  getFilteredJournalEntries: () => JournalEntry[];
  getAggregatedFiltered: () => Record<string, number>;
  getAvailableCompanyNames: () => string[];
  getAvailablePeriods: (companyName?: string) => string[];
}

export const usePnLStore = create<PnLState>()(
  persist(
    (set, get) => ({
      companies: [],
      journalEntries: [],
      selectedCompanyNames: [],
      selectedPeriods: [],
      dateRangeStart: null,
      dateRangeEnd: null,
      notes: {},
      periodType: "monthly",
      comparisonType: "previous_period",
      activeFiscalYear: null,

      addCompanies: (datasets) =>
        set((state) => {
          const existing = new Map(state.companies.map((c) => [c.id, c]));
          datasets.forEach((d) => existing.set(d.id, d));
          return { companies: Array.from(existing.values()) };
        }),

      addJournalEntries: (entries) =>
        set((state) => {
          const existing = new Map(state.journalEntries.map((e) => [e.id, e]));
          entries.forEach((e) => existing.set(e.id, e));
          return { journalEntries: Array.from(existing.values()) };
        }),

      removeDataset: (id) =>
        set((state) => ({
          companies: state.companies.filter((c) => c.id !== id),
        })),

      removeCompanyGroup: (companyName) =>
        set((state) => ({
          companies: state.companies.filter(
            (c) => c.companyName !== companyName
          ),
          selectedCompanyNames: state.selectedCompanyNames.filter(
            (n) => n !== companyName
          ),
        })),

      toggleCompanyName: (name) =>
        set((state) => ({
          selectedCompanyNames: state.selectedCompanyNames.includes(name)
            ? state.selectedCompanyNames.filter((n) => n !== name)
            : [...state.selectedCompanyNames, name],
        })),

      togglePeriod: (period) =>
        set((state) => ({
          selectedPeriods: state.selectedPeriods.includes(period)
            ? state.selectedPeriods.filter((p) => p !== period)
            : [...state.selectedPeriods, period],
        })),

      selectAllCompanies: () =>
        set(() => ({
          selectedCompanyNames: get().getAvailableCompanyNames(),
        })),

      deselectAllCompanies: () => set({ selectedCompanyNames: [] }),

      selectAllPeriods: () =>
        set(() => ({
          selectedPeriods: get().getAvailablePeriods(),
        })),

      deselectAllPeriods: () => set({ selectedPeriods: [] }),

      setDateRange: (start, end) =>
        set({ dateRangeStart: start, dateRangeEnd: end }),

      setPeriodType: (type) => set({ periodType: type }),

      setComparisonType: (type) => set({ comparisonType: type }),

      setActiveFiscalYear: (year) => set({ activeFiscalYear: year }),

      setNote: (key, note) =>
        set((state) => ({ notes: { ...state.notes, [key]: note } })),

      clearAll: () =>
        set({
          companies: [],
          journalEntries: [],
          selectedCompanyNames: [],
          selectedPeriods: [],
          dateRangeStart: null,
          dateRangeEnd: null,
        }),

      loadFromDB: (datasets, entries) =>
        set({
          companies: datasets,
          journalEntries: entries,
          selectedCompanyNames: [
            ...new Set(datasets.map((d) => d.companyName)),
          ],
          selectedPeriods: [...new Set(datasets.map((d) => d.period))],
        }),

      getFiltered: () => {
        const state = get();
        let result = state.companies;

        if (state.selectedCompanyNames.length > 0) {
          result = result.filter((c) =>
            state.selectedCompanyNames.includes(c.companyName)
          );
        }

        if (state.selectedPeriods.length > 0) {
          result = result.filter((c) =>
            state.selectedPeriods.includes(c.period)
          );
        }

        if (state.dateRangeStart) {
          result = result.filter((c) => c.period >= state.dateRangeStart!);
        }
        if (state.dateRangeEnd) {
          result = result.filter((c) => c.period <= state.dateRangeEnd!);
        }

        return result;
      },

      getFilteredJournalEntries: () => {
        const state = get();
        let result = state.journalEntries;

        if (state.selectedCompanyNames.length > 0) {
          result = result.filter((e) =>
            state.selectedCompanyNames.includes(e.companyName)
          );
        }
        if (state.selectedPeriods.length > 0) {
          result = result.filter((e) =>
            state.selectedPeriods.includes(e.period)
          );
        }
        return result;
      },

      getAggregatedFiltered: () => {
        return aggregateData(get().getFiltered());
      },

      getAvailableCompanyNames: () => {
        return [...new Set(get().companies.map((c) => c.companyName))];
      },

      getAvailablePeriods: (companyName?: string) => {
        const companies = companyName
          ? get().companies.filter((c) => c.companyName === companyName)
          : get().companies;
        return [...new Set(companies.map((c) => c.period))].sort();
      },
    }),
    {
      name: "pnl-dashboard-storage-v2",
      partialize: (state) => ({
        selectedCompanyNames: state.selectedCompanyNames,
        selectedPeriods: state.selectedPeriods,
        notes: state.notes,
        periodType: state.periodType,
        comparisonType: state.comparisonType,
        activeFiscalYear: state.activeFiscalYear,
      }),
    }
  )
);
