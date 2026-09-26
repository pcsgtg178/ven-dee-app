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
  ScanSquare,
  Moon,
  Sun,
  Sunset,
  AlertCircle,
  Check,
  UserPlus,
  Ambulance,
  Bed,
  Building2,
  Settings,
  Pill,
} from "lucide-react";
import {
  Customer,
  ShiftCategory,
  ShiftType,
  ClinicPresetShift,
  Medications,
} from "../../types/vendee";
import {
  getCustomers,
  saveCustomer,
  saveService,
  saveShift,
  saveClinicLog,
  getMedications,
} from "../../lib/storage";
import ModalMedicationManager from "./ModalMedicationManager";

interface ModalAddTodoProps {
  openModal: boolean;
  toggleModal: () => void;
  initialTab?: "shift" | "service" | "clinic";
  initialCustomerId?: string;
  defaultDate?: string;
  onSuccess?: () => void;
}

const CLINIC_PRESETS: ClinicPresetShift[] = [
  "12:30 - 17:30",
  "17:00 - 19:30",
  "12:30 - 19:30",
];

export default function ModalAddTodo({
  openModal,
  toggleModal,
  initialTab = "shift",
  initialCustomerId,
  defaultDate,
  onSuccess,
}: ModalAddTodoProps) {
  const [activeTab, setActiveTab] = useState<"shift" | "service" | "clinic">(
    initialTab,
  );

  // Customers & Medications state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [masterMedications, setMasterMedications] = useState<Medications[]>([]);
  const [showQuickAddCustomer, setShowQuickAddCustomer] = useState(false);
  const [quickCustName, setQuickCustName] = useState("");
  const [openMedManagerModal, setOpenMedManagerModal] = useState(false);

  // Shift Form State
  const [shiftDate, setShiftDate] = useState("");
  const [shiftType, setShiftType] = useState<ShiftType>("morning");
  const [shiftCategory, setShiftCategory] = useState<ShiftCategory>("black");
  const [shiftNote, setShiftNote] = useState("");

  // Customer Service Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [serviceDate, setServiceDate] = useState("");
  const [serviceTime, setServiceTime] = useState("09:00");
  const [medications, setMedications] = useState<string[]>([""]);
  const [serviceNote, setServiceNote] = useState("");
  const [servicePrice, setServicePrice] = useState("");

  // Clinic Form State
  const [clinicDate, setClinicDate] = useState("");
  const [clinicPresetShift, setClinicPresetShift] =
    useState<ClinicPresetShift>("12:30 - 17:30");
  const [clinicNote, setClinicNote] = useState("");

  // Loading & error
  const [errorMsg, setErrorMsg] = useState("");

  const loadMasterData = () => {
    setCustomers(getCustomers());
    setMasterMedications(getMedications());
  };

  useEffect(() => {
    if (openModal) {
      loadMasterData();

      const todayStr = defaultDate || new Date().toISOString().split("T")[0];
      setShiftDate(todayStr);
      setServiceDate(todayStr);
      setClinicDate(todayStr);

      const allCust = getCustomers();
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
  const handleSaveShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftDate) {
      setErrorMsg("กรุณาระบุวันที่ขึ้นเวร");
      return;
    }

    const categoryToSave: ShiftCategory =
      shiftType === "r1" || shiftType === "r2"
        ? "green"
        : shiftType === "off"
          ? "gray"
          : shiftType === "ctm" || shiftType === "cta"
            ? "purple"
            : shiftCategory;

    try {
      await saveShift({
        date: shiftDate,
        shiftType,
        category: categoryToSave,
        note: shiftNote.trim() || undefined,
      });

      toggleModal();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || "เกิดข้อผิดพลาดในการบันทึกเวร");
    }
  };

  // Customer service form submit
  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      setErrorMsg("กรุณาเลือกลูกค้า");
      return;
    }
    if (!serviceDate || !serviceTime) {
      setErrorMsg("กรุณาระบุวันที่และเวลานัดหมาย");
      return;
    }

    const currentCustomer = customers.find((c) => c.id === selectedCustomerId);
    if (!currentCustomer) {
      setErrorMsg("ไม่พบข้อมูลลูกค้าที่เลือก");
      return;
    }

    const validMeds = medications.map((m) => m.trim()).filter(Boolean);

    try {
      await saveService({
        customerId: currentCustomer.id,
        customerName: currentCustomer.name,
        date: serviceDate,
        time: serviceTime,
        medications: validMeds && validMeds.length > 0 ? validMeds : undefined,
        note: serviceNote.trim() || undefined,
        price: servicePrice ? Number(servicePrice) : undefined,
      });

      toggleModal();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || "เกิดข้อผิดพลาดในการบันทึกบริการลูกค้า");
    }
  };

  // Clinic form submit
  const handleSaveClinicLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicDate) {
      setErrorMsg("กรุณาระบุวันที่เข้าเวรคลินิก");
      return;
    }

    try {
      saveClinicLog({
        date: clinicDate,
        presetShift: clinicPresetShift,
        note: clinicNote.trim() || undefined,
      });

      toggleModal();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || "เกิดข้อผิดพลาดในการบันทึกงานคลินิก");
    }
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
  const handleQuickAddCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCustName.trim()) {
      setErrorMsg("กรุณากรอกชื่อลูกค้า");
      return;
    }

    try {
      const newCust = await saveCustomer({
        name: quickCustName.trim(),
      });

      const updated = getCustomers();
      setCustomers(updated);
      setSelectedCustomerId(newCust.id);
      setShowQuickAddCustomer(false);
      setQuickCustName("");
      setErrorMsg("");
    } catch (err: any) {
      setErrorMsg(err.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูลลูกค้า");
    }
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

        {/* Tab Switcher: [ ขึ้นเวร ] | [ บริการลูกค้า ] | [ คลินิก ] */}
        <div className="px-5 pt-3 pb-2 bg-surface-subtle/60 dark:bg-zinc-900/70">
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-surface-subtle p-1 dark:bg-zinc-800">
            <button
              type="button"
              onClick={() => {
                setActiveTab("shift");
                setErrorMsg("");
              }}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-all ${
                activeTab === "shift"
                  ? "bg-card-bg text-secondary shadow-xs dark:bg-zinc-700 dark:text-secondary-light font-bold"
                  : "text-text-muted hover:text-text-main dark:text-zinc-400 dark:hover:text-white"
              }`}
            >
              <Moon className="h-3.5 w-3.5" />
              <span>ขึ้นเวร</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("service");
                setErrorMsg("");
              }}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-all ${
                activeTab === "service"
                  ? "bg-card-bg text-primary shadow-xs dark:bg-zinc-700 dark:text-primary-light font-bold"
                  : "text-text-muted hover:text-text-main dark:text-zinc-400 dark:hover:text-white"
              }`}
            >
              <User className="h-3.5 w-3.5" />
              <span>บริการลูกค้า</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("clinic");
                setErrorMsg("");
              }}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-all ${
                activeTab === "clinic"
                  ? "bg-card-bg text-purple-600 shadow-xs dark:bg-zinc-700 dark:text-purple-300 font-bold"
                  : "text-text-muted hover:text-text-main dark:text-zinc-400 dark:hover:text-white"
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>คลินิก</span>
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
            <form
              id="shift-form"
              onSubmit={handleSaveShift}
              className="space-y-4"
            >
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

              {/* Shift type buttons */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  ประเภทเวร <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {/* เวรดึก */}
                  <button
                    type="button"
                    onClick={() => setShiftType("night")}
                    className={`relative flex flex-col items-center justify-center p-1.5 rounded-2xl border-2 transition-all touch-manipulation text-center ${
                      shiftType === "night"
                        ? "border-indigo-600 bg-indigo-50/80 text-indigo-900 shadow-sm dark:border-indigo-400 dark:bg-indigo-950/50 dark:text-indigo-200"
                        : "border-slate-200 bg-white hover:border-slate-300 text-slate-700 dark:border-zinc-800 dark:bg-zinc-850 dark:text-zinc-300"
                    }`}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/60 mb-1 text-indigo-700 dark:text-indigo-300">
                      <Moon className="h-4 w-4" />
                    </div>
                    <span className="font-bold text-xs">เวรดึก (1)</span>
                  </button>

                  {/* เวรเช้า */}
                  <button
                    type="button"
                    onClick={() => setShiftType("morning")}
                    className={`relative flex flex-col items-center justify-center p-1.5 rounded-2xl border-2 transition-all touch-manipulation text-center ${
                      shiftType === "morning"
                        ? "border-amber-500 bg-amber-50/80 text-amber-900 shadow-sm dark:border-amber-400 dark:bg-amber-950/50 dark:text-amber-200"
                        : "border-slate-200 bg-white hover:border-slate-300 text-slate-700 dark:border-zinc-800 dark:bg-zinc-850 dark:text-zinc-300"
                    }`}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/60 mb-1 text-amber-700 dark:text-amber-300">
                      <Sun className="h-4 w-4" />
                    </div>
                    <span className="font-bold text-xs">เวรเช้า (2)</span>
                  </button>

                  {/* เวรบ่าย */}
                  <button
                    type="button"
                    onClick={() => setShiftType("afternoon")}
                    className={`relative flex flex-col items-center justify-center p-1.5 rounded-2xl border-2 transition-all touch-manipulation text-center ${
                      shiftType === "afternoon"
                        ? "border-sky-600 bg-sky-50/80 text-sky-900 shadow-sm dark:border-sky-400 dark:bg-sky-950/50 dark:text-sky-200"
                        : "border-slate-200 bg-white hover:border-slate-300 text-slate-700 dark:border-zinc-800 dark:bg-zinc-850 dark:text-zinc-300"
                    }`}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-900/60 mb-1 text-sky-700 dark:text-sky-300">
                      <Sunset className="h-4 w-4" />
                    </div>
                    <span className="font-bold text-xs">เวรบ่าย (3)</span>
                  </button>
                </div>

                <div className="mt-2 grid grid-cols-3 gap-2">
                  {/* Off */}
                  <button
                    type="button"
                    onClick={() => setShiftType("off")}
                    className={`relative flex flex-col items-center justify-center p-1.5 rounded-2xl border-2 transition-all touch-manipulation text-center ${
                      shiftType === "off"
                        ? "border-slate-900 bg-slate-100 text-slate-900 shadow-sm dark:border-white dark:bg-zinc-800 dark:text-white"
                        : "border-slate-200 bg-white hover:border-slate-300 text-slate-700 dark:border-zinc-800 dark:bg-zinc-850 dark:text-zinc-300"
                    }`}
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 mb-1 text-slate-700 dark:text-slate-300">
                      <Bed className="h-3.5 w-3.5" />
                    </div>
                    <span className="font-bold text-[11px]">Off (0)</span>
                  </button>

                  {/* Refer */}
                  <button
                    type="button"
                    onClick={() => {
                      if (shiftType !== "r1" && shiftType !== "r2")
                        setShiftType("r1");
                    }}
                    className={`relative flex flex-col items-center justify-center p-1.5 rounded-2xl border-2 transition-all touch-manipulation text-center ${
                      shiftType === "r1" || shiftType === "r2"
                        ? "border-emerald-500 bg-emerald-50/80 text-emerald-900 shadow-sm dark:border-emerald-400 dark:bg-emerald-950/50 dark:text-emerald-200"
                        : "border-slate-200 bg-white hover:border-slate-300 text-slate-700 dark:border-zinc-800 dark:bg-zinc-850 dark:text-zinc-300"
                    }`}
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/60 mb-1 text-emerald-700 dark:text-emerald-300">
                      <Ambulance className="h-3.5 w-3.5" />
                    </div>
                    <span className="font-bold text-[11px]">Refer (R)</span>
                  </button>

                  {/* CT เช้า */}
                  <button
                    type="button"
                    onClick={() => {
                      if (shiftType !== "ctm" && shiftType !== "cta")
                        setShiftType("ctm");
                    }}
                    className={`relative flex flex-col items-center justify-center p-1.5 rounded-2xl border-2 transition-all touch-manipulation text-center ${
                      shiftType === "ctm" || shiftType === "cta"
                        ? "border-purple-600 bg-purple-50/80 text-purple-900 shadow-sm dark:border-purple-400 dark:bg-purple-950/50 dark:text-purple-200"
                        : "border-slate-200 bg-white hover:border-slate-300 text-slate-700 dark:border-zinc-800 dark:bg-zinc-850 dark:text-zinc-300"
                    }`}
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/60 mb-1 text-purple-700 dark:text-purple-300">
                      <ScanSquare className="h-3.5 w-3.5" />
                    </div>
                    <span className="font-bold text-[11px]">CT</span>
                  </button>
                </div>
              </div>

              {/* Shift Category: Black / Red */}
              {(shiftType === "morning" ||
                shiftType === "afternoon" ||
                shiftType === "night") && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                    หมวดเวร <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setShiftCategory("black")}
                      className={`flex flex-col items-start p-3 rounded-2xl border-2 text-left transition-all ${
                        shiftCategory === "black"
                          ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900 font-bold"
                          : "border-slate-200 bg-white text-slate-700 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
                      }`}
                    >
                      <span className="text-xs font-extrabold">
                        เวรดำ (ประจำ)
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShiftCategory("red")}
                      className={`flex flex-col items-start p-3 rounded-2xl border-2 text-left transition-all ${
                        shiftCategory === "red"
                          ? "border-rose-600 bg-rose-50 text-rose-900 dark:border-rose-400 dark:bg-rose-950/60 dark:text-rose-200 font-bold"
                          : "border-slate-200 bg-white text-slate-700 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
                      }`}
                    >
                      <span className="text-xs font-extrabold text-rose-600 dark:text-rose-400">
                        เวรแดง (OT)
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* Shift Category: Black / Red */}
              {(shiftType === "r1" || shiftType === "r2") && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                    ตัวเลือกทีม Refer <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setShiftType("r1")}
                      className={`flex flex-col items-start p-3 rounded-2xl border-2 text-left transition-all ${
                        shiftType === "r1"
                          ? "border-emerald-600 bg-emerald-50 text-emerald-900 dark:border-emerald-400 dark:bg-emerald-950/60 dark:text-emerald-200 font-bold"
                          : "border-emerald-200 bg-white text-emerald-700 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
                      }`}
                    >
                      <div
                        className={`flex gap-1.5 items-center text-xs font-extrabold ${shiftType === "r1" ? "text-emerald-500 justify-center" : "text-emerald-700 dark:text-emerald-300"}`}
                      >
                        <Ambulance className="h-3.5 w-3.5" />
                        Refer ทีม 1
                        {shiftType === "r1" && (
                          <Check className="h-3.5 w-3.5" />
                        )}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShiftType("r2")}
                      className={`flex flex-col items-start p-3 rounded-2xl border-2 text-left transition-all ${
                        shiftType === "r2"
                          ? "border-emerald-600 bg-emerald-50 text-emerald-900 dark:border-emerald-400 dark:bg-emerald-950/60 dark:text-emerald-200 font-bold"
                          : "border-emerald-200 bg-white text-emerald-700 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
                      }`}
                    >
                      <div
                        className={`flex gap-1.5 items-center text-xs font-extrabold ${shiftType === "r2" ? "text-emerald-500 justify-center" : "text-emerald-700 dark:text-emerald-300"}`}
                      >
                        <Ambulance className="h-3.5 w-3.5" />
                        Refer ทีม 2
                        {shiftType === "r2" && (
                          <Check className="h-3.5 w-3.5" />
                        )}
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Shift Type: CT */}
              {(shiftType === "ctm" || shiftType === "cta") && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                    ตัวเลือกเวร CT <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setShiftType("ctm")}
                      className={`flex flex-col items-start p-3 rounded-2xl border-2 text-left transition-all ${
                        shiftType === "ctm"
                          ? "border-purple-600 bg-purple-50 text-purple-900 dark:border-purple-400 dark:bg-purple-950/60 dark:text-purple-200 font-bold"
                          : "border-slate-200 bg-white text-slate-700 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
                      }`}
                    >
                      <span className="text-xs font-extrabold">CT เช้า</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShiftType("cta")}
                      className={`flex flex-col items-start p-3 rounded-2xl border-2 text-left transition-all ${
                        shiftType === "cta"
                          ? "border-purple-600 bg-purple-50 text-purple-900 dark:border-purple-400 dark:bg-purple-950/60 dark:text-purple-200 font-bold"
                          : "border-slate-200 bg-white text-slate-700 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
                      }`}
                    >
                      <span className="text-xs font-extrabold">CT บ่าย</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Note */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  หมายเหตุ
                </label>
                <input
                  type="text"
                  placeholder="ระบุหมายเหตุเพิ่มเติม..."
                  value={shiftNote}
                  onChange={(e) => setShiftNote(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-blue-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>
            </form>
          ) : activeTab === "service" ? (
            /* ====================================
               FORM 2: บริการลูกค้า (Service Form)
               ==================================== */
            <form
              id="service-form"
              onSubmit={handleSaveService}
              className="space-y-4"
            >
              {/* Customer Selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    เลือกลูกค้า <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setShowQuickAddCustomer(!showQuickAddCustomer)
                    }
                    className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    <UserPlus className="h-3 w-3" />
                    <span>+ เพิ่มลูกค้าใหม่</span>
                  </button>
                </div>

                {showQuickAddCustomer ? (
                  <div className="rounded-xl border border-emerald-300 bg-emerald-50/60 p-3 dark:border-emerald-800 dark:bg-emerald-950/40 space-y-2">
                    <input
                      type="text"
                      placeholder="ระบุชื่อลูกค้าใหม่..."
                      value={quickCustName}
                      onChange={(e) => setQuickCustName(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800 outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowQuickAddCustomer(false)}
                        className="rounded-lg px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200 dark:text-zinc-400 dark:hover:bg-zinc-700"
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="button"
                        onClick={handleQuickAddCustomerSubmit}
                        className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700"
                      >
                        บันทึกลูกค้า
                      </button>
                    </div>
                  </div>
                ) : (
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                    วันที่ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={serviceDate}
                    onChange={(e) => setServiceDate(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                    เวลา <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={serviceTime}
                    onChange={(e) => setServiceTime(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                </div>
              </div>

              {/* Dynamic Drug Selector Section */}
              <div className="rounded-2xl bg-emerald-50/60 p-3.5 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Syringe className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                      รายการยาที่ใช้ (Drug Selector)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setOpenMedManagerModal(true)}
                      className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:underline"
                      title="จัดการคลังยา"
                    >
                      <Pill className="h-3 w-3" />
                      <span>จัดการยา</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleAddMedication}
                      className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 shadow-xs"
                    >
                      <Plus className="h-3 w-3" />
                      <span>เพิ่มยา</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {medications.map((med, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 w-4 text-right">
                        {idx + 1}.
                      </span>
                      {/* Dropdown / Input Combination */}
                      <div className="flex-1 flex gap-1.5">
                        {masterMedications.length > 0 && (
                          <select
                            onChange={(e) => {
                              if (e.target.value)
                                handleUpdateMedication(idx, e.target.value);
                            }}
                            defaultValue=""
                            className="rounded-xl border border-emerald-300 bg-white px-2 py-1.5 text-xs text-slate-800 dark:border-emerald-800 dark:bg-zinc-850 dark:text-white"
                          >
                            <option value="" disabled>
                              -- เลือกจากคลัง --
                            </option>
                            {masterMedications.map((m) => (
                              <option key={m.id} value={m.name}>
                                {m.name} {m.price ? `(฿${m.price})` : ""}
                              </option>
                            ))}
                          </select>
                        )}
                        <input
                          type="text"
                          placeholder="ชื่อยา / ขนาดยา"
                          value={med}
                          onChange={(e) =>
                            handleUpdateMedication(idx, e.target.value)
                          }
                          className="flex-1 rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-emerald-500 dark:border-emerald-800 dark:bg-zinc-850 dark:text-white"
                        />
                      </div>
                      {medications.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMedication(idx)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-100 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  บริการ / รายละเอียด
                </label>
                <input
                  type="text"
                  placeholder="ระบุรายละเอียดนัดหมาย"
                  value={serviceNote}
                  onChange={(e) => setServiceNote(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>

              {/* Price */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  ค่าบริการ (บาท)
                </label>
                <input
                  type="number"
                  placeholder="เช่น 500"
                  value={servicePrice}
                  onChange={(e) => setServicePrice(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>
            </form>
          ) : (
            /* ====================================
               FORM 3: คลินิก (Clinic Log Form)
               ==================================== */
            <form
              id="clinic-form"
              onSubmit={handleSaveClinicLog}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  วันที่ปฏิบัติงานคลินิก{" "}
                  <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={clinicDate}
                    onChange={(e) => setClinicDate(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-purple-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                  <Calendar className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />
                </div>
              </div>

              {/* 3 Preset Working Shifts */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-2">
                  เลือกกะเวลาคลินิก (Preset Shift){" "}
                  <span className="text-rose-500">*</span>
                </label>
                <div className="space-y-2">
                  {CLINIC_PRESETS.map((preset) => {
                    const isSelected = clinicPresetShift === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setClinicPresetShift(preset)}
                        className={`flex w-full items-center justify-between rounded-xl border p-3 text-xs font-bold transition-all ${
                          isSelected
                            ? "border-purple-600 bg-purple-50 text-purple-900 dark:bg-purple-950/60 dark:text-purple-200 shadow-xs"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-850 dark:text-zinc-300"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Clock
                            className={`h-4 w-4 ${isSelected ? "text-purple-600 dark:text-purple-300" : "text-slate-400"}`}
                          />
                          <span>{preset} น.</span>
                        </div>
                        {isSelected && (
                          <Check className="h-4 w-4 text-purple-600 dark:text-purple-300" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  หมายเหตุ (ถ้ามี)
                </label>
                <input
                  type="text"
                  placeholder="เช่น ทำงานกะพิเศษ, ตรวจเคสเสริม"
                  value={clinicNote}
                  onChange={(e) => setClinicNote(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-purple-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
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
            form={
              activeTab === "shift"
                ? "shift-form"
                : activeTab === "service"
                  ? "service-form"
                  : "clinic-form"
            }
            className={`flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:brightness-105 transition-all ${
              activeTab === "shift"
                ? "bg-secondary"
                : activeTab === "service"
                  ? "bg-primary"
                  : "bg-purple-600"
            }`}
          >
            <Check className="h-4 w-4" />
            <span>
              {activeTab === "shift"
                ? "บันทึกการขึ้นเวร"
                : activeTab === "service"
                  ? "บันทึกบริการลูกค้า"
                  : "บันทึกกะคลินิก"}
            </span>
          </button>
        </div>
      </div>

      {/* Medication Manager Modal nested */}
      <ModalMedicationManager
        isOpen={openMedManagerModal}
        onClose={() => {
          setOpenMedManagerModal(false);
          setMasterMedications(getMedications());
        }}
      />
    </div>
  );
}
