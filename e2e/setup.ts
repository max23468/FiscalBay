import { seedLocalAccount } from "./local-account";

export default async function setup() {
  if (!process.env.E2E_BASE_URL && process.env.E2E_PRODUCTION !== "1") await seedLocalAccount();
}
