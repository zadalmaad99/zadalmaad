const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "quran-26d25.firebasestorage.app",
});

async function main() {
  const firestoreSource = fs.readFileSync(
    path.join(__dirname, "..", "..", "firestore.rules"),
    "utf8"
  );
  const storageSource = fs.readFileSync(
    path.join(__dirname, "..", "..", "storage.rules"),
    "utf8"
  );

  const rulesClient = admin.securityRules();

  await rulesClient.releaseFirestoreRulesetFromSource(firestoreSource);
  console.log("Firestore rules deployed.");

  await rulesClient.releaseStorageRulesetFromSource(storageSource);
  console.log("Storage rules deployed.");
}

main().catch((err) => {
  console.error("Failed to deploy rules:", err);
  process.exit(1);
});
