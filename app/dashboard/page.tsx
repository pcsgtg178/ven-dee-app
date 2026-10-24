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
import { calculateMedicationCostSatang } from "../../lib/conflictEngine";
import {
  getServices,
  getMedications,
  getShifts,
  syncAllDataFromApi,
  subscribeToStorage,
  getTodayDateStringBangkok,
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

  const loadData = useCallback(() => {
    setServices(getServices());
    setMasterMedications(getMedications());
    setShifts(getShifts());
  }, []);

  const syncData = useCallback(async () => {
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



  // Financial calculations
  const financialSummary = useMemo(() => {
    let serviceRevenue = 0;
    let totalCost = 0;

    periodServices.forEach((s) => {
      // 1. Revenue
      const rev = s.price ?? (s.serviceFeeSatang ? s.serviceFeeSatang / 100 : 0);
      serviceRevenue += rev;

      // 2. Cost calculation: either explicit medicationCostSatang, calculated from medicationUsages, or legacy fallback
      let caseCost = 0;
      if (s.medicationCostSatang && s.medicationCostSatang > 0) {
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
    const netProfit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return {
      serviceRevenue,
      totalRevenue,
      totalCost,
      netProfit,
      profitMargin,
      totalCases: periodServices.length,
    };
  }, [periodServices, medCostMap]);

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
    <div className="min-h-screen bg-app-bg text-text-main dark:bg-zinc-950 dark:text-zinc-100">
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
              className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:bg-slate-100 hover:text-text-main dark:hover:bg-zinc-800 transition-colors disabled:opacity-60 cursor-pointer"
              title="รีเฟรชและซิงค์ข้อมูลล่าสุด"
              aria-label="รีเฟรชข้อมูล"
            >
              <RotateCw className={`h-4 w-4 ${isSyncing ? "animate-spin text-sky-600 dark:text-sky-400" : ""}`} />
            </button>
            <Link
              href="/settings"
              className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:bg-slate-100 hover:text-text-main dark:hover:bg-zinc-800 transition-colors cursor-pointer"
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
        <div className="flex rounded-2xl bg-slate-200/80 p-1 dark:bg-zinc-800/80 shadow-2xs">
          <button
            type="button"
            onClick={() => setPeriodType("month")}
            className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all cursor-pointer ${
              periodType === "month"
                ? "bg-white text-primary shadow-xs dark:bg-zinc-900 dark:text-primary-light"
                : "text-text-muted hover:text-text-main dark:text-zinc-400"
            }`}
          >
            รายเดือน
          </button>
          <button
            type="button"
            onClick={() => setPeriodType("week")}
            className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all cursor-pointer ${
              periodType === "week"
                ? "bg-white text-primary shadow-xs dark:bg-zinc-900 dark:text-primary-light"
                : "text-text-muted hover:text-text-main dark:text-zinc-400"
            }`}
          >
            รายสัปดาห์
          </button>
          <button
            type="button"
            onClick={() => setPeriodType("day")}
            className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all cursor-pointer ${
              periodType === "day"
                ? "bg-white text-primary shadow-xs dark:bg-zinc-900 dark:text-primary-light"
                : "text-text-muted hover:text-text-main dark:text-zinc-400"
            }`}
          >
            รายวัน
          </button>
        </div>

        {/* Date Period Navigation Controls */}
        <div className="flex items-center justify-between rounded-2xl border border-surface-subtle bg-white px-3.5 py-2.5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
          <button
            type="button"
            onClick={handlePrevPeriod}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95 transition-all dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 cursor-pointer"
            aria-label="ช่วงก่อนหน้า"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs font-extrabold text-text-main dark:text-white">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              <span>{periodLabel}</span>
            </div>
            <button
              type="button"
              onClick={handleResetCurrent}
              className="text-[10px] font-semibold text-text-muted hover:text-primary dark:text-zinc-400 dark:hover:text-primary-light mt-0.5 cursor-pointer underline underline-offset-2"
            >
              กลับช่วงปัจจุบัน
            </button>
          </div>

          <button
            type="button"
            onClick={handleNextPeriod}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95 transition-all dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 cursor-pointer"
            aria-label="ช่วงถัดไป"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Main Financial KPI Card (Gradient Glassmorphic Hero) */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-700 to-sky-800 p-5 text-white shadow-xl shadow-emerald-900/15">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold backdrop-blur-md">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>กำไรสุทธิ</span>
            </span>

            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-xs font-extrabold text-emerald-200 border border-emerald-300/30">
              <Percent className="h-3 w-3" />
              <span>{financialSummary.profitMargin.toFixed(1)}%</span>
            </span>
          </div>

          <div className="mt-3.5">
            <div className="text-3xl sm:text-4xl font-black tracking-tight flex items-baseline gap-1">
              <span>฿</span>
              <span>{financialSummary.netProfit.toLocaleString()}</span>
            </div>
            <p className="text-xs text-emerald-100/80 mt-1">
              คำนวณจากรายได้บริการ {financialSummary.totalCases} เคส หักต้นทุนยาและค่าใช้จ่าย
            </p>
          </div>

          {/* Revenue vs Cost Sub-Grid */}
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/15 pt-4">
            <div className="space-y-0.5">
              <span className="text-[11px] font-medium text-emerald-100/70">
                💰 รายได้รวม
              </span>
              <div className="text-lg font-extrabold text-white">
                ฿{financialSummary.totalRevenue.toLocaleString()}
              </div>
            </div>

            <div className="space-y-0.5">
              <span className="text-[11px] font-medium text-emerald-100/70">
                📦 ต้นทุนรวม
              </span>
              <div className="text-lg font-extrabold text-amber-200">
                ฿{financialSummary.totalCost.toLocaleString()}
              </div>
              <div className="text-[10px] text-emerald-100/70">
                ค่ายาและเวชภัณฑ์
              </div>
            </div>
          </div>
        </div>

        {/* Product / Medication Breakdown Section */}
        <div className="rounded-3xl border border-surface-subtle bg-white p-4.5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                <Pill className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-text-main dark:text-white">
                  ตัวสินค้า/ตัวยาที่ลูกค้าเลือก
                </h3>
                <p className="text-[11px] text-text-muted dark:text-zinc-400">
                  สรุปความนิยมและยอดต้นทุนต่อรายการ
                </p>
              </div>
            </div>

            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700 dark:bg-zinc-800 dark:text-zinc-300">
              {productBreakdown.length} ตัวยา
            </span>
          </div>

          {/* Category Filter Chips per DOMAIN_RULES §3.4 */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-all shrink-0 cursor-pointer ${
                selectedCategory === "all"
                  ? "bg-purple-600 text-white shadow-2xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              ทั้งหมด
            </button>
            {MEDICATION_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-all shrink-0 cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-purple-600 text-white shadow-2xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-300"
                }`}
              >
                {MEDICATION_CATEGORY_CONFIG[cat]?.label || cat}
              </button>
            ))}
          </div>

          {productBreakdown.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center dark:border-zinc-800">
              <Package className="mx-auto h-8 w-8 text-slate-300 dark:text-zinc-600 mb-1.5" />
              <p className="text-xs font-bold text-slate-600 dark:text-zinc-300">
                ไม่มีการบันทึกรายการยาในช่วงเวลานี้
              </p>
              <p className="text-[11px] text-text-muted dark:text-zinc-400 mt-0.5">
                เลือกช่วงเวลาอื่น หรือบันทึกเคสบริการลูกค้าที่มีการใช้ยา
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {productBreakdown.map((item, idx) => {
                const catCfg = MEDICATION_CATEGORY_CONFIG[item.category] || MEDICATION_CATEGORY_CONFIG.other;
                return (
                  <div
                    key={idx}
                    className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3 transition-all hover:bg-slate-50 dark:border-zinc-800/80 dark:bg-zinc-800/40"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-bold text-text-main dark:text-white truncate">
                          {item.name}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold shrink-0 ${catCfg.badge}`}
                        >
                          {catCfg.label}
                        </span>
                      </div>
                      <span className="font-extrabold text-purple-700 dark:text-purple-300 shrink-0">
                        {item.totalQuantity > 0 ? `${item.totalQuantity.toLocaleString()} ${item.unit}` : `${item.caseCount} ครั้ง`} ({item.caseCount} เคส)
                      </span>
                    </div>

                    {/* Progress bar representing share */}
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-700">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-500"
                        style={{ width: `${Math.min(100, Math.max(8, item.pickPercentage))}%` }}
                      />
                    </div>

                    {/* Cost & Sub-info */}
                    <div className="mt-2 flex items-center justify-between text-[11px] text-text-muted dark:text-zinc-400">
                      <span>
                        ต้นทุนต่อหน่วย:{" "}
                        <strong className="text-text-main dark:text-zinc-200">
                          {item.unitCost > 0 ? `฿${item.unitCost.toLocaleString()}` : "ไม่ระบุ"}
                        </strong>
                        /{item.unit}
                      </span>

                      <span className="font-semibold text-amber-600 dark:text-amber-400">
                        ต้นทุนรวม: ฿{Math.round(item.totalCost).toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Service Cases in Period */}
        <div className="rounded-3xl border border-surface-subtle bg-white p-4.5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-text-main dark:text-white">
                  รายการเคสบริการในช่วงนี้
                </h3>
                <p className="text-[11px] text-text-muted dark:text-zinc-400">
                  รายละเอียดรายรับ ต้นทุน และกำไรรายเคส
                </p>
              </div>
            </div>

            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700 dark:bg-zinc-800 dark:text-zinc-300">
              {periodServices.length} เคส
            </span>
          </div>

          {periodServices.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center dark:border-zinc-800">
              <Users className="mx-auto h-8 w-8 text-slate-300 dark:text-zinc-600 mb-1.5" />
              <p className="text-xs font-bold text-slate-600 dark:text-zinc-300">
                ไม่มีเคสบริการลูกค้าในช่วงเวลานี้
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {periodServices.map((srv) => {
                const srvPrice = srv.price ?? (srv.serviceFeeSatang ? srv.serviceFeeSatang / 100 : 0);
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
                    className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-2xs transition-all hover:border-slate-200 dark:border-zinc-800 dark:bg-zinc-800/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-text-main dark:text-white">
                            {srv.customerName}
                          </span>
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                              srv.status === "completed"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
                            }`}
                          >
                            {srv.status === "completed" ? "บริการแล้ว" : "นัดหมาย"}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-text-muted dark:text-zinc-400 mt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-sky-500" />
                            <span>{srv.date} {srv.time} น.</span>
                          </span>
                        </div>

                        {/* Medications chosen */}
                        {srv.medicationUsages && srv.medicationUsages.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1 mt-2">
                            {srv.medicationUsages.map((u, uIdx) => (
                              <span
                                key={uIdx}
                                className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-950/60 dark:text-purple-300"
                              >
                                <Pill className="h-2.5 w-2.5" />
                                <span>{u.name} ({u.quantity} {u.unit})</span>
                              </span>
                            ))}
                          </div>
                        ) : srv.medications && srv.medications.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1 mt-2">
                            {srv.medications.map((m, mIdx) => (
                              <span
                                key={mIdx}
                                className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-950/60 dark:text-purple-300"
                              >
                                <Pill className="h-2.5 w-2.5" />
                                <span>{m}</span>
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      {/* Financial breakdown pill */}
                      <div className="text-right shrink-0 space-y-0.5">
                        <div className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400">
                          +฿{srvProfit.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-text-muted dark:text-zinc-400">
                          รับ ฿{srvPrice.toLocaleString()} · ทุน ฿{srvCost.toLocaleString()}
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
