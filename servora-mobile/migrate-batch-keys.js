// ============================================
// SERVORA ERP — batchKeys Backfill Migration
// ONE-TIME MANUAL MIGRATION
// ✅ FIX — uses the modular firebase-admin/app and
//    firebase-admin/firestore imports instead of the classic
//    require("firebase-admin") + admin.credential/admin.firestore
//    pattern, which had a broken ESM/CJS interop on this installed
//    version (admin.credential came back undefined).
// ============================================

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const serviceAccount = require("./restro-manager-7cf02-firebase-adminsdk-fbsvc-ba8f8d9dcb.json");

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

// ============================================================
// SAFETY SWITCH
// true  = READ ONLY
// false = ACTUALLY WRITE
// NEVER change this to false until the dry-run output has been
// reviewed.
// ============================================================
const DRY_RUN = true;

// ============================================================
// Exact same Base64URL implementation as inventory-service.ts
// ============================================================
const BASE64URL_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function utf8Bytes(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.codePointAt(i);
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

function base64UrlEncode(str) {
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

function normalizeBatchKey(inventoryId, batchNo) {
  const normalized = batchNo.trim().toLowerCase();
  return `${inventoryId}__${base64UrlEncode(normalized)}`;
}

// ============================================================
// Migrate ONE restaurant
// ============================================================
async function migrateRestaurant(restaurantId) {
  console.log("\n============================================");
  console.log(`Restaurant: ${restaurantId}`);
  console.log("============================================");

  const restaurantRef = db.collection("restaurants").doc(restaurantId);
  const batchesRef = restaurantRef.collection("inventoryBatches");
  const batchKeysRef = restaurantRef.collection("batchKeys");

  const batchesSnap = await batchesRef.get();
  console.log(`Found ${batchesSnap.size} batch document(s).`);

  let created = 0;
  let alreadyExists = 0;
  let invalid = 0;

  const keyGroups = new Map();

  // STEP 1 — Build normalized-key groups first
  for (const batchDoc of batchesSnap.docs) {
    const batch = batchDoc.data();

    const inventoryId = typeof batch.inventoryId === "string" ? batch.inventoryId.trim() : "";
    const batchNo = typeof batch.batchNo === "string" ? batch.batchNo.trim() : "";

    if (!inventoryId || !batchNo) {
      invalid++;
      console.log(`⚠️ SKIP invalid batch ${batchDoc.id} — missing inventoryId or batchNo`);
      continue;
    }

    const key = normalizeBatchKey(inventoryId, batchNo);

    if (!keyGroups.has(key)) {
      keyGroups.set(key, []);
    }
    keyGroups.get(key).push({ batchId: batchDoc.id, inventoryId, batchNo });
  }

  // STEP 2 — Detect duplicates BEFORE writing anything
  const duplicateGroups = [];
  for (const [key, entries] of keyGroups.entries()) {
    if (entries.length > 1) {
      duplicateGroups.push({ key, entries });
    }
  }

  if (duplicateGroups.length > 0) {
    console.log("\n⚠️ TRUE DUPLICATES FOUND:");
    for (const duplicate of duplicateGroups) {
      console.log(`\nKey: ${duplicate.key}`);
      for (const entry of duplicate.entries) {
        console.log(`   batchId=${entry.batchId} | batchNo="${entry.batchNo}"`);
      }
    }
    console.log("\n❌ Duplicate groups will NOT be migrated.");
  }

  // STEP 3 — Process only unique keys
  for (const [key, entries] of keyGroups.entries()) {
    if (entries.length > 1) continue;

    const entry = entries[0];
    const keyRef = batchKeysRef.doc(key);
    const keySnap = await keyRef.get();

    if (keySnap.exists) {
      const existingKey = keySnap.data();

      if (existingKey.batchId !== entry.batchId) {
        console.log(`\n🚨 KEY INTEGRITY CONFLICT`);
        console.log(`Key: ${key}`);
        console.log(`Existing batchId: ${existingKey.batchId}`);
        console.log(`Expected batchId: ${entry.batchId}`);
        console.log("❌ NOT modifying this key.");
        continue;
      }

      alreadyExists++;
      console.log(`✓ Already correct: batchKeys/${key} → ${entry.batchId}`);
      continue;
    }

    console.log(`\n${DRY_RUN ? "[DRY RUN] Would create" : "Creating"} batchKeys/${key}`);
    console.log(`   → batchId: ${entry.batchId}`);
    console.log(`   → batchNo: "${entry.batchNo}"`);

    if (!DRY_RUN) {
      await keyRef.set({
        inventoryId: entry.inventoryId,
        batchNo: entry.batchNo,
        batchId: entry.batchId,
        restaurantId,
        createdAt: FieldValue.serverTimestamp(),
        migratedAt: FieldValue.serverTimestamp(),
      });
    }

    created++;
  }

  console.log("\n--------------------------------------------");
  console.log(`SUMMARY — ${restaurantId}`);
  console.log("--------------------------------------------");
  console.log(`Total batches scanned:       ${batchesSnap.size}`);
  console.log(`Unique keys discovered:      ${keyGroups.size}`);
  console.log(`Keys created / would create: ${created}`);
  console.log(`Already correct:             ${alreadyExists}`);
  console.log(`Invalid batches skipped:     ${invalid}`);
  console.log(`Duplicate groups:            ${duplicateGroups.length}`);

  if (duplicateGroups.length > 0) {
    console.log("\n⚠️ MANUAL ACTION REQUIRED for duplicate groups.");
  }
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log("\n============================================");
  console.log("SERVORA ERP — batchKeys Backfill");
  console.log("============================================");

  if (DRY_RUN) {
    console.log("\n🔍 DRY RUN MODE — NO FIRESTORE WRITES");
  } else {
    console.log("\n🔥 LIVE MODE — FIRESTORE WRITES ENABLED");
  }

  const restaurantsSnap = await db.collection("restaurants").get();
  console.log(`\nFound ${restaurantsSnap.size} restaurant(s).`);

  for (const restaurantDoc of restaurantsSnap.docs) {
    await migrateRestaurant(restaurantDoc.id);
  }

  console.log("\n============================================");
  console.log("✅ MIGRATION FINISHED");
  console.log("============================================");

  if (DRY_RUN) {
    console.log("\nThis was ONLY a DRY RUN.");
    console.log("Review the output carefully.");
    console.log("If everything looks correct, change:");
    console.log("DRY_RUN = false");
    console.log("and run the script again.");
  } else {
    console.log("\n🔥 LIVE migration completed.");
  }
}

main().catch((error) => {
  console.error("\n❌ Migration failed:");
  console.error(error);
  process.exit(1);
});