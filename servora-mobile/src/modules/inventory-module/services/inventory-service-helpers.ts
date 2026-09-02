// ============================================
// SERVORA ERP — Inventory Service Helpers
// ✅ EXTRACTED from inventory-service.ts (990-line file split into
//    focused modules) — pure structural refactor, NO behavior
//    change. All functions here are byte-for-byte identical to
//    their original inventory-service.ts implementations.
// ✅ Shared, stateless helpers used across all inventory service
//    files: Firestore document/collection path builders,
//    isLowStock computation, batch-key encoding, date validation,
//    and the ActorInfo type.
// FROZEN
// ============================================

import { doc, collection } from "firebase/firestore";
import { db } from "../../../firebase";
import { COL, RCOL } from "../../../constants/firestore-collections";

export function inventoryDoc(restaurantId: string, itemId: string) {
  return doc(db, COL.RESTAURANTS, restaurantId, RCOL.INVENTORY, itemId);
}

export function batchDoc(restaurantId: string, batchId: string) {
  return doc(db, COL.RESTAURANTS, restaurantId, RCOL.INVENTORY_BATCHES, batchId);
}

export function batchesCollection(restaurantId: string) {
  return collection(db, COL.RESTAURANTS, restaurantId, RCOL.INVENTORY_BATCHES);
}

export function stockMovementsCollection(restaurantId: string) {
  return collection(db, COL.RESTAURANTS, restaurantId, RCOL.STOCK_MOVEMENTS);
}

export function batchKeyDoc(restaurantId: string, key: string) {
  return doc(db, COL.RESTAURANTS, restaurantId, RCOL.BATCH_KEYS, key);
}

// ✅ Single source of truth for isLowStock, matching
// inventory-repository.ts's own corrected formula exactly.
export function computeIsLowStock(currentStock: number, minStock: number): boolean {
  return currentStock > 0 && currentStock <= minStock;
}

const BASE64URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function utf8Bytes(str: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.codePointAt(i)!;
    if (code > 0xFFFF) i++;
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xC0 | (code >> 6), 0x80 | (code & 0x3F));
    } else if (code < 0x10000) {
      bytes.push(0xE0 | (code >> 12), 0x80 | ((code >> 6) & 0x3F), 0x80 | (code & 0x3F));
    } else {
      bytes.push(
        0xF0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3F),
        0x80 | ((code >> 6) & 0x3F),
        0x80 | (code & 0x3F)
      );
    }
  }
  return bytes;
}

function base64UrlEncode(str: string): string {
  const bytes = utf8Bytes(str);
  let result = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : undefined;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : undefined;

    result += BASE64URL_ALPHABET[b0 >> 2];
    result += BASE64URL_ALPHABET[((b0 & 0x03) << 4) | (b1 !== undefined ? b1 >> 4 : 0)];
    if (b1 !== undefined) {
      result += BASE64URL_ALPHABET[((b1 & 0x0F) << 2) | (b2 !== undefined ? b2 >> 6 : 0)];
    }
    if (b2 !== undefined) {
      result += BASE64URL_ALPHABET[b2 & 0x3F];
    }
  }
  return result;
}

export function normalizeBatchKeyString(batchNo: string): string {
  return batchNo.trim().toLowerCase();
}

export function normalizeBatchKey(inventoryId: string, batchNo: string): string {
  return `${inventoryId}__${base64UrlEncode(normalizeBatchKeyString(batchNo))}`;
}

export function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

export interface ActorInfo {
  createdByName?: string;
  createdByRole?: string;
}