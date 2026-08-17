// ============================================
// SERVORA ERP — Default Categories Seed Data
// ✅ MAJOR REVISION — reduced from 19 (grouped under 10 departments)
//    to 12 FLAT categories, no department nesting at all. This is a
//    confirmed, deliberate redesign: the previous granular structure
//    (Meat & Poultry, Fish & Seafood, Dairy Products, etc. as
//    separate categories) had drifted in production usage toward
//    60+ near-duplicate categories (e.g. "Dairy" AND "Dairy
//    Products", "Meat" AND "Meat & Poultry", "Beer"/"Wine"/"Spirits"
//    all separate from "Alcoholic Beverages") — a data-quality
//    problem that made category management unwieldy. The new
//    design: 12 BROAD categories that map cleanly onto a
//    restaurant's actual stock-taking mental model, where specific
//    product identity (salmon vs. chicken, beer vs. wine, rice vs.
//    pasta) lives in the ITEM's own name/description, not in a
//    proliferating category tree. A category answers "which shelf/
//    section does this belong to," not "what exact product is
//    this."
// ✅ isSystem is NOT stored per-item here — the seeder function sets
//    isSystem: true automatically when creating each category from
//    this list.
// ✅ NO departmentName grouping anymore — CategorySeedItem is now a
//    flat list, matching the confirmed "12 main categories, no
//    parent-child nesting" design. Categories created from this
//    list have NO departmentId (same as any category created later
//    via the future Manage Categories admin screen) — department
//    remains available as an OPTIONAL categorization dimension
//    elsewhere in the schema, but the default seed no longer
//    assumes every category needs one.
// ✅ "Other / Miscellaneous" is INTENTIONALLY included this time
//    (previously avoided as a dumping-ground risk) — with the
//    category list now broad rather than granular, a genuine
//    catch-all is useful for the rare item that doesn't fit any of
//    the other 11 buckets, rather than forcing an awkward fit.
// FROZEN
// ============================================

export interface CategorySeedItem {
  name:  string;
  icon?: string;
}

export const DEFAULT_CATEGORIES: CategorySeedItem[] = [
  { name: "Food & Ingredients",                icon: "🍽️" },
  { name: "Beverages",                         icon: "🥤" },
  { name: "Alcoholic Beverages",               icon: "🍷" },
  { name: "Sauces, Oils & Seasonings",         icon: "🧂" },
  { name: "Dry Goods & Pantry",                icon: "🌾" },
  { name: "Kitchen Equipment & Utensils",      icon: "🔪" },
  { name: "Cleaning & Housekeeping",           icon: "🧼" },
  { name: "Packaging & Takeaway",              icon: "🥡" },
  { name: "Guest Amenities & Room Supplies",   icon: "🛏️" },
  { name: "Office & Stationery",               icon: "🖨️" },
  { name: "Maintenance, Hardware & Electrical", icon: "🔧" },
  { name: "Other / Miscellaneous",             icon: "📦" },
];