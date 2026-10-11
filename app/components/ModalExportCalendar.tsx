"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Calendar,
  Download,
  Rss,
  Copy,
  Check,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Info,
  ExternalLink,
  X,
  CalendarDays,
  Sparkles,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import moment from "moment";
import "moment/locale/th";
import {
  getShifts,
  getServices,
  getClinicLogs,
  getPersonalEvents,
  getCalendarFeedConfig,
  saveCalendarFeedConfig,
  regenerateCalendarFeedToken,
} from "../../lib/storage";
import { generateIcsCalendar } from "../../lib/calendar/icsGenerator";
import { CalendarFeedConfig } from "../../types/vendee";

export interface ModalExportCalendarProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMonth?: string; // YYYY-MM
}

export default function ModalExportCalendar({
  isOpen,
  onClose,
  defaultMonth,
}: ModalExportCalendarProps) {
  // Active Tab: "download" | "subscribe" | "guide"
  const [activeTab, setActiveTab] = useState<"download" | "subscribe" | "guide">("download");

  // Selected Month for Direct Download (Default to current month or props)
  const currentMonth = useMemo(() => defaultMonth || moment().format("YYYY-MM"), [defaultMonth]);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);

  // Filters (Adheres to DOMAIN_RULES 4.1.2: off days default false)
  const [includeShifts, setIncludeShifts] = useState(true);
  const [includeServices, setIncludeServices] = useState(true);
  const [includePersonalEvents, setIncludePersonalEvents] = useState(true);
  const [includeClinic, setIncludeClinic] = useState(true);
  const [includeOffDays, setIncludeOffDays] = useState(false);

  // Feed config state
  const [feedConfig, setFeedConfig] = useState<CalendarFeedConfig>(() => getCalendarFeedConfig());
  const [isCopied, setIsCopied] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);

  // Synchronize initial state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedMonth(defaultMonth || moment().format("YYYY-MM"));
      setFeedConfig(getCalendarFeedConfig());
      setDownloadSuccess(false);
      setIsCopied(false);
      setShowRegenConfirm(false);
    }
  }, [isOpen, defaultMonth]);

  // Construct absolute subscription URLs
  const origin = typeof window !== "undefined" ? window.location.origin : "https://vendee.app";
  const webcalUrl = useMemo(() => {
    const host = origin.replace(/^https?:\/\//, "");
    return `webcal://${host}/api/calendar/feed?token=${encodeURIComponent(feedConfig.feedToken)}${
      includeOffDays ? "&includeOff=true" : ""
    }`;
  }, [origin, feedConfig.feedToken, includeOffDays]);

  const httpsFeedUrl = useMemo(() => {
    return `${origin}/api/calendar/feed?token=${encodeURIComponent(feedConfig.feedToken)}${
      includeOffDays ? "&includeOff=true" : ""
    }`;
  }, [origin, feedConfig.feedToken, includeOffDays]);

  // Month options for quick selection (Previous, Current, Next 3 months)
  const monthOptions = useMemo(() => {
    const list: { key: string; label: string }[] = [];
    const base = moment();
    for (let i = -1; i <= 3; i++) {
      const m = moment(base).add(i, "months");
      const key = m.format("YYYY-MM");
      const label = m.locale("th").format("MMMM YYYY (พ.ศ. ") + (m.year() + 543) + ")";
      list.push({ key, label });
    }
    return list;
  }, []);

  // Handle direct .ics file generation & download
  const handleDownloadIcs = useCallback(() => {
    try {
      const shifts = getShifts();
      const services = getServices();
      const clinicLogs = getClinicLogs();
      const personalEvents = getPersonalEvents();

      const icsString = generateIcsCalendar({
        shifts,
        services,
        clinicLogs,
        personalEvents,
        options: {
          month: selectedMonth,
          includeShifts,
          includeServices,
          includePersonalEvents,
          includeClinic,
          includeOffDays,
        },
        calendarName: `VenDee ${moment(selectedMonth).locale("th").format("MMMM YYYY")}`,
      });

      // Trigger client-side download
      const blob = new Blob([icsString], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `vendee-${selectedMonth}.ics`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err: any) {
      alert("เกิดข้อผิดพลาดในการดาวน์โหลดปฏิทิน: " + (err.message || "Unknown error"));
    }
  }, [selectedMonth, includeShifts, includeServices, includePersonalEvents, includeClinic, includeOffDays]);

  // Copy feed URL to clipboard
  const handleCopyLink = useCallback(
    (urlToCopy: string) => {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        navigator.clipboard.writeText(urlToCopy).then(() => {
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2500);
        });
      }
    },
    []
  );

  // Regenerate security feed token
  const handleRegenerateToken = async () => {
    setIsRegenerating(true);
    try {
      const newToken = await regenerateCalendarFeedToken();
      setFeedConfig((prev) => ({ ...prev, feedToken: newToken }));
      setShowRegenConfirm(false);
      setIsCopied(false);
    } catch (err: any) {
      alert("ไม่สามารถรีเซ็ตโทเค็นได้: " + err.message);
    } finally {
      setIsRegenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 dark:border-zinc-800 flex flex-col max-h-[92dvh] overflow-hidden animate-in slide-in-from-bottom duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-export-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white shadow-sm">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="calendar-export-title"
                className="text-base font-bold text-slate-900 dark:text-white leading-tight"
              >
                ส่งออกปฏิทิน iPhone / iOS
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                ซิงก์เวรและงานลง Apple Calendar สะดวก มองเห็นบน Apple Watch
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors cursor-pointer"
            aria-label="ปิด"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 pt-3 shrink-0">
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-zinc-800/80 rounded-2xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab("download")}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all cursor-pointer ${
                activeTab === "download"
                  ? "bg-white dark:bg-zinc-700 text-sky-600 dark:text-sky-300 shadow-xs"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Download className="h-3.5 w-3.5" />
              <span>ดาวน์โหลด .ics</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("subscribe")}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all cursor-pointer ${
                activeTab === "subscribe"
                  ? "bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-300 shadow-xs"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Rss className="h-3.5 w-3.5" />
              <span>สมัครรับ (WebCal)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("guide")}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all cursor-pointer ${
                activeTab === "guide"
                  ? "bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-300 shadow-xs"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span>วิธีตั้งค่าบน iPhone</span>
            </button>
          </div>
        </div>

        {/* Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* TAB 1: DIRECT DOWNLOAD */}
          {activeTab === "download" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Month Selector */}
              <div className="bg-slate-50 dark:bg-zinc-800/50 p-3.5 rounded-2xl border border-slate-200/70 dark:border-zinc-800">
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  เลือกเดือนที่ต้องการส่งออก
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm font-medium text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {monthOptions.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1.5 flex items-center gap-1">
                  <Info className="h-3.5 w-3.5 shrink-0 text-sky-500" />
                  ดาวน์โหลดไฟล์ .ics สามารถเปิดเพื่อเพิ่มลงปฏิทิน Apple หรือ Google Calendar ได้ทันที
                </p>
              </div>

              {/* Filter Options */}
              <div className="bg-white dark:bg-zinc-800/40 rounded-2xl border border-slate-200 dark:border-zinc-800 p-3.5 space-y-2.5">
                <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 block mb-1">
                  หมวดหมู่ที่ต้องการรวมในไฟล์
                </span>

                <label className="flex items-center justify-between text-xs text-slate-700 dark:text-zinc-300 cursor-pointer">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
                    เวรโรงพยาบาล (เช้า, บ่าย, ดึก, Refer, CT)
                  </span>
                  <input
                    type="checkbox"
                    checked={includeShifts}
                    onChange={(e) => setIncludeShifts(e.target.checked)}
                    className="h-4 w-4 rounded accent-sky-600 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between text-xs text-slate-700 dark:text-zinc-300 cursor-pointer">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                    งานบริการเคหะบริบาล (นัดหมายลูกค้า)
                  </span>
                  <input
                    type="checkbox"
                    checked={includeServices}
                    onChange={(e) => setIncludeServices(e.target.checked)}
                    className="h-4 w-4 rounded accent-sky-600 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between text-xs text-slate-700 dark:text-zinc-300 cursor-pointer">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                    ธุระส่วนตัว / กิจกรรมส่วนตัว
                  </span>
                  <input
                    type="checkbox"
                    checked={includePersonalEvents}
                    onChange={(e) => setIncludePersonalEvents(e.target.checked)}
                    className="h-4 w-4 rounded accent-sky-600 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between text-xs text-slate-700 dark:text-zinc-300 cursor-pointer">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-purple-500"></span>
                    กะปฏิบัติงานคลินิก
                  </span>
                  <input
                    type="checkbox"
                    checked={includeClinic}
                    onChange={(e) => setIncludeClinic(e.target.checked)}
                    className="h-4 w-4 rounded accent-sky-600 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between text-xs text-slate-700 dark:text-zinc-300 cursor-pointer pt-1 border-t border-slate-100 dark:border-zinc-800">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-slate-400"></span>
                    รวมวันหยุด (เวรออฟ)
                  </span>
                  <input
                    type="checkbox"
                    checked={includeOffDays}
                    onChange={(e) => setIncludeOffDays(e.target.checked)}
                    className="h-4 w-4 rounded accent-sky-600 cursor-pointer"
                  />
                </label>
              </div>

              {/* Download Action Button */}
              <button
                type="button"
                onClick={handleDownloadIcs}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-bold text-sm shadow-md hover:from-sky-600 hover:to-indigo-700 active:scale-98 transition-all cursor-pointer touch-manipulation"
              >
                {downloadSuccess ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>ดาวน์โหลดไฟล์สำเร็จ!</span>
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    <span>ดาวน์โหลดไฟล์ .ics สำหรับเดือนนี้</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* TAB 2: LIVE WEBCAL SUBSCRIPTION */}
          {activeTab === "subscribe" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Highlight Card */}
              <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 p-4 rounded-2xl">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm mb-1">
                  <Sparkles className="h-4 w-4" />
                  <span>ซิงก์อัปเดตอัตโนมัติ (Live Sync)</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
                  สมัครรับปฏิทินครั้งเดียว เมื่อคุณมีการบันทึกเวรใหม่ สลับเวร หรือแก้เวลานัดในแอป
                  ระบบของ iPhone จะอัปเดตตารางเวรให้โดยอัตโนมัติในพื้นหลัง
                </p>
              </div>

              {/* One-Tap Subscribe Button for iOS Safari */}
              <div>
                <a
                  href={webcalUrl}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-sm shadow-md hover:from-emerald-700 hover:to-teal-700 active:scale-98 transition-all touch-manipulation"
                >
                  <Smartphone className="h-4 w-4" />
                  <span>แตะเพื่อสมัครรับบน iPhone ทันที</span>
                  <ExternalLink className="h-3.5 w-3.5 ml-0.5 opacity-80" />
                </a>
                <p className="text-[11px] text-center text-slate-500 dark:text-zinc-400 mt-1.5">
                  (เปิดใน Safari บน iPhone จะเปิดหน้าต่างสมัครรับของ Apple Calendar ขึ้นมาทันที)
                </p>
              </div>

              {/* Feed Link Copy Section */}
              <div className="bg-slate-50 dark:bg-zinc-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-2">
                <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 block">
                  หรือคัดลอกลิงก์ฟีด (Subscription Link)
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={webcalUrl}
                    className="flex-1 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 rounded-xl px-3 py-2 text-xs font-mono select-all truncate"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopyLink(webcalUrl)}
                    className="flex shrink-0 items-center justify-center gap-1 px-3 py-2 rounded-xl bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-bold hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
                  >
                    {isCopied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400 dark:text-emerald-600" />
                        <span>คัดลอกแล้ว</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>คัดลอก</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Token Security Management */}
              <div className="bg-white dark:bg-zinc-800/40 rounded-2xl border border-slate-200 dark:border-zinc-800 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-zinc-200">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <span>ความปลอดภัยและรหัสโทเค็น (Feed Token)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowRegenConfirm(true)}
                    disabled={isRegenerating}
                    className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className={`h-3 w-3 ${isRegenerating ? "animate-spin" : ""}`} />
                    <span>สร้างโทเค็นใหม่</span>
                  </button>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-normal">
                  โทเค็นนี้ใช้สำหรับยืนยันตัวตนตารางเวรส่วนตัวของคุณ
                  หากต้องการยกเลิกลิงก์เดิมให้กดสร้างโทเค็นใหม่
                </p>

                {/* Regenerate Confirmation Box */}
                {showRegenConfirm && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl space-y-2">
                    <div className="flex items-start gap-2 text-rose-800 dark:text-rose-200 text-xs">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                      <span>
                        หากสร้างโทเค็นใหม่ ลิงก์เดิมบน iPhone หรืออุปกรณ์อื่นๆ จะใช้งานไม่ได้
                        คุณจะต้องนำลิงก์ใหม่ไปใส่ในเครื่องอีกครั้ง ยืนยันหรือไม่?
                      </span>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowRegenConfirm(false)}
                        className="px-2.5 py-1 text-xs rounded-lg text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-800"
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="button"
                        onClick={handleRegenerateToken}
                        disabled={isRegenerating}
                        className="px-3 py-1 text-xs font-bold rounded-lg bg-rose-600 text-white hover:bg-rose-700 active:scale-95"
                      >
                        ยืนยันสร้างใหม่
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: STEP-BY-STEP IPHONE GUIDANCE */}
          {activeTab === "guide" && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              <div className="bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/60 p-3 rounded-2xl flex items-center gap-2 text-sky-800 dark:text-sky-300 text-xs font-semibold">
                <Smartphone className="h-4 w-4 shrink-0" />
                <span>ขั้นตอนการเพิ่มปฏิทินที่สมัครรับ (Subscribed Calendar) บน iOS 16 - 18+</span>
              </div>

              <div className="space-y-2.5 text-xs">
                {/* Step 1 */}
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-800">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold text-xs">
                    1
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-zinc-200">
                      คัดลอกลิงก์ฟีด WebCal
                    </h4>
                    <p className="text-slate-500 dark:text-zinc-400 mt-0.5">
                      ไปที่แท็บ <strong>&quot;สมัครรับ (WebCal)&quot;</strong> แล้วกดปุ่ม{" "}
                      <strong>คัดลอก</strong> ลิงก์
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-800">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold text-xs">
                    2
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-zinc-200">
                      เปิดการตั้งค่าบน iPhone
                    </h4>
                    <p className="text-slate-500 dark:text-zinc-400 mt-0.5">
                      ไปที่ <strong>การตั้งค่า (Settings)</strong> &gt; เลื่อนลงมาเลือก{" "}
                      <strong>ปฏิทิน (Calendar)</strong>
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-800">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold text-xs">
                    3
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-zinc-200">
                      เพิ่มบัญชีปฏิทิน
                    </h4>
                    <p className="text-slate-500 dark:text-zinc-400 mt-0.5">
                      แตะ <strong>บัญชี (Accounts)</strong> &gt; แตะ{" "}
                      <strong>เพิ่มบัญชี (Add Account)</strong> &gt; เลือก{" "}
                      <strong>อื่นๆ (Other)</strong>
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-800">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold text-xs">
                    4
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-zinc-200">
                      วางลิงก์และกดสมัครรับ
                    </h4>
                    <p className="text-slate-500 dark:text-zinc-400 mt-0.5">
                      เลือก <strong>เพิ่มปฏิทินที่สมัครรับ (Add Subscribed Calendar)</strong>{" "}
                      &gt; วางลิงก์ที่คัดลอกลงในช่อง <strong>แม่ข่าย (Server)</strong> &gt; กด{" "}
                      <strong>ถัดไป (Next)</strong> และ <strong>บันทึก (Save)</strong>
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs">
                <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  เรียบร้อย! ปฏิทินและเวรจะแสดงบนแอปปฏิทินของ iPhone และ Apple Watch โดยอัตโนมัติ
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-zinc-800/50 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 text-xs font-bold hover:bg-slate-100 dark:hover:bg-zinc-800 active:scale-95 transition-all cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
}
