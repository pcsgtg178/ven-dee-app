"use client";

import React, { useState, useRef, useEffect } from "react";
import FullCalendar from "@fullcalendar/react";
import themePlugin from "@fullcalendar/react/themes/monarch";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import thLocale from "@fullcalendar/react/locales/th";
import { Maximize2, Minimize2 } from "lucide-react";
import { ActivityItem } from "../../types/vendee";

export interface ShiftDetail {
  code: string;
  isRed: boolean;
  isRefer: boolean;
  isSwapped: boolean;
  shiftType: string;
  category: string;
}

export interface CalendarEventItem {
  id: string;
  title: string;
  date: string;
  start?: string;
  allDay?: boolean;
  color: string;
  textColor: string;
  contrastColor?: string;
  order: number;
  extendedProps: {
    item?: ActivityItem;
    items?: ActivityItem[];
    order: number;
    shiftDetails?: ShiftDetail[];
    isService?: boolean;
  };
}

export interface ScheduleCalendarViewProps {
  /** รายการ Event ที่ผ่านการจัดรูปแบบพร้อมแสดงผลบน FullCalendar */
  events: CalendarEventItem[];
  /** Callback เมื่อผู้ใช้แตะที่ช่องวันที่บนปฏิทิน */
  onDateClick: (info: { dateStr: string }) => void;
  /** Callback เมื่อผู้ใช้แตะที่ Event Badge บนปฏิทิน */
  onEventClick: (info: any) => void;
}

export default function ScheduleCalendarView({
  events,
  onDateClick,
  onEventClick,
}: ScheduleCalendarViewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const calendarRef = useRef<any>(null);

  // Recalculate FullCalendar dimensions safely whenever fullscreen mode changes
  useEffect(() => {
    const triggerResize = () => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("resize"));
      }
      try {
        const api = calendarRef.current?.getApi?.();
        if (api && typeof api.updateSize === "function") {
          api.updateSize();
        }
      } catch (_) {}
    };

    triggerResize();
    const rafId = requestAnimationFrame(triggerResize);
    const timeoutId = setTimeout(triggerResize, 120);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
    };
  }, [isFullscreen]);

  // Lock body scroll and handle Escape key while in fullscreen overlay
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullscreen]);

  // Custom Event Renderer for FullCalendar (Grouped shifts displayed as 1 / 2 / 3 with large font)
  const renderEventContent = (eventInfo: any) => {
    const { title, extendedProps } = eventInfo.event;
    const shiftDetails = extendedProps?.shiftDetails as ShiftDetail[] | undefined;
    const isService = Boolean(
      extendedProps?.isService || extendedProps?.item?.type === "service",
    );

    if (shiftDetails && shiftDetails.length > 0) {
      return (
        <div className="flex items-center justify-center gap-0.5 sm:gap-1 w-full overflow-hidden text-center py-0.5 px-0.5 leading-none">
          {shiftDetails.map((detail, idx) => {
            let colorClass = "text-slate-900 dark:text-slate-100 font-extrabold";
            if (detail.isRefer) {
              colorClass = "text-emerald-600 dark:text-emerald-400 font-extrabold";
            } else if (detail.isRed) {
              colorClass = "text-rose-600 dark:text-rose-400 font-extrabold";
            }

            return (
              <React.Fragment key={idx}>
                {idx > 0 && (
                  <span className="text-slate-400 dark:text-slate-500 font-bold mx-0.5 text-sm sm:text-base select-none">
                    /
                  </span>
                )}
                <span className="inline-flex items-center gap-0.5">
                  {detail.isSwapped && <span className="text-[10px] sm:text-xs">🔄</span>}
                  <span className={`text-base sm:text-xl font-extrabold tracking-tight ${colorClass}`}>
                    {detail.code}
                  </span>
                </span>
              </React.Fragment>
            );
          })}
        </div>
      );
    }

    if (isService) {
      return (
        <div className="truncate text-[10px] sm:text-[11px] font-medium leading-tight px-0.5 py-0.5 text-white">
          {title}
        </div>
      );
    }

    return (
      <div className="truncate text-xs font-semibold px-1 py-0.5 text-slate-700 dark:text-slate-200">
        {title}
      </div>
    );
  };

  return (
    <div
      className={
        isFullscreen
          ? "fixed inset-0 z-50 flex flex-col bg-white text-slate-900 pt-safe pb-safe pl-safe pr-safe p-2 sm:p-4 overflow-hidden animate-in fade-in duration-200"
          : "flex-1 min-h-0 flex flex-col rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-1.5 sm:p-2.5 shadow-sm overflow-hidden text-slate-900"
      }
    >
      {/* Top Bar: Color Legend + Fullscreen Toggle Button */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-white pb-2 mb-1 px-1 text-[11px] text-slate-800 shrink-0">
        {/* Fullscreen Toggle Action Button */}
        <button
          type="button"
          onClick={() => setIsFullscreen((prev) => !prev)}
          className={`flex shrink-0 min-h-[38px] min-w-[38px] items-center justify-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-bold transition-all active:scale-95 touch-manipulation cursor-pointer ${
            isFullscreen
              ? "bg-rose-50 border-rose-200 text-shift-red hover:bg-rose-100 dark:bg-rose-950/40 dark:border-rose-800"
              : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-2xs"
          }`}
          aria-label={isFullscreen ? "ออกจากโหมดเต็มหน้าจอ" : "ขยายปฏิทินเต็มหน้าจอ"}
          title={isFullscreen ? "ย่อขนาดกลับ (Exit Fullscreen)" : "ขยายเต็มหน้าจอ (Fullscreen)"}
        >
          {isFullscreen ? (
            <>
              <Minimize2 className="h-4 w-4 text-shift-red" />
              <span className="text-[11px] font-semibold text-shift-red">ย่อขนาด</span>
            </>
          ) : (
            <>
              <Maximize2 className="h-4 w-4 text-slate-600" />
              <span className="text-[11px] font-semibold">เต็มจอ</span>
            </>
          )}
        </button>
      </div>

      {/* FullCalendar Component expanding full height on pure white canvas */}
      <div className="flex-1 min-h-0 w-full overflow-hidden bg-white">
        <FullCalendar
          ref={calendarRef}
          locales={[thLocale]}
          plugins={[themePlugin, interactionPlugin, dayGridPlugin]}
          initialView="dayGridMonth"
          firstDay={0}
          height="100%"
          expandRows={true}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "",
          }}
          eventOrder="order,start"
          events={events}
          eventContent={renderEventContent}
          dateClick={onDateClick}
          eventClick={onEventClick}
        />
      </div>
    </div>
  );
}
