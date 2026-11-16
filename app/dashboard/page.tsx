"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import moment from "moment";
import "moment/locale/th";
import Link from "next/link";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Package,
  Pill,
  Users,
  Clock,
  Percent,
  RotateCw,

  Settings,
} from "lucide-react";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import {
  CustomerServiceRecord,
  Medications,
  ShiftRecord,
  MedicationCategory,
  MEDICATION_CATEGORIES,
  MEDICATION_CATEGORY_CONFIG,
  resolveMedicationCategory,
} from "../../types/vendee";
import {
  calculateMedicationCostSatang,
  calculateUnitCostSatang,
  getServicePricingBreakdown,
} from "../../lib/conflictEngine";
import { getStockSummaryAction, type StockSummaryData } from "../actions/stockActions";
import { estimateFifoCost, formatOnHand } from "../../lib/stock";
import {
  getServices,
  getMedications,
  getShifts,
  getStockLayers,
  syncAllDataFromApi,
  subscribeToStorage,
  getTodayDateStringBangkok,
  isDbSyncDisabled,
} from "../../lib/storage";

type PeriodType = "month" | "week" | "day";

export default function DashboardPage() {
  const [services, setServices] = useState<CustomerServiceRecord[]>([]);
  const [masterMedications, setMasterMedications] = useState<Medications[]>([]);
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<"all" | MedicationCategory>("all");
  
  // Period filter state
  const [periodType, setPeriodType] = useState<PeriodType>("month");
  // Reference moment: default to current date in Asia/Bangkok
  const [selectedDate, setSelectedDate] = useState<moment.Moment>(() => {
    return moment(getTodayDateStringBangkok());
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [stockSummary, setStockSummary] = useState<StockSummaryData | null>(null);

  const loadData = useCallback(() => {
    setServices(getServices());
    setMasterMedications(getMedications());
    setShifts(getShifts());
  }, []);

  const syncData = useCallback(async () => {
    if (isDbSyncDisabled()) return;
    setIsSyncing(true);
    try {
      await syncAllDataFromApi();
      loadData();
    } catch (err) {
      console.warn("Dashboard sync warning:", err);
    } finally {
      setIsSyncing(false);
    }
  }, [loadData]);

  useEffect(() => {
    loadData();
    syncData();
    const unsub = subscribeToStorage(loadData);
    return () => unsub();
  }, [loadData, syncData]);

  // Navigate period (prev / next)
  const handlePrevPeriod = () => {
    setSelectedDate((prev) => {
      const next = prev.clone();
      if (periodType === "month") next.subtract(1, "month");
      else if (periodType === "week") next.subtract(1, "week");
      else next.subtract(1, "day");
      return next;
    });
  };

  const handleNextPeriod = () => {
    setSelectedDate((prev) => {
      const next = prev.clone();
      if (periodType === "month") next.add(1, "month");
      else if (periodType === "week") next.add(1, "week");
      else next.add(1, "day");
      return next;
    });
  };

  const handleResetCurrent = () => {
    setSelectedDate(moment(getTodayDateStringBangkok()));
  };

  // Map of medication name -> cost price in THB
  const medCostMap = useMemo(() => {
    const map = new Map<string, { cost: number; unit?: string }>();
    masterMedications.forEach((m) => {
      const priceNum = typeof m.price === "number" ? m.price : parseFloat(String(m.price || "0")) || 0;
      map.set(m.name.trim().toLowerCase(), {
        cost: priceNum,
        unit: m.unit,
      });
    });
    return map;
  }, [masterMedications]);

  // Compute date boundary for the active period
  const { startDateStr, endDateStr, periodLabel } = useMemo(() => {
    if (periodType === "month") {
      const start = selectedDate.clone().startOf("month");
      const end = selectedDate.clone().endOf("month");
      // Format Thai month e.g. "กันยายน 2569"
      const thaiYear = selectedDate.year() + 543;
      const monthName = selectedDate.locale("th").format("MMMM");
      return {
        startDateStr: start.format("YYYY-MM-DD"),
        endDateStr: end.format("YYYY-MM-DD"),
        periodLabel: `${monthName} ${thaiYear}`,
      };
    }

    if (periodType === "week") {
      const start = selectedDate.clone().startOf("isoWeek"); // Monday
      const end = selectedDate.clone().endOf("isoWeek"); // Sunday
      const thaiYear = start.year() + 543;
      return {
        startDateStr: start.format("YYYY-MM-DD"),
        endDateStr: end.format("YYYY-MM-DD"),
        periodLabel: `สัปดาห์ที่ ${start.isoWeek()} (${start.format("D MMM")} - ${end.format("D MMM")} ${thaiYear})`,
      };
    }

    // Single day
    const dayStr = selectedDate.format("YYYY-MM-DD");
    const thaiYear = selectedDate.year() + 543;
    const formattedDay = selectedDate.locale("th").format("D MMMM");
    return {
      startDateStr: dayStr,
      endDateStr: dayStr,
      periodLabel: `${formattedDay} ${thaiYear}`,
    };
  }, [periodType, selectedDate]);

  // Services in current period (excluding cancelled)
  const periodServices = useMemo(() => {
    return services.filter((s) => {
      if (s.status === "cancelled") return false;
      return s.date >= startDateStr && s.date <= endDateStr;
    });
  }, [services, startDateStr, endDateStr]);

  // Fetch stock summary KPIs for selected period (falls back to local cache when offline/DB sync disabled)
  useEffect(() => {
    const buildLocalFallback = (): StockSummaryData => {
      const layers = getStockLayers();
      const inventoryValueSatang = layers.reduce(
        (sum, l) => sum + Math.round((Number(l.qtyRemaining) || 0) * (Number(l.unitCostSatang) || 0)),
        0
      );
      let lowStockCount = 0;
      let negativeStockCount = 0;
      for (const m of masterMedications) {
        if (m.isArchived) continue;
        const onHand = Number(m.stockOnHand ?? 0);
        const packSize = Math.max(1, Number(m.packSize ?? 1));
        const reorder = Number(m.reorderPointPacks ?? 1);
        if (onHand < 0) negativeStockCount++;
        else if (reorder > 0 && onHand < reorder * packSize) lowStockCount++;
      }
      return {
        inventoryValueSatang,
        lowStockCount,
        negativeStockCount,
        receivedCostSatang: 0,
        usedCostSatang: 0,
        wasteCostSatang: 0,
        giveawayCostSatang: 0,
      };
    };

    if (isDbSyncDisabled()) {
      setStockSummary(buildLocalFallback());
      return;
    }
    let cancelled = false;
    getStockSummaryAction({
      from: `${startDateStr}T00:00:00+07:00`,
      to: `${endDateStr}T23:59:59+07:00`,
    }).then((res) => {
      if (!cancelled) {
        setStockSummary(res.success ? res.data : buildLocalFallback());
      }
    });
    return () => {
      cancelled = true;
    };
  }, [startDateStr, endDateStr, services.length, masterMedications]);



  // Financial calculations (Phase 14.7: completed uses FIFO cost, upcoming uses D17 estimate; Period Net deducts waste & giveaway)
  const financialSummary = useMemo(() => {
    let serviceRevenue = 0;
    let totalCost = 0;
    const stockLayers = getStockLayers();

    periodServices.forEach((s) => {
      // 1. Revenue (Net Revenue after discount: Net Revenue = serviceFee - discount)
      const pricing = getServicePricingBreakdown(s);
      serviceRevenue += pricing.netRevenue;

      // 2. Cost calculation
      let caseCost = 0;
      if (s.status === "upcoming" && s.medicationUsages && s.medicationUsages.length > 0) {
        // D17: Upcoming service estimates FIFO cost from current remaining layers
        const satang = s.medicationUsages.reduce((sum, u) => {
          const med = masterMedications.find((m) => m.id === u.medicationId);
          const refUnitCost = med
            ? calculateUnitCostSatang(med.price, med.packSize ?? med.size, med.refCostPerPackSatang)
            : u.unitCostSatang || 0;
          const layersForMed = stockLayers.filter((l) => l.medicationId === u.medicationId);
          return sum + estimateFifoCost(layersForMed, u.quantity, refUnitCost).costSatang;
        }, 0);
        caseCost = satang / 100;
      } else if (s.medicationCostSatang && s.medicationCostSatang > 0) {
        caseCost = s.medicationCostSatang / 100;
      } else if (s.medicationUsages && s.medicationUsages.length > 0) {
        const satang = calculateMedicationCostSatang(
          s.medicationUsages.map((u) => ({
            quantity: u.quantity,
            unitCostSatang: u.unitCostSatang,
          }))
        );
        caseCost = satang / 100;
      } else if (s.medications && s.medications.length > 0) {
        s.medications.forEach((medName) => {
          const rawKey = medName.trim().toLowerCase();
          const cleanKey = medName.replace(/\s*\([^)]*\)$/, "").trim().toLowerCase();
          const item = medCostMap.get(rawKey) || medCostMap.get(cleanKey);
          if (item) {
            caseCost += item.cost;
          }
        });
      }
      totalCost += caseCost;
    });

    const totalRevenue = serviceRevenue;
    const serviceNetProfit = totalRevenue - totalCost;
    const wasteCost = (stockSummary?.wasteCostSatang || 0) / 100;
    const giveawayCost = (stockSummary?.giveawayCostSatang || 0) / 100;
    const netProfit = serviceNetProfit - wasteCost - giveawayCost;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return {
      serviceRevenue,
      totalRevenue,
      totalCost,
      serviceNetProfit,
      wasteCost,
      giveawayCost,
      netProfit,
      profitMargin,
      totalCases: periodServices.length,
    };
  }, [periodServices, medCostMap, masterMedications, stockSummary]);

  // Product / Medication breakdown (uses medicationUsages with fallback to legacy medications)
  const productBreakdown = useMemo(() => {
    interface AggregatedMed {
      name: string;
      category: MedicationCategory;
      caseCount: number;
      totalQuantity: number;
      unit: string;
      unitCost: number;
      totalCost: number;
    }

    const map = new Map<string, AggregatedMed>();

    periodServices.forEach((s) => {
      if (s.medicationUsages && s.medicationUsages.length > 0) {
        s.medicationUsages.forEach((u) => {
          const trimmedName = u.name.trim();
          if (!trimmedName) return;
          const key = trimmedName.toLowerCase();
          const cat = u.category || resolveMedicationCategory(trimmedName);
          const rawKey = trimmedName.toLowerCase();
          const cleanKey = trimmedName.replace(/\s*\([^)]*\)$/, "").trim().toLowerCase();
          const medMeta = medCostMap.get(rawKey) || medCostMap.get(cleanKey);

          const unitLabel = u.unit || medMeta?.unit || "หน่วย";
          const unitCost = u.unitCostSatang ? u.unitCostSatang / 100 : medMeta?.cost || 0;
          const lineCost =
            u.lineCostSatang !== undefined ? u.lineCostSatang / 100 : unitCost * u.quantity;

          const existing = map.get(key) || {
            name: trimmedName,
            category: cat,
            caseCount: 0,
            totalQuantity: 0,
            unit: unitLabel,
            unitCost,
            totalCost: 0,
          };

          existing.caseCount += 1;
          existing.totalQuantity += u.quantity;
          existing.totalCost += lineCost;
          if (unitCost > 0) existing.unitCost = unitCost;
          if (u.unit) existing.unit = u.unit;
          existing.category = cat;
          map.set(key, existing);
        });
      } else if (s.medications && Array.isArray(s.medications)) {
        s.medications.forEach((medName) => {
          const trimmed = medName.trim();
          if (!trimmed) return;
          const key = trimmed.toLowerCase();
          const rawKey = trimmed.toLowerCase();
          const cleanKey = trimmed.replace(/\s*\([^)]*\)$/, "").trim().toLowerCase();
          const medMeta = medCostMap.get(rawKey) || medCostMap.get(cleanKey);
          const cat = resolveMedicationCategory(trimmed);
          const unitCost = medMeta?.cost || 0;
          const unitLabel = medMeta?.unit || "หน่วย";

          const existing = map.get(key) || {
            name: trimmed,
            category: cat,
            caseCount: 0,
            totalQuantity: 0,
            unit: unitLabel,
            unitCost,
            totalCost: 0,
          };

          existing.caseCount += 1;
          existing.totalQuantity += 1;
          existing.totalCost += unitCost;
          map.set(key, existing);
        });
      }
    });

    const allAggregated = Array.from(map.values());
    const totalPicks = allAggregated.reduce((sum, item) => sum + item.caseCount, 0);

    const items = allAggregated.map((item) => {
      const pickPercentage = totalPicks > 0 ? (item.caseCount / totalPicks) * 100 : 0;
      return {
        ...item,
        pickPercentage,
      };
    });

    // Filter by selectedCategory if not 'all'
    const filtered =
      selectedCategory === "all"
        ? items
        : items.filter((item) => item.category === selectedCategory);

    // Sort descending by caseCount, then totalCost
    return filtered.sort((a, b) => b.caseCount - a.caseCount || b.totalCost - a.totalCost);
  }, [periodServices, medCostMap, selectedCategory]);

  return (
    <div className="min-h-screen bg-ds-bg text-ds-text">
      {/* App Bar */}
      <AppBar
        title="แดชบอร์ดสรุปรายได้"
        isSyncing={isSyncing}
        rightAction={
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={syncData}
              disabled={isSyncing}
              className="flex h-8 w-8 items-center justify-center rounded-full text-ds-icon-secondary hover:bg-ds-surface-elevated hover:text-ds-text transition-colors disabled:opacity-60 cursor-pointer"
              title="รีเฟรชและซิงค์ข้อมูลล่าสุด"
              aria-label="รีเฟรชข้อมูล"
            >
              <RotateCw className={`h-4 w-4 ${isSyncing ? "animate-spin text-ds-primary" : ""}`} />
            </button>
            <Link
              href="/settings"
              className="flex h-8 w-8 items-center justify-center rounded-full text-ds-icon-secondary hover:bg-ds-surface-elevated hover:text-ds-text transition-colors cursor-pointer"
              title="การตั้งค่า"
              aria-label="การตั้งค่า"
            >
              <Settings className="h-4 w-4" />
            </Link>
          </div>
        }
      />

      <main className="mx-auto max-w-lg px-4 pt-3 space-y-4">
        {/* Period Selector Tabs (รายเดือน / รายสัปดาห์ / รายวัน) */}
        <div className="flex rounded-2xl bg-ds-surface-variant p-1 border border-ds-border/60">
          <button
            type="button"
            onClick={() => setPeriodType("month")}
            className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all cursor-pointer ${
              periodType === "month"
                ? "bg-ds-surface text-ds-primary shadow-ds-card"
                : "text-ds-text-secondary hover:text-ds-text"
            }`}
          >
            รายเดือน
          </button>
          <button
            type="button"
            onClick={() => setPeriodType("week")}
            className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all cursor-pointer ${
              periodType === "week"
                ? "bg-ds-surface text-ds-primary shadow-ds-card"
                : "text-ds-text-secondary hover:text-ds-text"
            }`}
          >
            รายสัปดาห์
          </button>
          <button
            type="button"
            onClick={() => setPeriodType("day")}
            className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all cursor-pointer ${
              periodType === "day"
                ? "bg-ds-surface text-ds-primary shadow-ds-card"
                : "text-ds-text-secondary hover:text-ds-text"
            }`}
          >
            รายวัน
          </button>
        </div>

        {/* Date Period Navigation Controls */}
        <div className="flex items-center justify-between rounded-2xl border border-ds-border bg-ds-surface px-3.5 py-2.5 shadow-ds-card">
          <button
            type="button"
            onClick={handlePrevPeriod}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-ds-surface-elevated border border-ds-border text-ds-icon-primary hover:bg-ds-surface-variant active:scale-95 transition-all cursor-pointer"
            aria-label="ช่วงก่อนหน้า"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs font-extrabold text-ds-text">
              <Calendar className="h-3.5 w-3.5 text-ds-icon-secondary" />
              <span>{periodLabel}</span>
            </div>
            <button
              type="button"
              onClick={handleResetCurrent}
              className="text-[10px] font-semibold text-ds-text-secondary hover:text-ds-primary mt-0.5 cursor-pointer underline underline-offset-2"
            >
              กลับช่วงปัจจุบัน
            </button>
          </div>

          <button
            type="button"
            onClick={handleNextPeriod}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-ds-surface-elevated border border-ds-border text-ds-icon-primary hover:bg-ds-surface-variant active:scale-95 transition-all cursor-pointer"
            aria-label="ช่วงถัดไป"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Main Financial KPI Card (Clean Minimal Neutral Card) */}
        <div className="rounded-3xl border border-ds-border bg-ds-surface p-5 shadow-ds-card">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ds-surface-variant px-3 py-1 text-xs font-bold text-ds-text-secondary border border-ds-border/60">
              <TrendingUp className="h-3.5 w-3.5 text-ds-icon-secondary" />
              <span>กำไรสุทธิ</span>
            </span>

            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-extrabold ${
                financialSummary.netProfit >= 0
                  ? "bg-ds-success-container text-ds-success"
                  : "bg-ds-error-container text-ds-error"
              }`}
            >
              <Percent className="h-3 w-3" />
              <span>{financialSummary.profitMargin.toFixed(1)}%</span>
            </span>
          </div>

          <div className="mt-3.5">
            <div
              className={`text-3xl sm:text-4xl font-black tracking-tight flex items-baseline gap-1 ${
                financialSummary.netProfit >= 0 ? "text-ds-success" : "text-ds-error"
              }`}
            >
              <span>฿</span>
              <span>{financialSummary.netProfit.toLocaleString()}</span>
            </div>
            <p className="text-xs text-ds-text-secondary mt-1">
              คำนวณจากรายได้บริการ {financialSummary.totalCases} เคส หักต้นทุนยาและค่าใช้จ่าย
            </p>
          </div>

          {/* Revenue vs Cost Sub-Grid */}
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-ds-divider pt-4">
            <div className="space-y-0.5">
              <span className="text-[11px] font-medium text-ds-text-secondary">
                รายได้รวม
              </span>
              <div className="text-lg font-extrabold text-ds-text">
                ฿{financialSummary.totalRevenue.toLocaleString()}
              </div>
            </div>

            <div className="space-y-0.5">
              <span className="text-[11px] font-medium text-ds-text-secondary">
                ต้นทุนรวม
              </span>
              <div className="text-lg font-extrabold text-ds-text-secondary">
                ฿{financialSummary.totalCost.toLocaleString()}
              </div>
              <div className="text-[10px] text-ds-text-tertiary">
                ค่ายาและเวชภัณฑ์
              </div>
            </div>
          </div>
        </div>

        {/* Phase 14.7 Stock & Inventory KPI Card */}
        {stockSummary && (
          <div className="rounded-3xl border border-ds-border bg-ds-surface p-4.5 shadow-ds-card space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-ds-surface-elevated border border-ds-divider text-ds-icon-secondary">
                  <Package className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-ds-text">
                    สรุปสต็อกยาและเวชภัณฑ์
                  </h3>
                  <p className="text-[11px] text-ds-text-secondary">
                    ยอดซื้อและมูลค่าคงเหลือไม่นับเป็นค่าใช้จ่ายในกำไรสุทธิ
                  </p>
                </div>
              </div>
              {(stockSummary.lowStockCount > 0 || stockSummary.negativeStockCount > 0) && (
                <Link
                  href="/medications"
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                    stockSummary.negativeStockCount > 0
                      ? "bg-ds-error-container text-ds-error"
                      : "bg-ds-warning-container text-ds-warning"
                  }`}
                >
                  {stockSummary.negativeStockCount > 0
                    ? `ติดลบ ${stockSummary.negativeStockCount}`
                    : `สต็อกต่ำ ${stockSummary.lowStockCount}`}
                </Link>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="rounded-2xl border border-ds-divider bg-ds-surface-elevated p-3">
                <span className="text-[11px] text-ds-text-secondary">มูลค่าสต็อกคงเหลือ</span>
                <div className="mt-0.5 text-base font-extrabold text-ds-text">
                  ฿{(stockSummary.inventoryValueSatang / 100).toLocaleString()}
                </div>
              </div>
              <div className="rounded-2xl border border-ds-divider bg-ds-surface-elevated p-3">
                <span className="text-[11px] text-ds-text-secondary">ยอดซื้อยารับเข้า (ช่วงนี้)</span>
                <div className="mt-0.5 text-base font-extrabold text-ds-success">
                  ฿{(stockSummary.receivedCostSatang / 100).toLocaleString()}
                </div>
              </div>
              <div className="rounded-2xl border border-ds-divider bg-ds-surface-elevated p-3">
                <span className="text-[11px] text-ds-text-secondary">ยาสูญเสีย (Waste)</span>
                <div className="mt-0.5 text-base font-extrabold text-ds-error">
                  -฿{(stockSummary.wasteCostSatang / 100).toLocaleString()}
                </div>
              </div>
              <div className="rounded-2xl border border-ds-divider bg-ds-surface-elevated p-3">
                <span className="text-[11px] text-ds-text-secondary">แจกฟรี / ใช้ส่วนตัว</span>
                <div className="mt-0.5 text-base font-extrabold text-ds-warning">
                  -฿{(stockSummary.giveawayCostSatang / 100).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Product / Medication Breakdown Section */}
        <div className="rounded-3xl border border-ds-border bg-ds-surface p-4.5 shadow-ds-card space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-ds-surface-elevated border border-ds-divider text-ds-icon-secondary">
                <Pill className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-ds-text">
                  ตัวสินค้า/ตัวยาที่ลูกค้าเลือก
                </h3>
                <p className="text-[11px] text-ds-text-secondary">
                  สรุปความนิยมและยอดต้นทุนต่อรายการ
                </p>
              </div>
            </div>

            <span className="rounded-full bg-ds-surface-variant px-2.5 py-0.5 text-xs font-bold text-ds-text-secondary border border-ds-border/60">
              {productBreakdown.length} ตัวยา
            </span>
          </div>

          {/* Category Filter Chips per DOMAIN_RULES §3.4 */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-all shrink-0 cursor-pointer border ${
                selectedCategory === "all"
                  ? "border-transparent bg-ds-primary text-ds-on-primary shadow-2xs"
                  : "border-ds-border bg-ds-surface-elevated text-ds-text-secondary hover:text-ds-text"
              }`}
            >
              ทั้งหมด
            </button>
            {MEDICATION_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-all shrink-0 cursor-pointer border ${
                  selectedCategory === cat
                    ? "border-transparent bg-ds-primary text-ds-on-primary shadow-2xs"
                    : "border-ds-border bg-ds-surface-elevated text-ds-text-secondary hover:text-ds-text"
                }`}
              >
                {MEDICATION_CATEGORY_CONFIG[cat]?.label || cat}
              </button>
            ))}
          </div>

          {productBreakdown.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-ds-border p-6 text-center">
              <Package className="mx-auto h-8 w-8 text-ds-icon-disabled mb-1.5" />
              <p className="text-xs font-bold text-ds-text-secondary">
                ไม่มีการบันทึกรายการยาในช่วงเวลานี้
              </p>
              <p className="text-[11px] text-ds-text-tertiary mt-0.5">
                เลือกช่วงเวลาอื่น หรือบันทึกเคสบริการลูกค้าที่มีการใช้ยา
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {productBreakdown.map((item, idx) => {
                const catCfg = MEDICATION_CATEGORY_CONFIG[item.category] || MEDICATION_CATEGORY_CONFIG.other;
                const matchedMed = masterMedications.find(
                  (m) => !m.isArchived && m.name.trim().toLowerCase() === item.name.trim().toLowerCase()
                );
                return (
                  <div
                    key={idx}
                    className="rounded-2xl border border-ds-divider bg-ds-surface-elevated p-3 transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-bold text-ds-text truncate">
                          {item.name}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold shrink-0 ${catCfg.badge}`}
                        >
                          {catCfg.label}
                        </span>
                      </div>
                      <span className="font-extrabold text-ds-primary shrink-0">
                        {item.totalQuantity > 0 ? `${item.totalQuantity.toLocaleString()} ${item.unit}` : `${item.caseCount} ครั้ง`} ({item.caseCount} เคส)
                      </span>
                    </div>

                    {/* Progress bar representing share */}
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ds-surface-variant">
                      <div
                        className="h-full rounded-full bg-ds-primary"
                        style={{ width: `${Math.min(100, Math.max(8, item.pickPercentage))}%` }}
                      />
                    </div>

                    {/* Cost & Sub-info */}
                    <div className="mt-2 flex items-center justify-between text-[11px] text-ds-text-secondary">
                      <span>
                        ต้นทุนต่อหน่วย:{" "}
                        <strong className="text-ds-text">
                          {item.unitCost > 0 ? `฿${item.unitCost.toLocaleString()}` : "ไม่ระบุ"}
                        </strong>
                        /{item.unit}
                      </span>

                      <span className="font-semibold text-ds-text">
                        ต้นทุนรวม: ฿{Math.round(item.totalCost).toLocaleString()}
                      </span>
                    </div>
                    {matchedMed && (
                      <div
                        className={`mt-1 text-[11px] font-semibold ${
                          (matchedMed.stockOnHand ?? 0) < 0
                            ? "text-ds-error"
                            : "text-ds-success"
                        }`}
                      >
                        คงเหลือในคลัง:{" "}
                        {formatOnHand(
                          matchedMed.stockOnHand ?? 0,
                          matchedMed.unit || "ยูนิต",
                          matchedMed.packSize ?? 1,
                          matchedMed.packUnit || "ขวด"
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Service Cases in Period */}
        <div className="rounded-3xl border border-ds-border bg-ds-surface p-4.5 shadow-ds-card space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-ds-surface-elevated border border-ds-divider text-ds-icon-secondary">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-ds-text">
                  รายการเคสบริการในช่วงนี้
                </h3>
                <p className="text-[11px] text-ds-text-secondary">
                  รายละเอียดรายรับ ต้นทุน และกำไรรายเคส
                </p>
              </div>
            </div>

            <span className="rounded-full bg-ds-surface-variant px-2.5 py-0.5 text-xs font-bold text-ds-text-secondary border border-ds-border/60">
              {periodServices.length} เคส
            </span>
          </div>

          {periodServices.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-ds-border p-6 text-center">
              <Users className="mx-auto h-8 w-8 text-ds-icon-disabled mb-1.5" />
              <p className="text-xs font-bold text-ds-text-secondary">
                ไม่มีเคสบริการลูกค้าในช่วงเวลานี้
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {periodServices.map((srv) => {
                const pricing = getServicePricingBreakdown(srv);
                const srvPrice = pricing.netRevenue;
                let srvCost = 0;
                if (srv.medicationCostSatang && srv.medicationCostSatang > 0) {
                  srvCost = srv.medicationCostSatang / 100;
                } else if (srv.medicationUsages && srv.medicationUsages.length > 0) {
                  srvCost =
                    calculateMedicationCostSatang(
                      srv.medicationUsages.map((u) => ({
                        quantity: u.quantity,
                        unitCostSatang: u.unitCostSatang,
                      }))
                    ) / 100;
                } else if (srv.medications && srv.medications.length > 0) {
                  srv.medications.forEach((m) => {
                    const rawKey = m.trim().toLowerCase();
                    const cleanKey = m.replace(/\s*\([^)]*\)$/, "").trim().toLowerCase();
                    const found = medCostMap.get(rawKey) || medCostMap.get(cleanKey);
                    if (found) srvCost += found.cost;
                  });
                }
                const srvProfit = srvPrice - srvCost;

                return (
                  <div
                    key={srv.id}
                    className="rounded-2xl border border-ds-divider bg-ds-surface-elevated p-3.5 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-ds-text">
                            {srv.customerName}
                          </span>
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                              srv.status === "completed"
                                ? "bg-ds-success-container text-ds-success"
                                : "bg-ds-info-container text-ds-info"
                            }`}
                          >
                            {srv.status === "completed" ? "บริการแล้ว" : "นัดหมาย"}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-ds-text-secondary mt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-ds-icon-secondary" />
                            <span>{srv.date} {srv.time} น.</span>
                          </span>
                        </div>

                        {/* Medications chosen */}
                        {srv.medicationUsages && srv.medicationUsages.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1 mt-2">
                            {srv.medicationUsages.map((u, uIdx) => (
                              <span
                                key={uIdx}
                                className="inline-flex items-center gap-1 rounded-md bg-ds-surface-variant px-2 py-0.5 text-[10px] font-bold text-ds-text-secondary border border-ds-border/60"
                              >
                                <Pill className="h-2.5 w-2.5 text-ds-icon-secondary" />
                                <span>{u.name} ({u.quantity} {u.unit})</span>
                              </span>
                            ))}
                          </div>
                        ) : srv.medications && srv.medications.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1 mt-2">
                            {srv.medications.map((m, mIdx) => (
                              <span
                                key={mIdx}
                                className="inline-flex items-center gap-1 rounded-md bg-ds-surface-variant px-2 py-0.5 text-[10px] font-bold text-ds-text-secondary border border-ds-border/60"
                              >
                                <Pill className="h-2.5 w-2.5 text-ds-icon-secondary" />
                                <span>{m}</span>
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      {/* Financial breakdown pill */}
                      <div className="text-right shrink-0 space-y-0.5">
                        <div className={`font-extrabold text-sm ${srvProfit >= 0 ? "text-ds-success" : "text-ds-error"}`}>
                          {srvProfit >= 0 ? `+฿${srvProfit.toLocaleString()}` : `-฿${Math.abs(srvProfit).toLocaleString()}`}
                        </div>
                        <div className="text-[10px] text-ds-text-secondary">
                          รับ ฿{srvPrice.toLocaleString()} {pricing.hasDiscount ? `(ลด ฿${pricing.discount.toLocaleString()}) ` : ""}· ทุน ฿{srvCost.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
