"use client";

import React, { Suspense, useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import moment from "moment";
import "moment/locale/th";

import {
  Pencil,
  CalendarPlus,
  Clock,
  Syringe,
  MoreHorizontal,
  CheckCircle2,
  Calendar,
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
import ModalDeleteCustomer from "../../components/ModalDeleteCustomer";
import { Customer, CustomerServiceRecord, SERVICE_CONFIG } from "../../../types/vendee";
import { getServicePricingBreakdown } from "../../../lib/conflictEngine";
import {
  getCustomerById,
  canEditService,
  canDeleteService,
  getServices,
  saveService,
  deleteService,
  subscribeToStorage,
  syncCustomersFromApi,
  syncAllDataFromApi,
  isDbSyncDisabled,
} from "../../../lib/storage";

export default function CustomerDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col bg-app-bg text-text-main dark:bg-zinc-950 dark:text-zinc-100">
          <AppBar title="ข้อมูลลูกค้า" />
          <main className="mx-auto flex w-full max-w-lg flex-1 items-center justify-center p-6 text-xs text-text-muted">
            กำลังโหลดข้อมูลลูกค้า...
          </main>
        </div>
      }
    >
      <CustomerDetailContent />
    </Suspense>
  );
}

function CustomerDetailContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerId = params?.id as string;
  const tabParam = searchParams.get("tab");
  const targetServiceId = searchParams.get("serviceId");

  const [customer, setCustomer] = useState<Customer | undefined>(undefined);
  const [services, setServices] = useState<CustomerServiceRecord[]>([]);
  const [tabOverride, setTabOverride] = useState<{
    key: string;
    tab: "upcoming" | "history";
  } | null>(null);
  const [isLoadingSync, setIsLoadingSync] = useState(() => !isDbSyncDisabled());
  const scrolledServiceRef = useRef<string | null>(null);

  const navKey = `${customerId}:${targetServiceId || ""}:${tabParam || ""}`;
  const targetService = useMemo(
    () => (targetServiceId ? services.find((s) => s.id === targetServiceId) : undefined),
    [services, targetServiceId]
  );
  const autoTab: "upcoming" | "history" = targetService
    ? targetService.status === "upcoming"
      ? "upcoming"
      : "history"
    : tabParam === "history"
      ? "history"
      : "upcoming";
  const activeTab = tabOverride?.key === navKey ? tabOverride.tab : autoTab;

  // Modals
  const [openAddModal, setOpenAddModal] = useState(false);
  const [openEditCustomerModal, setOpenEditCustomerModal] = useState(false);
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [editingService, setEditingService] = useState<CustomerServiceRecord | null>(null);
  const [openEditServiceModal, setOpenEditServiceModal] = useState(false);

  const handleEditService = (srv: CustomerServiceRecord) => {
    setEditingService(srv);
    setOpenEditServiceModal(true);
  };

  // Load customer detail from local storage immediately
  const loadLocalData = useCallback(() => {
    if (!customerId) return;
    const localCust = getCustomerById(customerId);
    if (localCust) {
      setCustomer(localCust);
    }
    const allServices = getServices();
    const customerServices = allServices.filter((s) => s.customerId === customerId);
    setServices(customerServices);
  }, [customerId]);

  const loadData = useCallback(() => {
    loadLocalData();
  }, [loadLocalData]);

  useEffect(() => {
    const unsubscribe = subscribeToStorage(loadLocalData);
    let cancelled = false;

    void Promise.resolve().then(() => {
      if (!cancelled) loadLocalData();
    });

    if (!isDbSyncDisabled() && customerId) {
      syncAllDataFromApi()
        .catch(() => syncCustomersFromApi().catch(() => {}))
        .finally(() => {
          if (!cancelled) {
            loadLocalData();
            setIsLoadingSync(false);
          }
        });
    }

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [customerId, loadLocalData]);

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

  // History services (status === 'completed' or targeted cancelled service from deep link)
  const historyServices = useMemo(() => {
    return services
      .filter(
        (s) =>
          s.status === "completed" ||
          (s.status === "cancelled" && Boolean(targetServiceId) && s.id === targetServiceId)
      )
      .sort((a, b) => {
        const dateComp = b.date.localeCompare(a.date);
        if (dateComp !== 0) return dateComp;
        return b.time.localeCompare(a.time);
      });
  }, [services, targetServiceId]);

  // Smooth scroll to the highlighted service card once visible in active tab
  useEffect(() => {
    if (!targetServiceId || scrolledServiceRef.current === targetServiceId) return;
    const visibleList = activeTab === "upcoming" ? upcomingServices : historyServices;
    if (!visibleList.some((s) => s.id === targetServiceId)) return;

    const raf = window.requestAnimationFrame(() => {
      const el = document.getElementById(`service-${targetServiceId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        scrolledServiceRef.current = targetServiceId;
      }
    });
    return () => window.cancelAnimationFrame(raf);
  }, [targetServiceId, activeTab, upcomingServices, historyServices]);

  const handleDeleteService = async (serviceId: string) => {
    try {
      await deleteService(serviceId);
      loadLocalData();
    } catch (err: any) {
      alert(err.message || "เกิดข้อผิดพลาดในการลบบริการ");
    }
  };

  // Toggle status between upcoming and completed
  const handleToggleStatus = async (srv: CustomerServiceRecord) => {
    try {
      const nextStatus = srv.status === "completed" ? "upcoming" : "completed";
      await saveService({
        ...srv,
        status: nextStatus,
      });
      loadLocalData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการเปลี่ยนสถานะบริการ";
      alert(msg);
    }
  };

  if (!customer) {
    if (isLoadingSync) {
      return (
        <div className="flex min-h-screen flex-col bg-app-bg text-text-main dark:bg-zinc-950 dark:text-zinc-100">
          <AppBar title="ข้อมูลลูกค้า" />
          <main className="mx-auto flex w-full max-w-lg flex-1 items-center justify-center p-6 text-xs text-text-muted">
            กำลังโหลดข้อมูลลูกค้า...
          </main>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen flex-col bg-ds-bg text-ds-text">
        <AppBar title="ข้อมูลลูกค้า" />
        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center p-6 text-center">
          <AlertCircle className="h-12 w-12 text-ds-icon-disabled mb-3" />
          <h2 className="text-base font-bold">ไม่พบข้อมูลลูกค้า</h2>
          <p className="text-xs text-ds-text-secondary mt-1">
            ข้อมูลลูกค้าอาจถูกลบหรือไม่มีอยู่ในระบบ
          </p>
          <Link
            href="/customers"
            className="mt-4 rounded-xl bg-ds-primary px-4 py-2 text-xs font-bold text-ds-on-primary hover:bg-ds-primary-hover"
          >
            กลับสู่หน้ารายชื่อลูกค้า
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-ds-bg text-ds-text">
      <AppBar
        title={customer.name}
        rightAction={
          <button
            type="button"
            onClick={() => setOpenAddModal(true)}
            className="flex items-center gap-1 rounded-full bg-ds-primary px-3 py-1.5 text-xs font-bold text-ds-on-primary shadow-xs hover:bg-ds-primary-hover active:scale-95 transition-all cursor-pointer"
          >
            <CalendarPlus className="h-3.5 w-3.5" />
            <span>+ นัดหมาย</span>
          </button>
        }
      />

      {/* Main Container */}
      <main className="mx-auto w-full max-w-lg flex-1 p-4 space-y-4">
        {/* Customer Profile Banner */}
        <div className="rounded-3xl border border-ds-border bg-ds-surface p-4 shadow-ds-card">
          <div className="flex items-center gap-3.5">
            {/* Avatar */}
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-ds-border bg-ds-surface-elevated text-base font-bold text-ds-text">
              {customer.name.substring(0, 2)}
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-ds-text truncate">
                {customer.name}
              </h2>
            </div>
          </div>

          {/* Quick Actions Row: Edit + Delete + Add Appointment */}
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ds-divider pt-3">
            <button
              type="button"
              onClick={() => setOpenEditCustomerModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-ds-border bg-ds-surface-elevated px-3 py-2 text-xs font-bold text-ds-text hover:bg-ds-surface-variant active:scale-95 transition-all cursor-pointer"
              title="แก้ไขข้อมูลลูกค้า"
            >
              <Pencil className="h-3.5 w-3.5 text-ds-icon-secondary" />
              <span>แก้ไข</span>
            </button>

            <button
              type="button"
              onClick={() => setOpenDeleteModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-ds-error/30 bg-ds-error-container/70 px-3 py-2 text-xs font-bold text-ds-error hover:bg-ds-error-container active:scale-95 transition-all cursor-pointer"
              title="ลบข้อมูลลูกค้าและประวัติทั้งหมด"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>ลบลูกค้า</span>
            </button>

            <button
              type="button"
              onClick={() => setOpenAddModal(true)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-ds-primary px-3.5 py-2 text-xs font-bold text-ds-on-primary shadow-xs hover:bg-ds-primary-hover active:scale-95 transition-all min-w-[130px] cursor-pointer"
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              <span>+ นัดหมายบริการ</span>
            </button>
          </div>
        </div>

        {/* Tab Switcher: [ นัดหมายล่วงหน้า (Upcoming) ] | [ ประวัติบริการ (History) ] */}
        <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-ds-surface-variant p-1 border border-ds-border/60">
          <button
            type="button"
            onClick={() => setTabOverride({ key: navKey, tab: "upcoming" })}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all cursor-pointer ${
              activeTab === "upcoming"
                ? "bg-ds-surface text-ds-primary shadow-ds-card"
                : "text-ds-text-secondary hover:text-ds-text"
            }`}
          >
            <CalendarDays className="h-4 w-4" />
            <span>นัดหมายล่วงหน้า ({upcomingServices.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTabOverride({ key: navKey, tab: "history" })}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all cursor-pointer ${
              activeTab === "history"
                ? "bg-ds-surface text-ds-primary shadow-ds-card"
                : "text-ds-text-secondary hover:text-ds-text"
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
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-ds-border bg-ds-surface p-8 text-center">
                <Calendar className="h-10 w-10 text-ds-icon-disabled mb-2" />
                <h3 className="font-semibold text-ds-text text-sm">
                  ไม่มีนัดหมายล่วงหน้า
                </h3>
                <p className="text-xs text-ds-text-secondary mt-1 max-w-xs">
                  แตะปุ่มด้านล่างเพื่อเพิ่มนัดหมายบริการใหม่ให้กับลูกค้ารายนี้
                </p>
                <button
                  type="button"
                  onClick={() => setOpenAddModal(true)}
                  className="mt-4 flex items-center gap-1.5 rounded-xl bg-ds-primary px-4 py-2 text-xs font-bold text-ds-on-primary shadow-xs hover:bg-ds-primary-hover cursor-pointer"
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
                  isHighlighted={srv.id === targetServiceId}
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
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-ds-border bg-ds-surface p-8 text-center">
                <FileText className="h-10 w-10 text-ds-icon-disabled mb-2" />
                <h3 className="font-semibold text-ds-text text-sm">
                  ยังไม่มีประวัติการรับบริการที่เสร็จสิ้น
                </h3>
                <p className="text-xs text-ds-text-secondary mt-1 max-w-xs">
                  เมื่อให้บริการตามนัดหมายเสร็จสิ้น สามารถแตะเครื่องหมายถูกเพื่อบันทึกเป็นประวัติ
                </p>
              </div>
            ) : (
              historyServices.map((srv) => (
                <ServiceDetailCard
                  key={srv.id}
                  service={srv}
                  isHighlighted={srv.id === targetServiceId}
                  onToggleStatus={() => handleToggleStatus(srv)}
                  onDelete={() => handleDeleteService(srv.id)}
                  onEdit={() => handleEditService(srv)}
                />
              ))
            )}
          </div>
        )}
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

      {/* Modal Delete Customer */}
      <ModalDeleteCustomer
        customer={customer || null}
        isOpen={openDeleteModal}
        onClose={() => setOpenDeleteModal(false)}
        onSuccess={() => {
          router.push("/customers");
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
  isHighlighted?: boolean;
  onToggleStatus: () => void;
  onDelete: () => void;
  onEdit?: () => void;
}

function ServiceDetailCard({
  service,
  isHighlighted = false,
  onToggleStatus,
  onDelete,
  onEdit,
}: ServiceDetailCardProps) {
  const isCompleted = service.status === "completed";
  const isCancelled = service.status === "cancelled";
  const canEdit = canEditService(service);
  const canDelete = canDeleteService(service);

  return (
    <div
      id={`service-${service.id}`}
      data-highlighted={isHighlighted ? "true" : undefined}
      className={`relative overflow-hidden rounded-2xl border p-4 shadow-ds-card transition-all ${
        isHighlighted
          ? "border-ds-info bg-ds-surface ring-2 ring-ds-info/30"
          : "border-ds-border bg-ds-surface"
      }`}
    >
      {/* Subtle left indicator */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 ${
          isHighlighted
            ? "bg-ds-info"
            : isCancelled
              ? "bg-ds-text-disabled"
              : isCompleted
                ? "bg-ds-success"
                : "bg-ds-border"
        }`}
      />

      <div className="flex items-start justify-between gap-2 pl-2">
        <div className="space-y-2 flex-1">
          {/* Date & Time Header */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-ds-text">
              {moment(service.date).locale("th").format("ddd D MMMM YYYY")}
            </span>
            <span className="flex items-center gap-1 rounded-md bg-ds-surface-elevated border border-ds-divider px-2 py-0.5 text-xs font-semibold text-ds-text">
              <Clock className="h-3 w-3 text-ds-icon-secondary" aria-hidden="true" />
              {service.time} น.
            </span>
            {isHighlighted && (
              <span className="rounded-full bg-ds-info-container px-2 py-0.5 text-[10px] font-bold text-ds-info">
                รายการที่เลือก
              </span>
            )}
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => {
                if (canEdit) onToggleStatus();
              }}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold transition-colors ${
                canEdit ? "cursor-pointer" : "cursor-not-allowed opacity-70"
              } ${
                isCancelled
                  ? "bg-ds-surface-variant text-ds-text-tertiary"
                  : isCompleted
                    ? "bg-ds-success-container text-ds-success"
                    : "bg-ds-warning-container text-ds-warning"
              }`}
              title={
                canEdit
                  ? isCompleted
                    ? "เปลี่ยนกลับเป็นรอดำเนินการ"
                    : "บันทึกเป็นบริการเสร็จสิ้น"
                  : isCancelled
                    ? "บริการนี้ถูกยกเลิกแล้ว"
                    : "ไม่สามารถเปลี่ยนสถานะได้เนื่องจากเกินระยะเวลาย้อนหลัง 1 เดือน"
              }
            >
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              {isCancelled ? "ยกเลิกแล้ว" : isCompleted ? "บริการเสร็จสิ้น" : "รอดำเนินการ"}
            </button>
          </div>

          {/* Service Tags */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {service.services && service.services.map((srv) => {
              const conf = SERVICE_CONFIG[srv as keyof typeof SERVICE_CONFIG];
              if (!conf) return null;
              return (
                <span
                  key={srv}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold ${conf.bg}`}
                >
                  {srv === "injection" && <Syringe className="h-3.5 w-3.5" />}
                  {srv === "other" && <MoreHorizontal className="h-3.5 w-3.5" />}
                  {conf.label}
                </span>
              );
            })}
            {service.otherServiceText && (
              <span className="text-xs text-ds-text-secondary">
                ({service.otherServiceText})
              </span>
            )}
          </div>

          {/* ตัวยาที่เคยทำ / ที่ต้องฉีด */}
          {service.medications && service.medications.length > 0 && (
            <div className="rounded-xl border border-ds-border bg-ds-surface-elevated p-2.5 text-xs text-ds-text">
              <div className="font-bold flex items-center gap-1 text-ds-text mb-1">
                <Syringe className="h-3.5 w-3.5 text-ds-icon-secondary" />
                <span>ตัวยาที่ใช้ ({service.medications.length} ตัวยา):</span>
              </div>
              <ul className="list-inside list-disc space-y-0.5 text-xs text-ds-text-secondary pl-1">
                {service.medications.map((med, idx) => (
                  <li key={idx} className="font-semibold">
                    {med}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Note & Price */}
          <div className="flex flex-wrap items-center justify-between text-xs text-ds-text-secondary pt-0.5 gap-2">
            {service.note && <span>📝 {service.note}</span>}
            {service.price !== undefined && service.price !== null ? (() => {
              const pricing = getServicePricingBreakdown(service);
              return (
                <div className="font-bold text-ds-success ml-auto">
                  {pricing.hasDiscount ? (
                    <span className="inline-flex items-baseline gap-1.5">
                      <span>ค่าบริการ:</span>
                      <strong className="text-sm font-extrabold text-ds-success">
                        ฿{pricing.netRevenue.toLocaleString()}
                      </strong>
                      <span className="text-[11px] line-through text-ds-text-tertiary">
                        ฿{pricing.grossFee.toLocaleString()}
                      </span>
                      <span className="rounded bg-ds-error-container px-1.5 py-0.5 text-[10px] font-bold text-ds-error">
                        (ลด ฿{pricing.discount.toLocaleString()})
                      </span>
                    </span>
                  ) : (
                    <span>ค่าบริการ: ฿{pricing.grossFee.toLocaleString()}</span>
                  )}
                </div>
              );
            })() : null}
          </div>
        </div>

        {/* Action Buttons: Edit + Delete */}
        <div className="flex items-center gap-1 shrink-0">
          {canEdit && onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="rounded-lg p-1.5 text-ds-icon-secondary hover:bg-ds-surface-variant hover:text-ds-text active:scale-95 transition-all cursor-pointer"
              title="แก้ไขนัดหมายนี้"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            disabled={!canDelete}
            onClick={() => {
              if (canDelete) onDelete();
            }}
            className={`rounded-lg p-1.5 transition-colors ${
              canDelete
                ? "text-ds-icon-secondary hover:bg-ds-error-container hover:text-ds-error active:scale-95 cursor-pointer"
                : "text-ds-icon-disabled opacity-40 cursor-not-allowed"
            }`}
            title={
              canDelete
                ? "ลบรายการนี้"
                : "ไม่สามารถลบได้เนื่องจากเกินระยะเวลาย้อนหลัง 1 เดือน"
            }
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
