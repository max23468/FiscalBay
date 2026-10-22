import { env } from "cloudflare:workers";

import { completeRegistration } from "../../app/domain/registration.server";
import { createAuth } from "../../app/auth.server";

import { now } from "./database-fixtures";

export const syntheticProfile = {
  firstName: "Utente",
  lastName: "Sintetico",
  accountType: "private",
  companyName: null,
} as const;

export async function verifiedSession(email: string): Promise<{ userId: string; cookie: string }> {
  const auth = createAuth(env);
  const password = "Una-password-negozio-molto-lunga";
  await auth.handler(
    new Request("http://localhost:5173/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Venditore", email, password }),
    }),
  );
  const user = await env.DB.prepare('SELECT id FROM "user" WHERE email = ?')
    .bind(email)
    .first<{ id: string }>();
  await env.DB.prepare('UPDATE "user" SET "emailVerified" = 1 WHERE id = ?').bind(user!.id).run();
  await completeRegistration(env.DB, {
    userId: user!.id,
    language: "it",
    now: new Date(now),
    profile: syntheticProfile,
    agreement: { marketing: false },
  });
  const signIn = await auth.handler(
    new Request("http://localhost:5173/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  );
  return { userId: user!.id, cookie: signIn.headers.get("set-cookie")! };
}

export function sessionCookie(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

export async function profileOf(userId: string) {
  return env.DB.prepare(
    "SELECT first_name, last_name, account_type, company_name FROM user_profiles WHERE user_id = ?",
  )
    .bind(userId)
    .first();
}
