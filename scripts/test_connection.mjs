import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envPath = ".env.local";
if (!fs.existsSync(envPath)) {
  console.error(".env.local not found!");
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, "utf-8");
const env = {};
envContent.split(/\r?\n/).forEach((line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx !== -1) {
    const k = trimmed.slice(0, eqIdx).trim();
    let v = trimmed.slice(eqIdx + 1).trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    env[k] = v;
  }
});

const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

console.log("Checking Supabase connection to:", url);

const supabase = createClient(url, key);

async function check() {
  const tables = ["shifts", "personal_events", "customer_services", "user_profile", "todos"];
  let allReady = true;

  for (const table of tables) {
    const { error } = await supabase.from(table).select("id").limit(1);
    if (error) {
      console.log(`❌ Table '${table}': not found or error (${error.message})`);
      allReady = false;
    } else {
      console.log(`✅ Table '${table}': ready!`);
    }
  }

  if (allReady) {
    console.log("\n🎉 All Supabase tables are ready!");
  } else {
    console.log("\n⚠️ Some tables are missing. Please run 'supabase/migrations/20261006_init.sql' in your Supabase SQL Editor.");
  }
}

check();
