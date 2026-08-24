// ============================================
// SERVORA ERP — useSupplierForm Hook
// ✅ Handles BOTH create and edit — if `existing` is passed, submit
//    calls updateSupplier(); otherwise createSupplier().
// ✅ Only `name` is required — matches the FROZEN repository.
// ✅ supplierCode is NOT part of this form — server-generated,
//    immutable.
// ✅ status defaults to "ACTIVE" for new suppliers.
// ✅ FIX — submit() now returns { ok: boolean; supplierId?: string }
//    instead of a bare boolean. createSupplier() (the FROZEN
//    repository function) already returns the new supplier's id —
//    previously that return value was silently discarded
//    (`await createSupplier(...)`, result unused). Now it's captured
//    and surfaced to the caller, enabling the Inventory "New
//    Supplier" detour to know exactly which supplier was just
//    created (to auto-select it when the Add Item draft is
//    restored) without needing a separate lookup. `ok` is kept as
//    the primary success/failure signal (unchanged meaning) so this
//    is a low-risk, additive change — callers that only checked
//    `.ok` continue to work identically; only callers that also want
//    the id need to read the new field.
// PHASE 8.3
// ============================================

import { useState, useCallback } from "react";
import {
  createSupplier,
  updateSupplier,
} from "../repository/supplier-repository";
import { Supplier, SupplierStatus, CreateSupplierInput } from "../types/supplier";

export interface SupplierSubmitResult {
  ok:          boolean;
  supplierId?: string; // only set on a successful CREATE (not update)
}

export interface UseSupplierFormResult {
  name:             string;
  setName:          (v: string) => void;
  companyName:      string;
  setCompanyName:   (v: string) => void;
  contactPerson:    string;
  setContactPerson: (v: string) => void;
  phone:            string;
  setPhone:         (v: string) => void;
  email:            string;
  setEmail:         (v: string) => void;
  taxId:            string;
  setTaxId:         (v: string) => void;
  address:          string;
  setAddress:       (v: string) => void;
  country:          string;
  setCountry:       (v: string) => void;
  currency:         string;
  setCurrency:      (v: string) => void;
  paymentTerms:     string;
  setPaymentTerms:  (v: string) => void;
  status:           SupplierStatus;
  setStatus:        (v: SupplierStatus) => void;
  notes:            string;
  setNotes:         (v: string) => void;
  saving:           boolean;
  error:            string | null;
  submit:           (restaurantId: string) => Promise<SupplierSubmitResult>;
}

export function useSupplierForm(existing?: Supplier): UseSupplierFormResult {
  const [name, setName]                   = useState(existing?.name ?? "");
  const [companyName, setCompanyName]     = useState(existing?.companyName ?? "");
  const [contactPerson, setContactPerson] = useState(existing?.contactPerson ?? "");
  const [phone, setPhone]                 = useState(existing?.phone ?? "");
  const [email, setEmail]                 = useState(existing?.email ?? "");
  const [taxId, setTaxId]                 = useState(existing?.taxId ?? "");
  const [address, setAddress]             = useState(existing?.address ?? "");
  const [country, setCountry]             = useState(existing?.country ?? "");
  const [currency, setCurrency]           = useState(existing?.currency ?? "");
  const [paymentTerms, setPaymentTerms]   = useState(existing?.paymentTerms ?? "");
  const [status, setStatus]               = useState<SupplierStatus>(existing?.status ?? "ACTIVE");
  const [notes, setNotes]                 = useState(existing?.notes ?? "");
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  const submit = useCallback(
    async (restaurantId: string): Promise<SupplierSubmitResult> => {
      setError(null);

      if (!name.trim()) {
        setError("Supplier name is required");
        return { ok: false };
      }

      const input: CreateSupplierInput = {
        name:          name.trim(),
        companyName:   companyName.trim() || undefined,
        contactPerson: contactPerson.trim() || undefined,
        phone:         phone.trim() || undefined,
        email:         email.trim() || undefined,
        taxId:         taxId.trim() || undefined,
        address:       address.trim() || undefined,
        country:       country.trim() || undefined,
        currency:      currency.trim() || undefined,
        paymentTerms:  paymentTerms.trim() || undefined,
        status,
        notes:         notes.trim() || undefined,
      };

      setSaving(true);
      try {
        if (existing) {
          await updateSupplier(restaurantId, existing.id, input);
          return { ok: true };
        } else {
          const newId = await createSupplier(restaurantId, input);
          return { ok: true, supplierId: newId };
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save supplier");
        return { ok: false };
      } finally {
        setSaving(false);
      }
    },
    [name, companyName, contactPerson, phone, email, taxId, address, country, currency, paymentTerms, status, notes, existing]
  );

  return {
    name, setName,
    companyName, setCompanyName,
    contactPerson, setContactPerson,
    phone, setPhone,
    email, setEmail,
    taxId, setTaxId,
    address, setAddress,
    country, setCountry,
    currency, setCurrency,
    paymentTerms, setPaymentTerms,
    status, setStatus,
    notes, setNotes,
    saving, error,
    submit,
  };
}