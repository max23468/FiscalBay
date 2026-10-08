import { env } from "cloudflare:workers";
import { data, isRouteErrorResponse } from "react-router";

import { AccountShell } from "~/components/account";
import { ProfilePage } from "~/components/settings";
import { assertSameOrigin, requireAccountArea } from "../account-area.server";
import { appCopy } from "../app-copy";
import { appBase } from "../app-links";
import { completeRegistration, parseProfile } from "../domain/registration.server";
import { languageFromPath } from "../i18n";
import type { ActionResult } from "../view-models";
import { logFailure } from "../errors";
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
  const { language, profile, account, session } = await requireAccountArea(request);
  return { language, userId: session.user.id, account: { ...account, profile } };
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
  try {
    await completeRegistration(env.DB, {
      userId: session.user.id,
      language,
      now: new Date(),
      profile,
    });
  } catch (error) {
    logFailure({ request, error, operation: "route" });
    return data<ActionResult>(
      { ok: false, notice: appCopy[language].errors.unexpected },
      { status: 500 },
    );
  }
  return { ok: true, notice: t.updated } satisfies ActionResult;
}

/** Un'interruzione di rete non cancella la bozza né conferma l'esito remoto. */
export async function clientAction({ request, serverAction }: Route.ClientActionArgs) {
  try {
    return await serverAction();
  } catch (error) {
    if (error instanceof Response || isRouteErrorResponse(error) || request.signal.aborted)
      throw error;
    const language = languageFromPath(new URL(request.url).pathname);
    return { ok: false, notice: appCopy[language].errors.unconfirmed } satisfies ActionResult;
  }
}

export default function Profile({ loaderData }: Route.ComponentProps) {
  const { language, account } = loaderData;
  return (
    <AccountShell key={loaderData.userId} language={language} account={account} security>
      <ProfilePage account={account} t={appCopy[language]} links={{ language, base: appBase }} />
    </AccountShell>
  );
}
