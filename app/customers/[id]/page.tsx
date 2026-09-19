"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import moment from "moment";
import "moment/locale/th";

import {
  Phone,
  Pencil,
  CalendarPlus,
  Clock,
  Syringe,
  Sparkles,
  Package,
  MoreHorizontal,
  CheckCircle2,
  Calendar,
  Tag,
  MapPin,
  Trash2,
  AlertCircle,
  FileText,
  History,
  CalendarDays,
} from "lucide-react";

import AppBar from "../../components/AppBar";
import BottomNav from "../../components/BottomNav";
import ModalAddTodo from "../../components/ModalAddTodo";
import ModalEditCustomer from "../../components/ModalEditCustomer";
import ModalEditService from "../../components/ModalEditService";
import { Customer, CustomerServiceRecord, SERVICE_CONFIG } from "../../../types/vendee";
import { customersApi, servicesApi } from "../../../lib/api";
import { RefreshCw } from "lucide-react";
import {
  getCustomerById,
  canEditService,
  getServices,
  saveService,
  deleteService,
  subscribeToStorage,
} from "../../../lib/storage";

export default function CustomerDetailPage() {
  const params = useParams();
  const customerId = params?.id as string;

  const [customer, setCustomer] = useState<Customer | undefined>(undefined);
  const [services, setServices] = useState<CustomerServiceRecord[]>([]);
  const [activeTab, setActiveTab] = useState<"upcoming" | "history">("upcoming");
  const [isSyncing, setIsSyncing] = useState(false);

  // Modals
  const [openAddModal, setOpenAddModal] = useState(false);
  const [openEditCustomerModal, setOpenEditCustomerModal] = useState(false);
  const [editingService, setEditingService] = useState<CustomerServiceRecord | null>(null);
  const [openEditServiceModal, setOpenEditServiceModal] = useState(false);

  const handleEditService = (srv: CustomerServiceRecord) => {
    setEditingService(srv);
    setOpenEditServiceModal(true);
  };

  // Live API load for customer detail
  const loadData = useCallback(async () => {
    if (!customerId) return;

    // 1. Initial fast local read
    const localCust = getCustomerById(customerId);
    if (localCust) {
      setCustomer(localCust);
      const allServices = getServices();
      const customerServices = allServices.filter((s) => s.customerId === customerId);
      setServices(customerServices);
    }

    // 2. Fetch live data from backend API (http://localhost:8080/api/v1/customers/:id)
    try {
      setIsSyncing(true);
      const apiCust = await customersApi.getById(customerId);
      if (apiCust) {
        setCustomer(apiCust);
        const combined = [
          ...(apiCust.upcomingServices || []),
          ...(apiCust.historyServices || []),
        ];
        if (combined.length > 0) {
          setServices(combined);
        }
      }
    } catch (err) {
      console.warn("API customer detail fetch warning:", err);
    } finally {
      setIsSyncing(false);
    }
  }, [customerId]);

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToStorage(loadData);
    return () => unsubscribe();
  }, [loadData]);

  // Upcoming appointments (status === 'upcoming' or future date)
  const upcomingServices = useMemo(() => {
    return services
      .filter((s) => s.status === "upcoming")
      .sort((a, b) => {
        const dateComp = a.date.localeCompare(b.date);
        if (dateComp !== 0) return dateComp;
        return a.time.localeCompare(b.time);
      });
  }, [services]);

  // History services (status === 'completed' or sorted latest first)
  const historyServices = useMemo(() => {
    return services
      .filter((s) => s.status === "completed")
      .sort((a, b) => {
        const dateComp = b.date.localeCompare(a.date);
        if (dateComp !== 0) return dateComp;
        return b.time.localeCompare(a.time);
      });
  }, [services]);

  const handleDeleteService = async (serviceId: string) => {
    try {
      await servicesApi.delete(serviceId);
    } catch (err) {
      console.warn("API delete service error, deleting locally:", err);
    }
    deleteService(serviceId);
    loadData();
  };

  // Toggle status between upcoming and completed with API sync
  const handleToggleStatus = async (srv: CustomerServiceRecord) => {
    const nextStatus = srv.status === "completed" ? "upcoming" : "completed";
    try {
      await servicesApi.updateStatus(srv.id, nextStatus);
    } catch (err) {
      console.warn("API status update error, saving locally:", err);
    }
    saveService({
      ...srv,
      status: nextStatus,
    });
    loadData();
  };

  if (!customer) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-zinc-950 dark:text-zinc-100">
        <AppBar title="ข้อมูลลูกค้า" showBack backHref="/customers" />
        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center p-6 text-center">
          <AlertCircle className="h-12 w-12 text-slate-400 mb-3" />
          <h2 className="text-base font-bold">ไม่พบข้อมูลลูกค้า</h2>
          <p className="text-xs text-slate-500 mt-1">
            ข้อมูลลูกค้าอาจถูกลบหรือไม่มีอยู่ในระบบ
          </p>
          <Link
            href="/customers"
            className="mt-4 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-700"
          >
            กลับสู่หน้ารายชื่อลูกค้า
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-app-bg text-text-main dark:bg-zinc-950 dark:text-zinc-100 pb-32">
      {/* Header with back button */}
      <AppBar
        title={customer.name}
        showBack
        backHref="/customers"
        rightAction={
          <button
            type="button"
            onClick={() => setOpenAddModal(true)}
            className="flex items-center gap-1 rounded-full bg-gradient-to-r from-sky-500 to-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:brightness-105 active:scale-95 transition-all"
          >
            <CalendarPlus className="h-3.5 w-3.5" />
            <span>+ นัดหมาย</span>
          </button>
        }
      />

      {/* Main Container */}
      <main className="mx-auto w-full max-w-lg flex-1 p-4 space-y-4">
        {/* Customer Profile Banner */}
        <div className="rounded-3xl border border-surface-subtle bg-card-bg p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start gap-3.5">
            {/* Avatar */}
            <div
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white shadow-xs ${
                customer.avatarColor || "bg-primary"
              }`}
            >
              {customer.name.substring(0, 2)}
            </div>

            <div className="flex-1 space-y-1.5 min-w-0">
              <h2 className="text-base font-bold text-text-main dark:text-white truncate">
                {customer.name}
              </h2>

              {/* Note จำแนกป้องกันความสับสน */}
              {customer.note && (
                <div className="flex items-center gap-1 text-xs text-primary dark:text-emerald-300">
                  <Tag className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="rounded-md bg-primary-light px-2 py-0.5 font-medium border border-primary/20 dark:bg-primary-dark/40 dark:border-primary/40">
                    {customer.note}
                  </span>
                </div>
              )}

              {/* Address */}
              {customer.address && (
                <div className="flex items-center gap-1.5 text-xs text-text-muted dark:text-zinc-400">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                  <span className="truncate">{customer.address}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions Row: Call button + Add Appointment */}
          <div className="mt-4 flex items-center gap-2 border-t border-surface-subtle pt-3 dark:border-zinc-800">
            {customer.phone && customer.phone !== "-" ? (
              <a
                href={`tel:${customer.phone}`}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-surface-subtle py-2.5 text-xs font-bold text-text-main hover:bg-primary-light hover:text-primary-dark active:scale-95 dark:bg-zinc-800 dark:text-zinc-200 transition-all"
              >
                <Phone className="h-3.5 w-3.5 text-primary" />
                <span>โทรออก ({customer.phone})</span>
              </a>
            ) : null}

            <button
              type="button"
              onClick={() => setOpenAddModal(true)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-600 py-2.5 text-xs font-bold text-white shadow-xs hover:brightness-105 active:scale-95 transition-all"
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              <span>+ นัดหมายบริการ</span>
            </button>
          </div>
        </div>

        {/* Tab Switcher: [ นัดหมายล่วงหน้า (Upcoming) ] | [ ประวัติบริการ (History) ] */}
        <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-surface-subtle p-1 dark:bg-zinc-800">
          <button
            type="button"
            onClick={() => setActiveTab("upcoming")}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all ${
              activeTab === "upcoming"
                ? "bg-card-bg text-primary shadow-xs dark:bg-zinc-700 dark:text-primary-light"
                : "text-text-muted hover:text-text-main dark:text-zinc-400 dark:hover:text-white"
            }`}
          >
            <CalendarDays className="h-4 w-4" />
            <span>นัดหมายล่วงหน้า ({upcomingServices.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all ${
              activeTab === "history"
                ? "bg-card-bg text-primary shadow-xs dark:bg-zinc-700 dark:text-primary-light"
                : "text-text-muted hover:text-text-main dark:text-zinc-400 dark:hover:text-white"
            }`}
          >
            <History className="h-4 w-4" />
            <span>ประวัติบริการ ({historyServices.length})</span>
          </button>
        </div>

        {/* Tab 1: นัดหมายล่วงหน้า (Upcoming) */}
        {activeTab === "upcoming" && (
          <div className="space-y-3">
            {upcomingServices.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/60 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
                <Calendar className="h-10 w-10 text-slate-300 dark:text-zinc-600 mb-2" />
                <h3 className="font-semibold text-slate-700 dark:text-zinc-300 text-sm">
                  ไม่มีนัดหมายล่วงหน้า
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                  แตะปุ่มด้านล่างเพื่อเพิ่มนัดหมายบริการใหม่ให้กับลูกค้ารายนี้
                </p>
                <button
                  type="button"
                  onClick={() => setOpenAddModal(true)}
                  className="mt-4 flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-teal-700"
                >
                  <CalendarPlus className="h-3.5 w-3.5" />
                  <span>+ เพิ่มนัดหมายใหม่</span>
                </button>
              </div>
            ) : (
              upcomingServices.map((srv) => (
                <ServiceDetailCard
                  key={srv.id}
                  service={srv}
                  onToggleStatus={() => handleToggleStatus(srv)}
                  onDelete={() => handleDeleteService(srv.id)}
                  onEdit={() => handleEditService(srv)}
                />
              ))
            )}
          </div>
        )}

        {/* Tab 2: ประวัติบริการ (History) - เรียงล่าสุดก่อน ระบุบริการและตัวยาที่เคยทำ */}
        {activeTab === "history" && (
          <div className="space-y-3">
            {historyServices.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/60 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
                <FileText className="h-10 w-10 text-slate-300 dark:text-zinc-600 mb-2" />
                <h3 className="font-semibold text-slate-700 dark:text-zinc-300 text-sm">
                  ยังไม่มีประวัติการรับบริการที่เสร็จสิ้น
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                  เมื่อให้บริการตามนัดหมายเสร็จสิ้น สามารถแตะเครื่องหมายถูกเพื่อบันทึกเป็นประวัติ
                </p>
              </div>
            ) : (
              historyServices.map((srv) => (
                <ServiceDetailCard
                  key={srv.id}
                  service={srv}
                  onToggleStatus={() => handleToggleStatus(srv)}
                  onDelete={() => handleDeleteService(srv.id)}
                  onEdit={() => handleEditService(srv)}
                />
              ))
            )}
          </div>
        )}
        {/* Bottom Navigation Spacer */}
        <div className="h-20 sm:h-24 pb-safe pointer-events-none" aria-hidden="true" />
      </main>

      {/* Modal Edit Customer */}
      <ModalEditCustomer
        customer={customer}
        isOpen={openEditCustomerModal}
        onClose={() => setOpenEditCustomerModal(false)}
        onSuccess={() => {
          loadData();
        }}
      />

      {/* Modal Edit Service */}
      <ModalEditService
        service={editingService}
        isOpen={openEditServiceModal}
        onClose={() => {
          setOpenEditServiceModal(false);
          setEditingService(null);
        }}
        onSuccess={() => {
          loadData();
        }}
      />

      {/* Modal Add Todo (Customer Service with this customer preselected) */}
      <ModalAddTodo
        openModal={openAddModal}
        toggleModal={() => setOpenAddModal(false)}
        initialTab="service"
        initialCustomerId={customer.id}
        onSuccess={() => {
          loadData();
        }}
      />

      {/* Bottom Navigation */}
      <BottomNav
        onOpenAdd={() => {
          setOpenAddModal(true);
        }}
      />
    </div>
  );
}

/* ==========================================================================
   ServiceDetailCard Component
   ========================================================================== */
interface ServiceDetailCardProps {
  service: CustomerServiceRecord;
  onToggleStatus: () => void;
  onDelete: () => void;
  onEdit?: () => void;
}

function ServiceDetailCard({
  service,
  onToggleStatus,
  onDelete,
  onEdit,
}: ServiceDetailCardProps) {
  const isCompleted = service.status === "completed";
  const canEdit = canEditService(service);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-4 shadow-xs transition-all ${
        isCompleted
          ? "border-primary/40 bg-primary-light/15 dark:border-emerald-900/50 dark:bg-emerald-950/20"
          : "border-surface-subtle bg-card-bg dark:border-zinc-800 dark:bg-zinc-900"
      }`}
    >
      {/* Color stripe left: Primary health green */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary" />

      <div className="flex items-start justify-between gap-2 pl-2">
        <div className="space-y-2 flex-1">
          {/* Date & Time Header */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-text-main dark:text-white">
              {moment(service.date).locale("th").format("ddd D MMMM YYYY")}
            </span>
            <span className="flex items-center gap-1 rounded-md bg-surface-subtle px-2 py-0.5 text-xs font-semibold text-text-main dark:bg-zinc-800 dark:text-zinc-200">
              <Clock className="h-3 w-3 text-primary" />
              {service.time} น.
            </span>
            <button
              type="button"
              onClick={onToggleStatus}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold cursor-pointer transition-colors ${
                isCompleted
                  ? "bg-primary-light text-primary-dark dark:bg-emerald-950/80 dark:text-emerald-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200"
              }`}
            >
              <CheckCircle2 className="h-3 w-3" />
              {isCompleted ? "บริการเสร็จสิ้น" : "รอดำเนินการ"}
            </button>
          </div>

          {/* Service Tags */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {service.services.map((srv) => {
              const conf = SERVICE_CONFIG[srv];
              return (
                <span
                  key={srv}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold ${conf.bg}`}
                >
                  {srv === "injection" && <Syringe className="h-3.5 w-3.5" />}
                  {srv === "drip" && <Sparkles className="h-3.5 w-3.5" />}
                  {srv === "delivery" && <Package className="h-3.5 w-3.5" />}
                  {srv === "other" && <MoreHorizontal className="h-3.5 w-3.5" />}
                  {conf.label}
                </span>
              );
            })}
            {service.otherServiceText && (
              <span className="text-xs text-text-muted">
                ({service.otherServiceText})
              </span>
            )}
          </div>

          {/* ตัวยาที่เคยทำ / ที่ต้องฉีด (Highlight for History & Injection) */}
          {service.medications && service.medications.length > 0 && (
            <div className="rounded-xl bg-primary-light/40 p-2.5 text-xs text-primary-dark dark:bg-emerald-950/40 dark:text-emerald-200 border border-primary/20 dark:border-emerald-800">
              <div className="font-bold flex items-center gap-1 text-primary-dark dark:text-emerald-300 mb-1">
                <Syringe className="h-3.5 w-3.5 text-primary" />
                <span>ตัวยาที่ใช้ ({service.medications.length} ตัวยา):</span>
              </div>
              <ul className="list-inside list-disc space-y-0.5 text-xs pl-1">
                {service.medications.map((med, idx) => (
                  <li key={idx} className="font-semibold">
                    {med}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Note & Price */}
          <div className="flex flex-wrap items-center justify-between text-xs text-text-muted dark:text-zinc-400 pt-0.5">
            {service.note && <span>📝 {service.note}</span>}
            {service.price ? (
              <span className="font-bold text-primary dark:text-emerald-400">
                ค่าบริการ: ฿{service.price.toLocaleString()}
              </span>
            ) : null}
          </div>
        </div>

        {/* Action Buttons: Edit + Delete */}
        <div className="flex items-center gap-1 shrink-0">
          {canEdit && onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-teal-600 active:scale-95 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300 transition-all"
              title="แก้ไขนัดหมายนี้"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 active:scale-95 dark:hover:bg-rose-950/40 transition-colors"
            title="ลบรายการนี้"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
