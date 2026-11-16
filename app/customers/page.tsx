"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  UserPlus,
  Pencil,
  Trash2,
  CalendarPlus,
  ChevronRight,
  Users,
  X,
} from "lucide-react";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import ModalAddTodo from "../components/ModalAddTodo";
import ModalEditCustomer from "../components/ModalEditCustomer";
import ModalDeleteCustomer from "../components/ModalDeleteCustomer";
import { Customer } from "../../types/vendee";
import {
  getCustomers,
  saveCustomer,
  subscribeToStorage,
  syncCustomersFromApi,
} from "../../lib/storage";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [openAddServiceModal, setOpenAddServiceModal] = useState(false);
  const [selectedCustomerIdForService, setSelectedCustomerIdForService] = useState<string | undefined>(undefined);

  const [openNewCustomerModal, setOpenNewCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [openEditCustomerModal, setOpenEditCustomerModal] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustError, setNewCustError] = useState("");

  const [isSyncing, setIsSyncing] = useState(false);

  // Load customers from local storage
  const loadLocalData = useCallback(() => {
    setCustomers(getCustomers());
  }, []);

  const syncData = useCallback(async () => {
    setIsSyncing(true);
    try {
      await syncCustomersFromApi();
      loadLocalData();
    } catch (err) {
      console.warn("Customers sync error:", err);
    } finally {
      setIsSyncing(false);
    }
  }, [loadLocalData]);

  const reloadData = useCallback(() => {
    loadLocalData();
    syncData();
  }, [loadLocalData, syncData]);

  useEffect(() => {
    loadLocalData();
    syncData();
    const unsubscribe = subscribeToStorage(loadLocalData);
    return () => unsubscribe();
  }, [loadLocalData, syncData]);

  // Search filter across Name
  const filteredCustomers = useMemo(() => {
    const list = !searchQuery.trim()
      ? customers
      : customers.filter((c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
        );
    return [...list].sort((a, b) => (a.name || "").localeCompare(b.name || "", "th", { numeric: true }));
  }, [customers, searchQuery]);

  // Open Add Service modal with specific customer preselected
  const handleOpenAddService = (customerId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedCustomerIdForService(customerId);
    setOpenAddServiceModal(true);
  };

  // Save new customer
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) {
      setNewCustError("กรุณากรอกชื่อลูกค้า");
      return;
    }

    const payload = {
      name: newCustName.trim(),
    };

    await saveCustomer(payload);

    setOpenNewCustomerModal(false);
    setNewCustName("");
    setNewCustError("");
    loadLocalData();
  };

  return (
    <div className="flex min-h-screen flex-col bg-ds-bg text-ds-text">
      {/* Header */}
      <AppBar
        title="รายชื่อลูกค้า"
        isSyncing={isSyncing}
      />

      {/* Main Container */}
      <main className="mx-auto w-full max-w-lg flex-1 p-4 space-y-4">
        {/* Search Bar & Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpenNewCustomerModal(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-ds-primary px-3.5 py-2.5 text-xs font-bold text-ds-on-primary shadow-ds-card hover:bg-ds-primary-hover active:scale-95 transition-all cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
            <span>เพิ่มลูกค้า</span>
          </button>
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อลูกค้า..."
              className="w-full rounded-2xl border border-ds-border bg-ds-surface-elevated py-2.5 pl-10 pr-9 text-sm text-ds-text placeholder:text-ds-text-tertiary shadow-2xs outline-none focus:border-ds-primary"
            />
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ds-icon-secondary" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="ล้างคำค้นหา"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ds-icon-secondary hover:text-ds-text cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Customer Count Badge */}
        <div className="flex items-center justify-between text-xs text-ds-text-secondary px-1">
          <span>
            พบทั้งหมด <strong className="text-ds-text">{filteredCustomers.length}</strong> ท่าน
          </span>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-ds-primary hover:underline font-medium cursor-pointer"
            >
              ล้างการค้นหา
            </button>
          )}
        </div>

        {/* Customer Card List */}
        {filteredCustomers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-ds-border bg-ds-surface p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ds-surface-elevated text-ds-icon-secondary mb-3">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="font-semibold text-ds-text">
              {searchQuery ? "ไม่พบข้อมูลลูกค้าที่ค้นหา" : "ยังไม่มีรายชื่อลูกค้า"}
            </h3>
            <p className="text-xs text-ds-text-secondary mt-1 max-w-xs">
              {searchQuery
                ? "ลองตรวจสอบคำค้นหา หรือกดปุ่มเพิ่มลูกค้าใหม่"
                : ""}
            </p>
            <button
              type="button"
              onClick={() => setOpenNewCustomerModal(true)}
              className="mt-4 flex items-center gap-1.5 rounded-xl bg-ds-primary px-4 py-2 text-xs font-bold text-ds-on-primary shadow-xs hover:bg-ds-primary-hover cursor-pointer"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>เพิ่มลูกค้าใหม่</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCustomers.map((cust) => (
              <div
                key={cust.id}
                className="group relative overflow-hidden rounded-2xl border border-ds-border bg-ds-surface p-4 shadow-ds-card transition-colors hover:border-ds-text-tertiary/60"
              >
                {/* Clickable entire card to /customers/[id] */}
                <Link
                  href={`/customers/${cust.id}`}
                  className="block"
                >
                  {/* Top Row: Neutral Initials Avatar + Name */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-ds-border bg-ds-surface-elevated text-xs font-bold text-ds-text">
                        {cust.name.substring(0, 2)}
                      </div>
                      <span className="truncate text-sm font-bold text-ds-text">
                        {cust.name}
                      </span>
                    </div>

                    <ChevronRight className="h-4 w-4 text-ds-icon-secondary group-hover:text-ds-primary transition-colors shrink-0" />
                  </div>
                </Link>

                {/* Bottom Action Bar */}
                <div className="mt-3 flex items-center justify-between border-t border-ds-divider pt-2.5">
                  {/* Actions: ปุ่มแก้ไขลูกค้า + ปุ่มลบลูกค้า */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditingCustomer(cust);
                        setOpenEditCustomerModal(true);
                      }}
                      className="inline-flex items-center gap-1 rounded-xl border border-ds-border bg-ds-surface-elevated px-2.5 py-1.5 text-xs font-bold text-ds-text hover:bg-ds-surface-variant active:scale-95 transition-all cursor-pointer"
                      title="แก้ไขข้อมูลลูกค้า"
                    >
                      <Pencil className="h-3.5 w-3.5 text-ds-icon-secondary" />
                      <span>แก้ไข</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setCustomerToDelete(cust);
                        setOpenDeleteModal(true);
                      }}
                      className="inline-flex items-center gap-1 rounded-xl border border-ds-error/30 bg-ds-error-container/70 px-2.5 py-1.5 text-xs font-bold text-ds-error hover:bg-ds-error-container active:scale-95 transition-all cursor-pointer"
                      title="ลบข้อมูลลูกค้า"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>ลบ</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleOpenAddService(cust.id, e)}
                    className="inline-flex items-center gap-1 rounded-xl border border-ds-primary/25 bg-ds-primary-container px-3 py-1.5 text-xs font-bold text-ds-primary hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                  >
                    <CalendarPlus className="h-3.5 w-3.5" />
                    <span>+ นัดหมายบริการ</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal Edit Customer */}
      <ModalEditCustomer
        customer={editingCustomer}
        isOpen={openEditCustomerModal}
        onClose={() => {
          setOpenEditCustomerModal(false);
          setEditingCustomer(null);
        }}
        onSuccess={() => {
          reloadData();
        }}
      />

      {/* Modal Delete Customer */}
      <ModalDeleteCustomer
        customer={customerToDelete}
        isOpen={openDeleteModal}
        onClose={() => {
          setOpenDeleteModal(false);
          setCustomerToDelete(null);
        }}
        onSuccess={() => {
          reloadData();
        }}
      />

      {/* Modal Add Todo (Customer Service with preselected ID) */}
      <ModalAddTodo
        openModal={openAddServiceModal}
        toggleModal={() => {
          setOpenAddServiceModal(false);
          setSelectedCustomerIdForService(undefined);
        }}
        initialTab="service"
        initialCustomerId={selectedCustomerIdForService}
        onSuccess={() => {
          setOpenAddServiceModal(false);
          setSelectedCustomerIdForService(undefined);
          reloadData();
        }}
      />

      {/* Modal Add New Customer */}
      {openNewCustomerModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-customer-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div
            className="fixed inset-0 bg-ds-overlay backdrop-blur-xs transition-opacity"
            onClick={() => setOpenNewCustomerModal(false)}
          />
          <div className="relative z-50 w-full max-w-md rounded-3xl border border-ds-border bg-ds-surface-elevated p-5 shadow-ds-popover">
            <div className="flex items-center justify-between border-b border-ds-divider pb-3">
              <h2 id="new-customer-title" className="text-base font-bold text-ds-text flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-ds-icon-primary" />
                <span>เพิ่มลูกค้าใหม่</span>
              </h2>
              <button
                type="button"
                onClick={() => setOpenNewCustomerModal(false)}
                aria-label="ปิดหน้าต่าง"
                className="rounded-full p-1 text-ds-icon-secondary hover:bg-ds-surface-variant hover:text-ds-text cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {newCustError && (
              <div className="mt-3 rounded-xl bg-ds-error-container p-2 text-xs font-semibold text-ds-error">
                {newCustError}
              </div>
            )}

            <form onSubmit={handleCreateCustomer} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-ds-text-secondary mb-1">
                  ชื่อ-นามสกุล หรือชื่อเรียก <span className="text-ds-error">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น คุณยายสมศรี สุขเกษม"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  className="w-full rounded-xl border border-ds-border bg-ds-surface px-3.5 py-2 text-sm text-ds-text placeholder:text-ds-text-tertiary outline-none focus:border-ds-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-ds-divider">
                <button
                  type="button"
                  onClick={() => setOpenNewCustomerModal(false)}
                  className="rounded-xl border border-ds-border bg-ds-surface px-4 py-2 text-xs font-semibold text-ds-text-secondary hover:bg-ds-surface-variant hover:text-ds-text cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-ds-primary px-5 py-2 text-xs font-bold text-ds-on-primary shadow-xs hover:bg-ds-primary-hover cursor-pointer"
                >
                  บันทึกข้อมูลลูกค้า
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <BottomNav
        onOpenAdd={() => {
          setSelectedCustomerIdForService(undefined);
          setOpenAddServiceModal(true);
        }}
      />
    </div>
  );
}
