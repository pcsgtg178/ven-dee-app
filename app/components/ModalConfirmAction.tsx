"use client";

import React, { useEffect } from "react";
import {
  AlertTriangle,
  AlertOctagon,
  RotateCcw,
  Trash2,
  ArrowLeftRight,
  ShieldAlert,
  X,
} from "lucide-react";

export type ConfirmVariant = "danger" | "warning" | "primary" | "info";

export interface ConfirmDetailItem {
  label: string;
  value: React.ReactNode;
}

export interface ModalConfirmActionProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  subtitle?: string;
  description?: React.ReactNode;
  warningNotice?: React.ReactNode;
  items?: ConfirmDetailItem[];
  variant?: ConfirmVariant;
  iconType?: "trash" | "swap" | "restore" | "undo" | "warning";
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
}

export default function ModalConfirmAction({
  isOpen,
  onClose,
  onConfirm,
  title,
  subtitle,
  description,
  warningNotice,
  items,
  variant = "danger",
  iconType = "warning",
  confirmText = "ยืนยัน",
  cancelText = "ยกเลิก",
  isLoading = false,
}: ModalConfirmActionProps) {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Variant styling
  const variantStyles = {
    danger: {
      iconBg: "bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50",
      buttonBg: "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20 active:bg-rose-800",
      accentBorder: "border-rose-500",
      badgeBg: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-900/50",
    },
    warning: {
      iconBg: "bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50",
      buttonBg: "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-500/20 active:bg-amber-800",
      accentBorder: "border-amber-500",
      badgeBg: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-900/50",
    },
    primary: {
      iconBg: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50",
      buttonBg: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20 active:bg-emerald-800",
      accentBorder: "border-emerald-500",
      badgeBg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50",
    },
    info: {
      iconBg: "bg-sky-100 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400 border border-sky-200 dark:border-sky-900/50",
      buttonBg: "bg-sky-600 hover:bg-sky-700 text-white shadow-sky-500/20 active:bg-sky-800",
      accentBorder: "border-sky-500",
      badgeBg: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border-sky-200 dark:border-sky-900/50",
    },
  }[variant];

  // Render proper icon
  const renderIcon = () => {
    switch (iconType) {
      case "trash":
        return <Trash2 className="h-6 w-6" />;
      case "swap":
        return <ArrowLeftRight className="h-6 w-6" />;
      case "restore":
        return <RotateCcw className="h-6 w-6" />;
      case "undo":
        return <AlertOctagon className="h-6 w-6" />;
      case "warning":
      default:
        return <AlertTriangle className="h-6 w-6" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Dialog Card */}
      <div className="relative z-50 w-full max-w-md overflow-hidden rounded-3xl bg-white p-6 shadow-2xl transition-all dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
          aria-label="ปิด"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center text-center">
          {/* Icon Header */}
          <div
            className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm ${variantStyles.iconBg}`}
          >
            {renderIcon()}
          </div>

          {/* Title & Subtitle */}
          <h3 className="text-lg font-bold text-text-main dark:text-white leading-tight">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-1 text-xs text-text-muted dark:text-zinc-400">
              {subtitle}
            </p>
          )}

          {/* Description */}
          {description && (
            <div className="mt-2 text-xs text-slate-600 dark:text-zinc-300">
              {description}
            </div>
          )}
        </div>

        {/* Item Details Box (if provided) */}
        {items && items.length > 0 && (
          <div className="mt-4 divide-y divide-slate-100 rounded-2xl bg-surface-subtle/80 p-3 text-xs dark:divide-zinc-800 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800">
            {items.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between py-1.5 first:pt-0 last:pb-0"
              >
                <span className="text-text-muted dark:text-zinc-400 font-medium">
                  {item.label}
                </span>
                <span className="font-semibold text-text-main dark:text-white text-right">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Warning Notice Box (Important for swapped shifts / undo / consequences) */}
        {warningNotice && (
          <div
            className={`mt-4 rounded-2xl p-3 text-xs border ${variantStyles.badgeBg}`}
          >
            <div className="flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="text-left font-medium leading-relaxed">
                {warningNotice}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 active:scale-95 transition-all dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-750"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 rounded-xl py-2.5 text-xs font-bold shadow-md active:scale-95 transition-all ${variantStyles.buttonBg}`}
          >
            {isLoading ? "กำลังดำเนินการ..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
