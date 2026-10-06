"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Calendar,
  Clock,
  Sparkles,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  FileText,
  CalendarHeart,
} from "lucide-react";
import { PersonalEventRecord } from "../../types/vendee";
import { createPersonalEventAction } from "../actions/personalEventActions";
import { savePersonalEvent } from "../../lib/storage";

interface ModalAddPersonalEventProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (event: PersonalEventRecord, warning?: string) => void;
  defaultDate?: string;
  onSwitchToOtherWork?: () => void;
}

export default function ModalAddPersonalEvent({
  isOpen,
  onClose,
  onSuccess,
  defaultDate,
  onSwitchToOtherWork,
}: ModalAddPersonalEventProps) {
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("21:00");
  const [isAllDay, setIsAllDay] = useState(false);
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [warningMsg, setWarningMsg] = useState("");

  // Form State Reset Policy: Reset all inputs whenever modal opens
  useEffect(() => {
    if (isOpen) {
      const today = defaultDate || new Date().toISOString().split("T")[0];
      setTitle("");
      setEventDate(today);
      setStartTime("18:00");
      setEndTime("21:00");
      setIsAllDay(false);
      setNotes("");
      setErrorMsg("");
      setWarningMsg("");
    }
  }, [isOpen, defaultDate]);

  if (!isOpen) return null;

  const handleSwitchToOther = () => {
    onClose();
    if (onSwitchToOtherWork) {
      onSwitchToOtherWork();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg("กรุณาระบุกิจกรรมที่ไปทำ (เช่น งานแต่งงาน, งานวันเกิด)");
      return;
    }
    if (!eventDate) {
      setErrorMsg("กรุณาเลือกว่าเป็นวันที่เท่าไร");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setWarningMsg("");

    try {
      const res = await createPersonalEventAction({
        title: title.trim(),
        eventDate,
        startTime: isAllDay ? "00:00" : startTime,
        endTime: isAllDay ? "23:59" : endTime,
        isAllDay,
        notes: notes.trim() || undefined,
      });

      let createdEvent: PersonalEventRecord;
      let returnedWarning: string | undefined;

      if (res.success && res.data) {
        createdEvent = res.data.event;
        returnedWarning = res.data.warning;
      } else {
        // Fallback to local storage persistence
        createdEvent = savePersonalEvent({
          title: title.trim(),
          eventDate,
          startTime: isAllDay ? "00:00" : startTime,
          endTime: isAllDay ? "23:59" : endTime,
          isAllDay,
          relationshipTag: "other",
          notes: notes.trim() || undefined,
        });
      }

      if (returnedWarning) {
        setWarningMsg(returnedWarning);
      }

      if (onSuccess) {
        onSuccess(createdEvent, returnedWarning);
      }

      // Reset form fields post-submission
      setTitle("");
      setNotes("");
      onClose();
    } catch (err: any) {
      // Local storage fallback on error
      const createdEvent = savePersonalEvent({
        title: title.trim(),
        eventDate,
        startTime: isAllDay ? "00:00" : startTime,
        endTime: isAllDay ? "23:59" : endTime,
        isAllDay,
        relationshipTag: "other",
        notes: notes.trim() || undefined,
      });
      if (onSuccess) onSuccess(createdEvent);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white dark:bg-zinc-900 border border-rose-100 dark:border-rose-950 shadow-2xl">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-rose-500 to-pink-600 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md">
                <CalendarHeart className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold">บันทึกธุระส่วนตัว</h2>
                <p className="text-xs text-rose-100">บันทึกกิจกรรมส่วนตัวลงตาราง</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* ปุ่มสลับกลับไปบันทึกงานอื่นๆ */}
              <button
                type="button"
                onClick={handleSwitchToOther}
                className="flex items-center gap-1.5 rounded-xl bg-white/20 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-xs hover:bg-white/30 transition active:scale-95 cursor-pointer"
                title="กลับไปบันทึกเวร / บริการลูกค้า / คลินิก"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>บันทึกงานอื่นๆ</span>
              </button>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/30 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Quick link banner to switch back to other work */}
          <div className="flex items-center justify-between rounded-2xl bg-slate-50 dark:bg-zinc-800/80 p-3 text-xs text-slate-600 dark:text-zinc-300 border border-slate-200/60 dark:border-zinc-700/60">
            <span>ต้องการบันทึกเวรโรงพยาบาล หรือบริการลูกค้า?</span>
            <button
              type="button"
              onClick={handleSwitchToOther}
              className="flex items-center gap-1 font-bold text-secondary dark:text-secondary-light hover:underline cursor-pointer"
            >
              <span>บันทึกงานอื่นๆ</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 rounded-2xl bg-rose-50 dark:bg-rose-950/60 p-3 text-xs text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {warningMsg && (
            <div className="flex items-center gap-2 rounded-2xl bg-amber-50 dark:bg-amber-950/60 p-3 text-xs text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{warningMsg}</span>
            </div>
          )}

          {/* 1. ไปทำอะไร / กิจกรรมส่วนตัว */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
              ไปทำอะไร / กิจกรรมส่วนตัว <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="เช่น ไปงานแต่งงานพี่บอย, งานวันเกิดเพื่อน, ธุระครอบครัว"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/80 px-4 py-3 text-sm text-slate-900 dark:text-zinc-100 focus:border-rose-500 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20"
              required
            />
          </div>

          {/* 2. วันที่ & รูปแบบเวลา (เวลา / ทั้งวัน) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                วันที่ <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/80 pl-10 pr-3 py-2.5 text-sm text-slate-900 dark:text-zinc-100 focus:border-rose-500 focus:outline-hidden"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                เวลา / ทั้งวัน
              </label>
              <button
                type="button"
                onClick={() => setIsAllDay(!isAllDay)}
                className={`w-full flex items-center justify-between rounded-2xl border px-4 py-2.5 text-sm font-medium transition cursor-pointer ${
                  isAllDay
                    ? "border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-semibold"
                    : "border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300"
                }`}
              >
                <span>{isAllDay ? "ไปทั้งวัน (All Day)" : "กำหนดช่วงเวลา"}</span>
                <Clock className="h-4 w-4 text-rose-500" />
              </button>
            </div>
          </div>

          {/* Time Picker (กรณีไม่ได้เลือกไปทั้งวัน) */}
          {!isAllDay && (
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40">
              <div>
                <label className="block text-xs font-semibold text-rose-900 dark:text-rose-200 mb-1">
                  เวลาเริ่ม (กี่โมง)
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-slate-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-rose-900 dark:text-rose-200 mb-1">
                  เวลาสิ้นสุด (ถึงกี่โมง)
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-slate-900 dark:text-zinc-100"
                />
              </div>
            </div>
          )}

          {/* 3. เพิ่มเติม (Notes) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
              เพิ่มเติม (Optional)
            </label>
            <textarea
              rows={3}
              placeholder="บันทึกรายละเอียดเพิ่มเติม เช่น นัดเจอที่ไหน, การเดินทาง, ของที่ต้องเตรียม"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/80 px-4 py-2.5 text-sm text-slate-900 dark:text-zinc-100 focus:border-rose-500 focus:outline-hidden"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={handleSwitchToOther}
              className="flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 dark:border-zinc-700 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>บันทึกงานอื่นๆ</span>
            </button>

            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-slate-200 dark:border-zinc-700 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-500/25 hover:from-rose-600 hover:to-pink-700 transition disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className="h-4 w-4" />
                <span>{loading ? "กำลังบันทึก..." : "บันทึกธุระส่วนตัว"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
