import { execFileSync } from "node:child_process";

import { seedLocalAccount } from "./local-account";

export default async function setup() {
  // Diagnostica temporanea, da rimuovere.
  if (process.env.CI)
    execFileSync(process.execPath, ["e2e/networkidle-trace.mjs"], { stdio: "inherit" });
  if (!process.env.E2E_BASE_URL && process.env.E2E_PRODUCTION !== "1") await seedLocalAccount();
}
