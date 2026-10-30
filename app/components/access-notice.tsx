import { useEffect, useRef } from "react";
import { useLocation } from "react-router";

import { useAction } from "~/components/action";
import { useCopy, useLinks } from "~/components/copy-context";
import { DeleteAccount, type DeletionAccess } from "~/components/delete-account";
import { StatusAlert } from "~/components/status";
import { useTurnstile } from "~/components/turnstile";
import { Button } from "~/components/ui/button";
import type { AccessNoticeView } from "../access-notice";
import { supportEmail } from "../app-copy";
import { accessPath, securityPath } from "../app-links";
import { localizedPath } from "../i18n";
import { turnstileActions } from "../turnstile";

/** Esce e rientra; dalla Sicurezza si torna ai metodi di accesso dopo la nuova autenticazione. */
function SignInAgain() {
  const { t, language } = useCopy();
  const inSecurity = useLocation().pathname === localizedPath(language, securityPath);
  return (
    <form method="post" action={localizedPath(language, inSecurity ? securityPath : accessPath)}>
      {inSecurity ? (
        <input
          type="hidden"
          name="returnTo"
          value={`${localizedPath(language, securityPath)}#security-methods`}
        />
      ) : null}
      <Button
        type="submit"
        variant="outline"
        size="sm"
        name="intent"
        value={inSecurity ? "riautentica" : "esci"}
      >
        {t.access.signOutSignIn}
      </Button>
    </form>
  );
}

/**
 * Email da verificare: nuovo invio del link e, dove la pagina lo prevede, la cancellazione
 * dell'account, che senza email verificata non si raggiunge dalle Impostazioni. Nell'anteprima
 * entrambi rispondono con la simulazione della pagina, senza raggiungere l'accesso reale.
 */
export function VerifyEmail({
  email,
  verified,
  deletion,
}: {
  email: string;
  verified: boolean;
  deletion?: DeletionAccess | null;
}) {
  const { t: copy, language } = useCopy();
  const t = copy.access;
  const { preview } = useLinks();
  const turnstile = useTurnstile(turnstileActions.emailLink);
  const action = useAction();
  const { pathname } = useLocation();
  if (verified) return null;
  return (
    <>
      <StatusAlert tone="warning" title={t.verifyTitle}>
        <p>{t.verifyBody(email)}</p>
        {preview ? (
          <Button
            variant="outline"
            size="sm"
            className="mt-2 w-fit"
            pending={action.pending}
            onClick={() => action.run("verifica")}
          >
            {t.verifyResend}
          </Button>
        ) : (
          <form
            method="post"
            action={localizedPath(language, accessPath)}
            className="mt-2 grid justify-items-start gap-2"
            onSubmit={turnstile.submit}
          >
            {turnstile.field}
            <Button type="submit" variant="outline" size="sm" name="intent" value="verifica">
              {t.verifyResend}
            </Button>
          </form>
        )}
      </StatusAlert>
      {/* La cancellazione è una riga a sé, come in Dati e privacy: l'avviso chiede solo la conferma. */}
      {deletion ? (
        <div className="border-y py-3">
          <DeleteAccount
            email={email}
            access={deletion}
            actionPath={preview ? pathname : localizedPath(language, accessPath)}
          />
        </div>
      ) : null}
    </>
  );
}

/** Esito arrivato nell'indirizzo, mostrato una volta e tolto dall'indirizzo. */
export function AccessNotice({ notice }: { notice: AccessNoticeView | null }) {
  const { t } = useCopy();
  const banner = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (notice) banner.current?.focus();
  }, [notice]);
  // L'esito resta visibile ma esce dall'indirizzo, così una ricarica non lo ripropone, anche
  // quando arriva da un'azione nella stessa pagina. Un link di recupero conserva il token e il
  // proprio errore.
  useEffect(() => {
    const url = new URL(window.location.href);
    const before = url.search;
    url.searchParams.delete("accesso");
    url.searchParams.delete("negozio");
    if (!url.searchParams.has("token")) url.searchParams.delete("error");
    if (url.search !== before) window.history.replaceState(window.history.state, "", url);
  }, [notice]);
  if (!notice) return null;
  const elsewhere = notice.source === "negozio" && notice.key === "altro-spazio";
  const signInAgain =
    notice.source === "accesso" &&
    (notice.key === "nuovo-accesso" || notice.key === "conferma-passkey");
  return (
    <div ref={banner} tabIndex={-1} className="outline-none">
      <StatusAlert
        tone={notice.tone}
        // Il testo dell'esito ripete la spiegazione: qui serve solo il titolo breve.
        title={elsewhere ? t.stores.elsewhereTitle : notice.text}
      >
        {signInAgain ? <SignInAgain /> : null}
        {elsewhere ? (
          <span className="grid gap-2">
            <span>{t.stores.elsewhereBody}</span>
            <a href={`mailto:${supportEmail}`} className="underline underline-offset-4">
              {t.common.contactSupport}: {supportEmail}
            </a>
          </span>
        ) : null}
      </StatusAlert>
    </div>
  );
}
