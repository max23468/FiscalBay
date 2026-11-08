import { useRef } from "react";

import { leakedPasswordField, passwordCheckPath } from "../../app-links";

/**
 * Controllo delle password trapelate prima dell'invio: il browser manda la password in JSON al
 * Worker, dove l'edge di Cloudflare la confronta con le violazioni note. Una password nuova
 * trapelata ferma l'invio con `onLeaked`; senza `onLeaked`, all'accesso, l'invio prosegue con
 * il campo nascosto. `prepare`, all'uscita dal campo, avvia il controllo prima dell'invio, che
 * ne usa l'esito. Senza JavaScript, o se il controllo non risponde, l'invio procede.
 */
export function usePasswordCheck(onLeaked?: (input: HTMLInputElement) => void) {
  // Password già controllata: il nuovo invio, anche dopo Turnstile, non la ricontrolla.
  const checked = useRef<string | null>(null);
  const flag = useRef<HTMLInputElement>(null);
  // Ultimo controllo avviato, con la sua password: l'invio lo riusa se il campo non è cambiato.
  const last = useRef<{ password: string; leaked: Promise<boolean> } | null>(null);
  const check = (password: string) => {
    if (last.current?.password !== password)
      last.current = { password, leaked: isLeaked(password) };
    return last.current.leaked;
  };
  return {
    prepare(event: React.FocusEvent<HTMLFormElement>) {
      const input = event.target;
      if (input instanceof HTMLInputElement && input.name === "password" && input.value) {
        void check(input.value);
      }
    },
    submit(event: React.FormEvent<HTMLFormElement>) {
      if (event.defaultPrevented) return;
      const form = event.currentTarget;
      const input = form.elements.namedItem("password");
      if (!(input instanceof HTMLInputElement) || !input.value) return;
      if (checked.current === input.value) return;
      event.preventDefault();
      const submitter = (event.nativeEvent as SubmitEvent).submitter;
      const password = input.value;
      void check(password).then((leaked) => {
        // Password cambiata durante il controllo: vale l'invio successivo, con la sua.
        if (input.value !== password) return;
        if (leaked && onLeaked) return onLeaked(input);
        if (flag.current) flag.current.value = leaked ? "1" : "";
        checked.current = password;
        // Con l'esito già pronto siamo ancora dentro l'evento di invio, che ignorerebbe il nuovo.
        setTimeout(() => form.requestSubmit(submitter));
      });
    },
    field: onLeaked ? null : (
      <input ref={flag} type="hidden" name={leakedPasswordField} defaultValue="" />
    ),
  };
}

async function isLeaked(password: string): Promise<boolean> {
  try {
    // Il rilevamento riconosce una password soltanto accanto a un nome utente: questo è fisso,
    // così l'email non parte e l'esito riguarda la sola password.
    const response = await fetch(passwordCheckPath, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "fiscalbay", password }),
    });
    if (!response.ok) return false;
    return ((await response.json()) as { leaked?: unknown }).leaked === true;
  } catch {
    return false;
  }
}
