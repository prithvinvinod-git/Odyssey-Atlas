import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, getDocs } from "firebase/firestore";
import fs from "fs";
import path from "path";
import "dotenv/config";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "odysseyatlas",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey) {
  console.error("Missing Firebase config. Set NEXT_PUBLIC_FIREBASE_API_KEY in .env.local");
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seedSites() {
  const sitesPath = path.resolve("data/sites.json");
  const sites = JSON.parse(fs.readFileSync(sitesPath, "utf-8"));

  const ref = doc(db, "config", "sites");
  await setDoc(ref, { sites, updated_at: new Date().toISOString() });
  console.log(`Seeded ${sites.length} sites to Firestore`);
}

async function seedCorpus() {
  const corpusPath = path.resolve("public/data/corpus.json");
  if (!fs.existsSync(corpusPath)) {
    console.log("Corpus file not found, skipping corpus seeding");
    return;
  }

  const corpus = JSON.parse(fs.readFileSync(corpusPath, "utf-8"));
  const pages = corpus.pages || [];

  for (const page of pages) {
    const ref = doc(db, "corpus_pages", page.id);
    await setDoc(ref, page);
  }
  console.log(`Seeded ${pages.length} corpus pages to Firestore`);
}

async function seedMeta() {
  const ref = doc(db, "config", "meta");
  await setDoc(ref, {
    version: "1.0.0",
    updated_at: new Date().toISOString(),
    allowed_domains: [
      "nasa.gov",
      "jpl.nasa.gov",
      "pds.nasa.gov",
      "naif.jpl.nasa.gov",
      "trek.nasa.gov",
      "lroc.sese.asu.edu",
    ],
  });
  console.log("Seeded config/meta");
}

async function main() {
  try {
    await seedSites();
    await seedCorpus();
    await seedMeta();
    console.log("Firestore seeding complete!");
  } catch (e) {
    console.error("Seeding failed:", e);
    process.exit(1);
  }
}

main();