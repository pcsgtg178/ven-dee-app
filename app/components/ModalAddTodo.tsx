"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Calendar,
  Clock,
  User,
  Plus,
  Trash2,
  Syringe,
  Sparkles,
  Package,
  MoreHorizontal,
  Moon,
  Sun,
  Sunset,
  AlertCircle,
  Check,
  UserPlus,
  Ambulance,
} from "lucide-react";
import {
  Customer,
  ServiceType,
  ShiftCategory,
  ShiftType,
} from "../../types/vendee";
import {
  getCustomers,
  saveCustomer,
  saveService,
  saveShift,
} from "../../lib/storage";

interface ModalAddTodoProps {
  openModal: boolean;
  toggleModal: () => void;
  initialTab?: "shift" | "service";
  initialCustomerId?: string;
  defaultDate?: string;
  onSuccess?: () => void;
}

export default function ModalAddTodo({
  openModal,
  toggleModal,
  initialTab = "shift",
  initialCustomerId,
  defaultDate,
  onSuccess,
}: ModalAddTodoProps) {
  const [activeTab, setActiveTab] = useState<"shift" | "service">(initialTab);

  // Customers state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showQuickAddCustomer, setShowQuickAddCustomer] = useState(false);
  const [quickCustName, setQuickCustName] = useState("");
  const [quickCustPhone, setQuickCustPhone] = useState("");
  const [quickCustNote, setQuickCustNote] = useState("");

  // Shift Form State
  const [shiftDate, setShiftDate] = useState("");
  const [shiftType, setShiftType] = useState<ShiftType>("morning");
  const [shiftCategory, setShiftCategory] = useState<ShiftCategory>("black");
  const [shiftDepartment, setShiftDepartment] = useState("");
  const [shiftNote, setShiftNote] = useState("");

  // Customer Service Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [serviceDate, setServiceDate] = useState("");
  const [serviceTime, setServiceTime] = useState("09:00");
  const [selectedServices, setSelectedServices] = useState<ServiceType[]>(["injection"]);
  const [otherServiceText, setOtherServiceText] = useState("");
  const [medications, setMedications] = useState<string[]>([""]);
  const [serviceNote, setServiceNote] = useState("");
  const [servicePrice, setServicePrice] = useState("");

  // Loading & error
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (openModal) {
      const allCust = getCustomers();
      setCustomers(allCust);

      const todayStr = defaultDate || new Date().toISOString().split("T")[0];
      setShiftDate(todayStr);
      setServiceDate(todayStr);

      if (initialCustomerId) {
        setSelectedCustomerId(initialCustomerId);
        setActiveTab("service");
      } else if (allCust.length > 0 && !selectedCustomerId) {
        setSelectedCustomerId(allCust[0].id);
      }

      if (initialTab) {
        setActiveTab(initialTab);
      }
      setErrorMsg("");
      setShowQuickAddCustomer(false);
    }
  }, [openModal, initialTab, initialCustomerId, defaultDate]);

  if (!openModal) return null;

  // Shift form submit
  const handleSaveShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftDate) {
      setErrorMsg("กรุณาระบุวันที่ขึ้นเวร");
      return;
    }

    const categoryToSave: ShiftCategory =
      shiftType === "r1" || shiftType === "r2" ? "green" : shiftCategory;

    try {
      saveShift({
        date: shiftDate,
        shiftType,
        category: categoryToSave,
        department: shiftDepartment.trim() || undefined,
        note: shiftNote.trim() || undefined,
      });

      toggleModal();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || "เกิดข้อผิดพลาดในการบันทึกเวร");
    }
  };

  // Customer service form submit
  const handleSaveService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      setErrorMsg("กรุณาเลือกลูกค้า");
      return;
    }
    if (!serviceDate || !serviceTime) {
      setErrorMsg("กรุณาระบุวันที่และเวลานัดหมาย");
      return;
    }
    if (selectedServices.length === 0) {
      setErrorMsg("กรุณาเลือกบริการอย่างน้อย 1 รายการ");
      return;
    }

    const currentCustomer = customers.find((c) => c.id === selectedCustomerId);
    if (!currentCustomer) {
      setErrorMsg("ไม่พบข้อมูลลูกค้าที่เลือก");
      return;
    }

    // Filter non-empty medications if injection selected
    const isInjectionSelected = selectedServices.includes("injection");
    const validMeds = isInjectionSelected
      ? medications.map((m) => m.trim()).filter(Boolean)
      : undefined;

    try {
      saveService({
        customerId: currentCustomer.id,
        customerName: currentCustomer.name,
        customerPhone: currentCustomer.phone,
        customerNote: currentCustomer.note,
        date: serviceDate,
        time: serviceTime,
        services: selectedServices,
        otherServiceText: selectedServices.includes("other") ? otherServiceText : undefined,
        medications: validMeds && validMeds.length > 0 ? validMeds : undefined,
        note: serviceNote.trim() || undefined,
        price: servicePrice ? Number(servicePrice) : undefined,
        status: "upcoming",
      });

      toggleModal();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || "เกิดข้อผิดพลาดในการบันทึกบริการลูกค้า");
    }
  };

  // Toggle service checkbox
  const toggleService = (srv: ServiceType) => {
    setSelectedServices((prev) => {
      if (prev.includes(srv)) {
        return prev.filter((s) => s !== srv);
      } else {
        return [...prev, srv];
      }
    });
  };

  // Medication handlers
  const handleAddMedication = () => {
    setMedications((prev) => [...prev, ""]);
  };

  const handleUpdateMedication = (index: number, val: string) => {
    setMedications((prev) => {
      const copy = [...prev];
      copy[index] = val;
      return copy;
    });
  };

  const handleRemoveMedication = (index: number) => {
    setMedications((prev) => prev.filter((_, i) => i !== index));
  };

  // Quick add customer
  const handleQuickAddCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCustName.trim()) {
      setErrorMsg("กรุณากรอกชื่อลูกค้า");
      return;
    }

    const newCust = saveCustomer({
      name: quickCustName.trim(),
      phone: quickCustPhone.trim() || "-",
      note: quickCustNote.trim() || "ลูกค้าใหม่",
    });

    const updated = getCustomers();
    setCustomers(updated);
    setSelectedCustomerId(newCust.id);
    setShowQuickAddCustomer(false);
    setQuickCustName("");
    setQuickCustPhone("");
    setQuickCustNote("");
    setErrorMsg("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={toggleModal}
      />

      {/* Sheet / Modal Container */}
      <div className="relative z-50 flex max-h-[92vh] w-full sm:max-w-lg flex-col rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl transition-all duration-300 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 overflow-hidden">
        {/* Drag handle for mobile */}
        <div className="sm:hidden pt-3 flex justify-center">
          <div className="h-1.5 w-12 rounded-full bg-slate-300 dark:bg-zinc-700" />
        </div>

        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-2 border-b border-slate-100 dark:border-zinc-800">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">
              บันทึกงานใหม่
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              เลือกประเภทงานที่ต้องการบันทึกลงตาราง
            </p>
          </div>
          <button
            onClick={toggleModal}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Switcher: [ ขึ้นเวร ] | [ บริการลูกค้า ] */}
        <div className="px-5 pt-3 pb-2 bg-surface-subtle/60 dark:bg-zinc-900/70">
          <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-surface-subtle p-1 dark:bg-zinc-800">
            <button
              type="button"
              onClick={() => {
                setActiveTab("shift");
                setErrorMsg("");
              }}
              className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all ${
                activeTab === "shift"
                  ? "bg-card-bg text-secondary shadow-xs dark:bg-zinc-700 dark:text-secondary-light font-bold"
                  : "text-text-muted hover:text-text-main dark:text-zinc-400 dark:hover:text-white"
              }`}
            >
              <Moon className="h-4 w-4" />
              <span>ขึ้นเวร</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("service");
                setErrorMsg("");
              }}
              className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all ${
                activeTab === "service"
                  ? "bg-card-bg text-primary shadow-xs dark:bg-zinc-700 dark:text-primary-light font-bold"
                  : "text-text-muted hover:text-text-main dark:text-zinc-400 dark:hover:text-white"
              }`}
            >
              <User className="h-4 w-4" />
              <span>บริการลูกค้า</span>
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mx-5 mt-2 flex items-center gap-2 rounded-xl bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
          {activeTab === "shift" ? (
            /* ====================================
               FORM 1: ขึ้นเวร (Shift Form)
               ==================================== */
            <form id="shift-form" onSubmit={handleSaveShift} className="space-y-4">
              {/* วันที่ขึ้นเวร */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  วันที่ขึ้นเวร <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={shiftDate}
                    onChange={(e) => setShiftDate(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                  <Calendar className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />
                </div>
              </div>

              {/* ปุ่มเลือกประเภทเวร: ดึก, เช้า, บ่าย (ปุ่มกดขนาดใหญ่ แตะง่าย) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  ประเภทเวร <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {/* เวรดึก */}
                  <button
                    type="button"
                    onClick={() => setShiftType("night")}
                    className={`relative flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all touch-manipulation text-center ${
                      shiftType === "night"
                        ? "border-indigo-600 bg-indigo-50/80 text-indigo-900 shadow-sm dark:border-indigo-400 dark:bg-indigo-950/50 dark:text-indigo-200"
                        : "border-slate-200 bg-white hover:border-slate-300 text-slate-700 dark:border-zinc-800 dark:bg-zinc-850 dark:text-zinc-300"
                    }`}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/60 mb-1 text-indigo-700 dark:text-indigo-300">
                      <Moon className="h-5 w-5" />
                    </div>
                    <span className="font-bold text-sm">เวรดึก</span>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                      24:00 - 08:00
                    </span>
                    {shiftType === "night" && (
                      <div className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                    )}
                  </button>

                  {/* เวรเช้า */}
                  <button
                    type="button"
                    onClick={() => setShiftType("morning")}
                    className={`relative flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all touch-manipulation text-center ${
                      shiftType === "morning"
                        ? "border-amber-500 bg-amber-50/80 text-amber-900 shadow-sm dark:border-amber-400 dark:bg-amber-950/50 dark:text-amber-200"
                        : "border-slate-200 bg-white hover:border-slate-300 text-slate-700 dark:border-zinc-800 dark:bg-zinc-850 dark:text-zinc-300"
                    }`}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/60 mb-1 text-amber-700 dark:text-amber-300">
                      <Sun className="h-5 w-5" />
                    </div>
                    <span className="font-bold text-sm">เวรเช้า</span>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                      08:00 - 16:00
                    </span>
                    {shiftType === "morning" && (
                      <div className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-amber-500 dark:bg-amber-400" />
                    )}
                  </button>

                  {/* เวรบ่าย */}
                  <button
                    type="button"
                    onClick={() => setShiftType("afternoon")}
                    className={`relative flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all touch-manipulation text-center ${
                      shiftType === "afternoon"
                        ? "border-sky-600 bg-sky-50/80 text-sky-900 shadow-sm dark:border-sky-400 dark:bg-sky-950/50 dark:text-sky-200"
                        : "border-slate-200 bg-white hover:border-slate-300 text-slate-700 dark:border-zinc-800 dark:bg-zinc-850 dark:text-zinc-300"
                    }`}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-900/60 mb-1 text-sky-700 dark:text-sky-300">
                      <Sunset className="h-5 w-5" />
                    </div>
                    <span className="font-bold text-sm">เวรบ่าย</span>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                      16:00 - 24:00
                    </span>
                    {shiftType === "afternoon" && (
                      <div className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-sky-600 dark:bg-sky-400" />
                    )}
                  </button>
                </div>

                {/* เวร R (Refer) - ทั้งวัน พร้อมตัวเลือก R1 (ทีม 1) และ R2 (ทีม 2) */}
                <div
                  className={`mt-2.5 rounded-2xl border-2 p-3 transition-all ${
                    shiftType === "r1" || shiftType === "r2"
                      ? "border-purple-600 bg-purple-50/70 shadow-sm dark:border-purple-500 dark:bg-purple-950/40"
                      : "border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-850"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">
                        <Ambulance className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-slate-800 dark:text-white">
                            เวร R (Refer)
                          </span>
                          <span className="rounded-md bg-purple-100 dark:bg-purple-900/60 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300">
                            ทั้งวัน (แลกได้)
                          </span>
                        </div>
                        <p className="text-[10px] text-purple-700 dark:text-purple-300 font-medium">
                          เวรส่งต่อผู้ป่วยฉุกเฉิน (สามารถลงงานบริการ/งานอื่นทับเวลาเวรนี้ได้)
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* ตัวเลือกเพิ่มเติม: R1 (ทีม 1) / R2 (ทีม 2) */}
                  <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-zinc-800">
                    <span className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-300 mb-1.5">
                      ตัวเลือกทีม Refer <span className="text-rose-500">*</span>:
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setShiftType("r1")}
                        className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border-2 text-xs font-bold transition-all ${
                          shiftType === "r1"
                            ? "border-purple-600 bg-purple-600 text-white shadow-xs"
                            : "border-slate-200 bg-slate-50/60 text-slate-700 hover:border-purple-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                        }`}
                      >
                        <Ambulance className="h-3.5 w-3.5" />
                        <span>R1 (ทีม 1)</span>
                        {shiftType === "r1" && <Check className="h-3.5 w-3.5 ml-auto" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setShiftType("r2")}
                        className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border-2 text-xs font-bold transition-all ${
                          shiftType === "r2"
                            ? "border-purple-600 bg-purple-600 text-white shadow-xs"
                            : "border-slate-200 bg-slate-50/60 text-slate-700 hover:border-purple-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                        }`}
                      >
                        <Ambulance className="h-3.5 w-3.5" />
                        <span>R2 (ทีม 2)</span>
                        {shiftType === "r2" && <Check className="h-3.5 w-3.5 ml-auto" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* เวรดำ / แดง (ไม่ต้องเลือกกรณีเวร R เพราะเวร R ให้ใช้สีเขียว) */}
              {shiftType !== "r1" && shiftType !== "r2" ? (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      หมวดเวร (ดำ / แดง) <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] text-slate-400">
                      *ดำ = ปกติขึ้นครบ | แดง = OT แลกได้
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {/* เวรดำ */}
                    <button
                      type="button"
                      onClick={() => setShiftCategory("black")}
                      className={`flex flex-col items-start p-3 rounded-2xl border-2 text-left transition-all ${
                        shiftCategory === "black"
                          ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-zinc-800 dark:text-white shadow-sm"
                          : "border-slate-200 bg-white hover:border-slate-300 text-slate-700 dark:border-zinc-800 dark:bg-zinc-850 dark:text-zinc-300"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="font-bold text-sm flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-slate-500 dark:bg-slate-300" />
                          เวรดำ (ปกติ)
                        </span>
                        {shiftCategory === "black" && (
                          <Check className="h-4 w-4 text-emerald-400" />
                        )}
                      </div>
                      <span className="text-[11px] leading-tight opacity-80">
                        วันทำงานแลกได้ แต่ต้องขึ้นให้ครบตามตาราง
                      </span>
                    </button>

                    {/* เวรแดง */}
                    <button
                      type="button"
                      onClick={() => setShiftCategory("red")}
                      className={`flex flex-col items-start p-3 rounded-2xl border-2 text-left transition-all ${
                        shiftCategory === "red"
                          ? "border-rose-600 bg-rose-50 text-rose-950 dark:border-rose-500 dark:bg-rose-950/60 dark:text-rose-100 shadow-sm"
                          : "border-slate-200 bg-white hover:border-slate-300 text-slate-700 dark:border-zinc-800 dark:bg-zinc-850 dark:text-zinc-300"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="font-bold text-sm text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-rose-600" />
                          เวรแดง (OT)
                        </span>
                        {shiftCategory === "red" && (
                          <Check className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                        )}
                      </div>
                      <span className="text-[11px] leading-tight text-rose-800/80 dark:text-rose-300/80">
                        เวร OT แลกได้เพื่อไม่ต้องขึ้นก็ได้ และจ่ายค่า OT
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                      หมวดเวร:
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white shadow-2xs">
                      <span className="h-2 w-2 rounded-full bg-white" />
                      เวร R (สีเขียว • ทั้งวัน)
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                    *เวร Refer ไม่ต้องเลือกเวรดำ/แดง ระบบจะแสดงผลด้วยสีเขียวอัตโนมัติ
                  </p>
                </div>
              )}

              {/* แผนก / วอร์ด */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  แผนก / วอร์ด / สถานที่
                </label>
                <input
                  type="text"
                  placeholder="เช่น ICU ผู้ใหญ่, ห้องฉุกเฉิน ER, อายุรกรรม 4"
                  value={shiftDepartment}
                  onChange={(e) => setShiftDepartment(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>

              {/* หมายเหตุ */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  หมายเหตุเพิ่มเติม
                </label>
                <textarea
                  rows={2}
                  placeholder="เช่น แลกเวรกับพี่ก้อย, เคสพิเศษ"
                  value={shiftNote}
                  onChange={(e) => setShiftNote(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>
            </form>
          ) : (
            /* ====================================
               FORM 2: บริการลูกค้า (Service Form)
               ==================================== */
            <form id="service-form" onSubmit={handleSaveService} className="space-y-4">
              {/* Dropdown / Search เลือกลูกค้า พร้อมปุ่ม "+ เพิ่มลูกค้าใหม่" */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    เลือกลูกค้า <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowQuickAddCustomer((v) => !v)}
                    className="flex items-center gap-1 text-xs font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 cursor-pointer"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>{showQuickAddCustomer ? "ซ่อนฟอร์มเพิ่ม" : "+ เพิ่มลูกค้าใหม่"}</span>
                  </button>
                </div>

                {/* Quick Add Customer Panel */}
                {showQuickAddCustomer && (
                  <div className="mb-3 rounded-2xl bg-teal-50/70 p-3 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 animate-in fade-in">
                    <p className="text-xs font-bold text-teal-900 dark:text-teal-200 mb-2">
                      เพิ่มลูกค้าใหม่อย่างรวดเร็ว
                    </p>
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="ชื่อ-นามสกุล หรือชื่อเรียก *"
                        value={quickCustName}
                        onChange={(e) => setQuickCustName(e.target.value)}
                        className="w-full rounded-lg border border-teal-300 bg-white px-3 py-1.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-teal-400 dark:bg-zinc-800 dark:text-white dark:border-teal-700"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="tel"
                          placeholder="เบอร์โทรติดต่อ"
                          value={quickCustPhone}
                          onChange={(e) => setQuickCustPhone(e.target.value)}
                          className="w-full rounded-lg border border-teal-300 bg-white px-3 py-1.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-teal-400 dark:bg-zinc-800 dark:text-white dark:border-teal-700"
                        />
                        <input
                          type="text"
                          placeholder="Note จำแนก (เช่น ซอย/ชั้น/บ้าน)"
                          value={quickCustNote}
                          onChange={(e) => setQuickCustNote(e.target.value)}
                          className="w-full rounded-lg border border-teal-300 bg-white px-3 py-1.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-teal-400 dark:bg-zinc-800 dark:text-white dark:border-teal-700"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowQuickAddCustomer(false)}
                          className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700"
                        >
                          ยกเลิก
                        </button>
                        <button
                          type="button"
                          onClick={handleQuickAddCustomerSubmit}
                          className="rounded-lg bg-teal-600 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-700 shadow-xs"
                        >
                          บันทึกลูกค้า
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Dropdown Customer Select */}
                <div className="relative">
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    required
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  >
                    <option value="" disabled>
                      -- กรุณาเลือกลูกค้า --
                    </option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.note ? `— [${c.note}]` : ""}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-3 top-3 text-slate-400 text-xs">
                    ▼
                  </div>
                </div>

                {/* Selected customer note preview */}
                {selectedCustomerId && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-teal-700 dark:text-teal-400">
                    <span className="font-semibold">โน้ตกำกับ:</span>
                    <span className="truncate">
                      {customers.find((c) => c.id === selectedCustomerId)?.note || "-"}
                    </span>
                  </div>
                )}
              </div>

              {/* ช่องเลือกวันที่และเวลา */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                    วันที่นัดหมาย <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={serviceDate}
                      onChange={(e) => setServiceDate(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs sm:text-sm text-slate-800 outline-none focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                    />
                    <Calendar className="pointer-events-none absolute right-2.5 top-3 h-3.5 w-3.5 text-slate-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                    เวลานัดหมาย <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="time"
                      value={serviceTime}
                      onChange={(e) => setServiceTime(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs sm:text-sm text-slate-800 outline-none focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                    />
                    <Clock className="pointer-events-none absolute right-2.5 top-3 h-3.5 w-3.5 text-slate-400" />
                  </div>
                </div>
              </div>

              {/* Checkbox บริการ: ฉีดยา, ดริปผิว, ส่งของ, อื่นๆ */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  บริการที่นัดหมาย <span className="text-rose-500">*</span>
                </label>

                <div className="grid grid-cols-2 gap-2">
                  {/* ฉีดยา */}
                  <label
                    onClick={() => toggleService("injection")}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border-2 cursor-pointer transition-all ${
                      selectedServices.includes("injection")
                        ? "border-emerald-600 bg-emerald-50/70 text-emerald-900 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-200"
                        : "border-slate-200 bg-white hover:border-slate-300 text-slate-700 dark:border-zinc-800 dark:bg-zinc-850 dark:text-zinc-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedServices.includes("injection")}
                      onChange={() => {}}
                      className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <Syringe className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="text-xs font-bold">ฉีดยา</span>
                  </label>

                  {/* ดริปผิว */}
                  <label
                    onClick={() => toggleService("drip")}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border-2 cursor-pointer transition-all ${
                      selectedServices.includes("drip")
                        ? "border-teal-600 bg-teal-50/70 text-teal-900 dark:border-teal-500 dark:bg-teal-950/40 dark:text-teal-200"
                        : "border-slate-200 bg-white hover:border-slate-300 text-slate-700 dark:border-zinc-800 dark:bg-zinc-850 dark:text-zinc-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedServices.includes("drip")}
                      onChange={() => {}}
                      className="h-4 w-4 rounded text-teal-600 focus:ring-teal-500"
                    />
                    <Sparkles className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0" />
                    <span className="text-xs font-bold">ดริปผิว</span>
                  </label>

                  {/* ส่งของ */}
                  <label
                    onClick={() => toggleService("delivery")}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border-2 cursor-pointer transition-all ${
                      selectedServices.includes("delivery")
                        ? "border-purple-600 bg-purple-50/70 text-purple-900 dark:border-purple-500 dark:bg-purple-950/40 dark:text-purple-200"
                        : "border-slate-200 bg-white hover:border-slate-300 text-slate-700 dark:border-zinc-800 dark:bg-zinc-850 dark:text-zinc-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedServices.includes("delivery")}
                      onChange={() => {}}
                      className="h-4 w-4 rounded text-purple-600 focus:ring-purple-500"
                    />
                    <Package className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
                    <span className="text-xs font-bold">ส่งของ</span>
                  </label>

                  {/* อื่นๆ */}
                  <label
                    onClick={() => toggleService("other")}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border-2 cursor-pointer transition-all ${
                      selectedServices.includes("other")
                        ? "border-slate-600 bg-slate-100 text-slate-900 dark:border-zinc-500 dark:bg-zinc-800 dark:text-white"
                        : "border-slate-200 bg-white hover:border-slate-300 text-slate-700 dark:border-zinc-800 dark:bg-zinc-850 dark:text-zinc-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedServices.includes("other")}
                      onChange={() => {}}
                      className="h-4 w-4 rounded text-slate-600 focus:ring-slate-500"
                    />
                    <MoreHorizontal className="h-4 w-4 text-slate-600 dark:text-zinc-400 shrink-0" />
                    <span className="text-xs font-bold">อื่นๆ</span>
                  </label>
                </div>

                {/* รายละเอียดบริการอื่นๆ ถ้าเลือก "อื่นๆ" */}
                {selectedServices.includes("other") && (
                  <div className="mt-2">
                    <input
                      type="text"
                      placeholder="ระบุบริการอื่นๆ เช่น ทำแผล, วัดความดัน, ตรวจสุขภาพ"
                      value={otherServiceText}
                      onChange={(e) => setOtherServiceText(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-teal-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                    />
                  </div>
                )}
              </div>

              {/* Dynamic Input ยา: แสดงช่องกรอกชื่อยา (เพิ่ม/ลบได้หลายตัว) โผล่ขึ้นมาเฉพาะเมื่อเลือกติ๊กถูก "ฉีดยา" */}
              {selectedServices.includes("injection") && (
                <div className="rounded-2xl bg-emerald-50/60 p-3.5 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800/80 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Syringe className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                        รายการยาที่ต้องฉีด (Dynamic Input)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddMedication}
                      className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 shadow-xs transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                      <span>เพิ่มยา</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {medications.map((med, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 w-4 text-right">
                          {idx + 1}.
                        </span>
                        <input
                          type="text"
                          placeholder="ชื่อยาและขนาดยา เช่น Insulin Glargine 14 Units"
                          value={med}
                          onChange={(e) => handleUpdateMedication(idx, e.target.value)}
                          className="flex-1 rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-400 dark:border-emerald-800 dark:bg-zinc-850 dark:text-white"
                        />
                        {medications.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMedication(idx)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-100 hover:text-rose-700 dark:hover:bg-rose-950/50 transition-colors"
                            title="ลบรายการยานี้"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ค่าบริการ & หมายเหตุ */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    ค่าบริการ (บาท)
                  </label>
                  <input
                    type="number"
                    placeholder="เช่น 500"
                    value={servicePrice}
                    onChange={(e) => setServicePrice(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-teal-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    หมายเหตุ / อาการ
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น ตรวจน้ำตาลก่อนฉีด"
                    value={serviceNote}
                    onChange={(e) => setServiceNote(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-teal-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer Buttons */}
        <div className="border-t border-surface-subtle dark:border-zinc-800 bg-surface-subtle/50 px-5 py-3 dark:bg-zinc-900/80 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={toggleModal}
            className="rounded-xl px-4 py-2.5 text-xs font-semibold text-text-muted hover:bg-surface-subtle hover:text-text-main dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            form={activeTab === "shift" ? "shift-form" : "service-form"}
            className="rounded-xl px-6 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-sky-500 to-emerald-600 shadow-md shadow-emerald-600/20 hover:brightness-105 transition-all active:scale-95"
          >
            {activeTab === "shift" ? "บันทึกเวร" : "บันทึกนัดหมาย"}
          </button>
        </div>
      </div>
    </div>
  );
}
