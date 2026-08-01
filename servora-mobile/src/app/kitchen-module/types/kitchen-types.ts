// ============================================
// SERVORA ERP — Kitchen Module Types
// ✅ Moved verbatim from the old kitchen-module/index.tsx as part
//    of the Phase 2 module restructuring — types unchanged, just
//    relocated so repository/services/hooks/screens all share the
//    same source of truth instead of each file redefining its own.
// ============================================

export type RequestStatus = "PENDING" | "APPROVED" | "ISSUED" | "REJECTED";

export interface IngredientRequest {
  id: string;
  itemName: string;
  inventoryId?: string | null;  // ✅ links this request to a real Inventory item — lets Store's Issue step call recordStockMovement() directly instead of matching by name
  categoryId?: string | null;  // ✅ same category the item belongs to in Inventory, for grouping/reporting
  closingStock: number;
  minimumLevel: number;
  orderQuantity: number;
  unit: string;
  requiredDate: string;
  requestedBy: string;
  note: string;
  status: RequestStatus;
  restaurantId: string;
  createdAt?: unknown;  // ✅ matches the codebase-wide convention (StockMovement, PurchaseOrder also use `unknown`, not Timestamp) — kept consistent rather than typed differently just for Kitchen; a project-wide timestamp-typing pass is a separate future effort
  // ✅ The following were already being WRITTEN to Firestore by
  // store-module/index.tsx's handleApprove/handleReject/handleIssue
  // but were never typed anywhere until this restructuring — this
  // interface is now the single shared type for both Kitchen's
  // request-creation side and Store's approve/reject/issue side.
  approvedBy?: string;
  approvedAt?: unknown;
  rejectedBy?: string;
  rejectedAt?: unknown;
  issuedQuantity?: number;
  issuedBy?: string;
  issuedAt?: unknown;
  issueNote?: string | null;  // Store Keeper's own note at issue time (e.g. "only 18kg in stock, issuing partial") — separate from the Kitchen's original request note
}