// ============================================
// SERVORA ERP — Default Categories Seed Data
// ✅ Grouped by department NAME (not ID) — at seed time, actual
//    Firestore department IDs don't exist yet. The seeding
//    orchestrator (built when we wire this into the Store setup
//    flow) creates departments first, then looks up each category's
//    departmentId by matching departmentName here against the
//    freshly-created department's name.
// ✅ isSystem is NOT stored per-item here — the future seeder
//    function sets isSystem: true automatically when creating each
//    category from this list.
// ✅ TRIMMED (pre-launch, evolutionary change) — reduced from the
//    original 58 down to 19 categories across 10 departments.
//    Matches standard SAP/Oracle/Odoo/Dynamics ERP practice: a
//    lean, core default set (10-15 for the primary Food department,
//    1 catch-all per secondary department) covers ~90-95% of
//    restaurants/cafés/bars/hotels out of the box. "+ Add Category"
//    covers anything niche (sushi-specific ingredients, vegan
//    products, imported items) without bloating every new
//    restaurant's default list.
// ✅ "Water" was folded into "Beverages" rather than kept separate —
//    water is a product (Mineral Water, Sparkling Water), not a
//    distinct category, same reasoning applied to Soft
//    Drinks/Juices/Coffee & Tea/Energy Drinks all merging into one
//    Beverages category.
// ✅ "Snacks & Miscellaneous" was avoided — a "Miscellaneous"-style
//    category tends to become a dumping ground in ERPs over time;
//    Snacks properly belongs under the existing Food categories
//    (Dry Goods & Grains, Canned & Preserved, or a specific item's
//    owner-added category) rather than needing its own vague bucket.
// FROZEN
// ============================================

export interface CategorySeedItem {
  name:  string;
  icon?: string;
}

export interface CategorySeedGroup {
  departmentName: string;
  categories:     CategorySeedItem[];
}

export const DEFAULT_CATEGORIES_BY_DEPARTMENT: CategorySeedGroup[] = [
  {
    departmentName: "Food",
    categories: [
      { name: "Meat & Poultry",             icon: "🥩" },
      { name: "Fish & Seafood",              icon: "🐟" },
      { name: "Vegetables",                 icon: "🥬" },
      { name: "Fruits",                     icon: "🍎" },
      { name: "Dairy Products",              icon: "🧀" },
      { name: "Eggs",                       icon: "🥚" },
      { name: "Frozen Foods",               icon: "🧊" },
      { name: "Dry Goods & Grains",          icon: "🌾" },
      { name: "Spices & Seasonings",         icon: "🧂" },
      { name: "Oils, Sauces & Condiments",   icon: "🫒" },
    ],
  },
  {
    departmentName: "Beverage",
    categories: [
      { name: "Beverages",  icon: "🥤" },
    ],
  },
  {
    departmentName: "Alcohol",
    categories: [
      { name: "Alcoholic Beverages",  icon: "🍷" },
    ],
  },
  {
    departmentName: "Bakery",
    categories: [
      { name: "Bakery & Desserts",  icon: "🍰" },
    ],
  },
  {
    departmentName: "Cleaning",
    categories: [
      { name: "Cleaning & Consumables",  icon: "🧼" },
    ],
  },
  {
    departmentName: "Packaging",
    categories: [
      { name: "Takeaway & Packaging",  icon: "🥡" },
    ],
  },
  {
    departmentName: "Kitchen",
    categories: [
      { name: "Kitchen Equipment & Supplies",  icon: "🔪" },
    ],
  },
  {
    departmentName: "Hotel",
    categories: [
      { name: "Housekeeping & Amenities",  icon: "🛏️" },
    ],
  },
  {
    departmentName: "Maintenance",
    categories: [
      { name: "Maintenance & Repairs",  icon: "🔧" },
    ],
  },
  {
    departmentName: "Office",
    categories: [
      { name: "Office & Stationery",  icon: "🖨️" },
    ],
  },
];