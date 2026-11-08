import { useEffect, useRef, useState } from "react";
import { useRouteLoaderData } from "react-router";

import { useCopy, useLinks } from "~/components/copy-context";
import { FieldError } from "~/components/ui/field";
import { turnstileField, turnstileScript, type TurnstileAction } from "../turnstile";

type TurnstileApi = {
  render(container: HTMLElement, options: Record<string, unknown>): string | null | undefined;
  execute(widget: string): void;
  reset(widget: string): void;
  remove(widget: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<TurnstileApi> | null = null;

/** Script del widget, caricato una volta per pagina; un errore di rete permette di riprovare. */
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = turnstileScript;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error()));
    script.onerror = () => {
      script.remove();
      loading = null;
      reject(new Error());
    };
    document.head.appendChild(script);
  });
  return loading;
}

type Waiting = { resolve: (token: string) => void; reject: () => void };

/**
 * Verifica Turnstile di un modulo (§29). Senza `prepare` lo script arriva all'invio e il token
 * nasce subito prima della richiesta; `prepare`, chiamata quando si comincia a compilare, avvia
 * la verifica in anticipo e l'invio usa il token già pronto, o ne chiede uno nuovo se è scaduto.
 * Il widget compare soltanto quando Cloudflare chiede un'interazione. Nell'anteprima, senza
 * chiave del sito, e senza azione non c'è verifica.
 */
export function useTurnstile(action: TurnstileAction | null) {
  const root = useRouteLoaderData<{ turnstileSiteKey?: string }>("root");
  const { preview } = useLinks();
  const siteKey = preview || !action ? undefined : root?.turnstileSiteKey;
  const { t, language } = useCopy();
  const container = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const widget = useRef<string | null>(null);
  const waiting = useRef<Waiting | null>(null);
  // Verifica in corso, condivisa fra anticipo e invio, e token pronto non ancora usato.
  const pending = useRef<Promise<string | null> | null>(null);
  const ready = useRef<string | null>(null);
  const claiming = useRef(false);
  const [failed, setFailed] = useState(false);
  // Senza interazione il widget resta fuori dal flusso del modulo, che non cambia spaziatura.
  const [interactive, setInteractive] = useState(false);

  useEffect(() => {
    if (!siteKey) return;
    return () => {
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
      waiting.current?.reject();
      waiting.current = null;
    };
  }, [siteKey]);

  /** Verifica in corso o nuova; null se non è riuscita. */
  function verify(): Promise<string | null> {
    pending.current ??= run().finally(() => {
      pending.current = null;
    });
    return pending.current;
  }

  /** Token per un invio, usato una volta sola: quello anticipato o uno nuovo. */
  async function token(): Promise<string | null> {
    // Un secondo invio mentre il primo attende la verifica non ne riusa il token.
    if (claiming.current) return null;
    claiming.current = true;
    setFailed(false);
    try {
      const value = ready.current ?? (await verify());
      ready.current = null;
      // L'errore compare all'invio: una verifica anticipata fallita non disturba chi compila.
      if (!value) setFailed(true);
      return value;
    } finally {
      claiming.current = false;
    }
  }

  async function run(): Promise<string | null> {
    try {
      const api = await loadTurnstile();
      return await new Promise<string>((resolve, reject) => {
        waiting.current = { resolve, reject };
        const settle = (value: string | null) => {
          const current = waiting.current;
          waiting.current = null;
          if (value) current?.resolve(value);
          else current?.reject();
        };
        if (widget.current) {
          api.reset(widget.current);
        } else {
          widget.current =
            api.render(container.current!, {
              sitekey: siteKey,
              action,
              language,
              execution: "execute",
              appearance: "interaction-only",
              "response-field": false,
              "refresh-expired": "manual",
              callback: (value: string) => settle(value),
              "error-callback": () => {
                settle(null);
                return true;
              },
              "timeout-callback": () => settle(null),
              "expired-callback": () => {
                ready.current = null;
              },
              "unsupported-callback": () => settle(null),
              "before-interactive-callback": () => setInteractive(true),
              "after-interactive-callback": () => setInteractive(false),
            }) ?? null;
        }
        if (!widget.current) return settle(null);
        api.execute(widget.current);
      });
    } catch {
      return null;
    }
  }

  return {
    enabled: Boolean(siteKey),
    /** Token per un invio fatto dal codice; stringa vuota senza verifica. */
    token: async () => (siteKey ? token() : ""),
    /** Avvia la verifica prima dell'invio; senza effetto se un token è già pronto o in arrivo. */
    prepare() {
      if (!siteKey || ready.current || pending.current) return;
      void verify().then((value) => {
        // Arrivato mentre un invio lo attende: è già suo.
        if (!claiming.current) ready.current = value;
      });
    },
    /**
     * Invio di un modulo nativo, da chiamare in `onSubmit` dopo la convalida: ferma l'invio,
     * scrive il token nel modulo e lo ripete con lo stesso pulsante.
     */
    submit(event: React.FormEvent<HTMLFormElement>) {
      if (!siteKey || event.defaultPrevented) return;
      const field = input.current;
      if (field?.value) return;
      event.preventDefault();
      if (!field) return;
      const form = event.currentTarget;
      const submitter = (event.nativeEvent as SubmitEvent).submitter;
      void token().then((value) => {
        if (!value) return;
        // Con il token già pronto siamo ancora dentro l'evento di invio, che ignorerebbe il nuovo.
        setTimeout(() => {
          field.value = value;
          form.requestSubmit(submitter);
          // Il token è già nei dati inviati: tornando indietro la pagina ne chiede uno nuovo.
          field.value = "";
        });
      });
    },
    field: siteKey ? (
      <>
        <input ref={input} type="hidden" name={turnstileField} defaultValue="" />
        <div
          ref={container}
          className={interactive ? "contents" : "absolute size-0 overflow-hidden"}
        />
        {failed ? <FieldError>{t.access.signInNotices["verifica-non-riuscita"]}</FieldError> : null}
      </>
    ) : null,
  };
}
