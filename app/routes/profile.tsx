import { env } from "cloudflare:workers";
import { data } from "react-router";

import { AccountShell } from "~/components/account";
import { ProfilePage } from "~/components/settings";
import { assertSameOrigin, requireAccountArea } from "../account-area.server";
import { appCopy } from "../app-copy";
import { completeRegistration, parseProfile } from "../domain/registration.server";
import { languageFromPath } from "../i18n";
import type { ActionResult } from "../view-models";
import type { Route } from "./+types/profile";

export function meta({ location }: Route.MetaArgs): Route.MetaDescriptors {
  const t = appCopy[languageFromPath(location.pathname)];
  return [{ title: `FiscalBay | ${t.profile.title}` }, { name: "robots", content: "noindex" }];
}

export function headers(): HeadersInit {
  return { "cache-control": "no-store" };
}

/** Profilo dall'avatar: i dati minimi personali raccolti alla registrazione. */
export async function loader({ request }: Route.LoaderArgs) {
  const { language, profile, account } = await requireAccountArea(request);
  return { language, account: { ...account, profile } };
}

/** Aggiorna nome, cognome e ragione sociale; il tipo di account resta quello registrato. */
export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  const { language, session, profile: current } = await requireAccountArea(request);
  const t = appCopy[language].profile;
  const form = await request.formData();
  form.set("tipo", current.accountType === "business" ? "azienda" : "privato");
  const profile = parseProfile(form);
  if (!profile || form.get("intent") !== "profile") {
    return data<ActionResult>({ ok: false, notice: t.invalid }, { status: 400 });
  }
  await completeRegistration(env.DB, {
    userId: session.user.id,
    language,
    now: new Date(),
    profile,
  });
  return { ok: true, notice: t.updated } satisfies ActionResult;
}

export default function Profile({ loaderData }: Route.ComponentProps) {
  const { language, account } = loaderData;
  return (
    <AccountShell language={language} account={account} security>
      <ProfilePage account={account} t={appCopy[language]} links={{ language, base: "" }} />
    </AccountShell>
  );
}
