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
//    category from this list (Option A: avoids repeating the same
//    value 60+ times across this file).
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
      { name: "Vegetables",                  icon: "🥬" },
      { name: "Fruits",                      icon: "🍎" },
      { name: "Meat",                        icon: "🥩" },
      { name: "Fish & Seafood",               icon: "🐟" },
      { name: "Eggs",                        icon: "🥚" },
      { name: "Dairy",                       icon: "🥛" },
      { name: "Rice, Pasta & Grains",         icon: "🍚" },
      { name: "Flour & Baking Ingredients",   icon: "🌾" },
      { name: "Beans & Pulses",               icon: "🫘" },
      { name: "Spices & Seasonings",          icon: "🧂" },
      { name: "Oils & Fats",                 icon: "🫒" },
      { name: "Canned & Preserved Foods",     icon: "🥫" },
      { name: "Frozen Foods",                icon: "❄️" },
      { name: "Sauces & Condiments",          icon: "🍯" },
      { name: "Sugar & Sweeteners",           icon: "🍬" },
    ],
  },
  {
    departmentName: "Beverage",
    categories: [
      { name: "Water",                icon: "💧" },
      { name: "Soft Drinks",          icon: "🥤" },
      { name: "Juices",               icon: "🧃" },
      { name: "Coffee",               icon: "☕" },
      { name: "Tea",                  icon: "🍵" },
      { name: "Milk & Dairy Drinks",  icon: "🥛" },
      { name: "Energy Drinks",        icon: "⚡" },
    ],
  },
  {
    departmentName: "Alcohol",
    categories: [
      { name: "Beer",              icon: "🍺" },
      { name: "Wine",              icon: "🍷" },
      { name: "Spirits",           icon: "🥃" },
      { name: "Cocktail Mixers",   icon: "🍸" },
    ],
  },
  {
    departmentName: "Bakery",
    categories: [
      { name: "Bakery Products",              icon: "🥐" },
      { name: "Cakes & Pastries",             icon: "🍰" },
      { name: "Cookies & Biscuits",           icon: "🍪" },
      { name: "Ice Cream & Frozen Desserts",  icon: "🍨" },
    ],
  },
  {
    departmentName: "Cleaning",
    categories: [
      { name: "Cleaning Chemicals",   icon: "🧴" },
      { name: "Cleaning Tools",       icon: "🧹" },
      { name: "Gloves & PPE",         icon: "🧤" },
      { name: "Paper Products",       icon: "🧻" },
    ],
  },
  {
    departmentName: "Packaging",
    categories: [
      { name: "Takeaway Containers",   icon: "🥡" },
      { name: "Cups & Lids",           icon: "🥤" },
      { name: "Disposable Cutlery",    icon: "🍴" },
      { name: "Bags",                 icon: "🛍️" },
      { name: "Packaging Materials",   icon: "📦" },
    ],
  },
  {
    departmentName: "Kitchen",
    categories: [
      { name: "Kitchen Utensils",           icon: "🔪" },
      { name: "Cookware",                   icon: "🍳" },
      { name: "Gas & Fuel",                 icon: "🧯" },
      { name: "Kitchen Equipment Parts",    icon: "🔧" },
    ],
  },
  {
    departmentName: "Hotel",
    categories: [
      { name: "Housekeeping",       icon: "🛏️" },
      { name: "Laundry Supplies",   icon: "🧺" },
      { name: "Guest Amenities",    icon: "🧴" },
      { name: "Bathroom Supplies",  icon: "🧻" },
      { name: "Room Supplies",      icon: "🛋️" },
    ],
  },
  {
    departmentName: "Maintenance",
    categories: [
      { name: "Electrical",   icon: "💡" },
      { name: "Plumbing",     icon: "🚰" },
      { name: "Hardware",     icon: "🔩" },
      { name: "Tools",        icon: "🧰" },
    ],
  },
  {
    departmentName: "Office",
    categories: [
      { name: "Office Supplies",      icon: "🖨️" },
      { name: "Stationery",           icon: "📝" },
      { name: "Printing Materials",   icon: "🖋️" },
      { name: "Promotional Items",    icon: "🎁" },
      { name: "Others",               icon: "📦" },
    ],
  },
];