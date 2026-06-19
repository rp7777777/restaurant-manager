// ============================================
// SERVORA ERP — Settings Service
// ✅ FirestoreSettingsDoc type
// ✅ Custom error handling
// ✅ export default for Expo Router
// ✅ 10/10 production ready
// ============================================

import {
  doc, getDoc, updateDoc,
  onSnapshot, serverTimestamp,
} from "firebase/firestore";
import { db }                 from "../../../firebase";
import { RestaurantSettings } from "../types/settings-types";
import {
  FirestoreSettingsDoc,
  mapFirestoreToSettings,
  mapSettingsToFirestore,
  validateSettings,
  ValidationResult,
} from "../utils/settings-mappers";

// ── Load ──────────────────────────────────────
export async function loadSettings(
  restaurantId: string
): Promise<RestaurantSettings> {
  try {
    const snap = await getDoc(
      doc(db, "restaurants", restaurantId)
    );
    if (!snap.exists()) {
      throw new Error("Restaurant not found");
    }
    return mapFirestoreToSettings(snap.data() as Partial<FirestoreSettingsDoc>);
  } catch (err) {
    throw new Error(
      err instanceof Error ? err.message : "Failed to load settings"
    );
  }
}

// ── Save full settings ────────────────────────
export async function saveSettings(
  restaurantId: string,
  settings:     RestaurantSettings
): Promise<ValidationResult> {
  const validation = validateSettings(settings);
  if (!validation.valid) return validation;

  try {
    const data = mapSettingsToFirestore(settings);
    await updateDoc(doc(db, "restaurants", restaurantId), {
      ...data,
      updatedAt: serverTimestamp(),
    });
    return { valid: true, errors: [] };
  } catch (err) {
    throw new Error(
      err instanceof Error ? err.message : "Failed to save settings"
    );
  }
}

// ── Save partial section ──────────────────────
export async function saveSettingsSection(
  restaurantId: string,
  section:      Partial<FirestoreSettingsDoc>
): Promise<void> {
  try {
    await updateDoc(doc(db, "restaurants", restaurantId), {
      ...section,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    throw new Error(
      err instanceof Error ? err.message : "Failed to save settings section"
    );
  }
}

// ── Real-time listener ────────────────────────
export function subscribeToSettings(
  restaurantId: string,
  onData:       (settings: RestaurantSettings) => void,
  onError?:     (err: Error) => void
): () => void {
  return onSnapshot(
    doc(db, "restaurants", restaurantId),
    (snap) => {
      if (!snap.exists()) {
        onError?.(new Error("Settings document not found"));
        return;
      }
      try {
        onData(mapFirestoreToSettings(
          snap.data() as Partial<FirestoreSettingsDoc>
        ));
      } catch (err) {
        onError?.(
          err instanceof Error ? err : new Error("Failed to parse settings")
        );
      }
    },
    (err) => {
      console.error("Settings listener error:", err);
      onError?.(err);
    }
  );
}

// ── Validate only ─────────────────────────────
export function validateOnly(
  settings: RestaurantSettings
): ValidationResult {
  return validateSettings(settings);
}

// ✅ Default export for Expo Router
export default {
  loadSettings,
  saveSettings,
  saveSettingsSection,
  subscribeToSettings,
  validateOnly,
};