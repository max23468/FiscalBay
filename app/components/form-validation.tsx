import { useId, useState } from "react";

import { useHydrated } from "~/components/hydrated";
import { FieldError } from "~/components/ui/field";

interface ValidationCopy {
  required: string;
  email: string;
  tooShort: (min: number) => string;
  checkbox: string;
}

type Control = HTMLInputElement | HTMLTextAreaElement;

/**
 * Testo più corto del minimo. Il browser lo segnala soltanto dopo una modifica dell'utente e
 * Safari lo dimentica quando il campo cambia tipo, come con «Mostra password»: la lunghezza si
 * controlla anche qui.
 */
function tooShort(control: Control) {
  const length = control.value.length;
  return (
    control.validity.tooShort || (control.minLength > 0 && length > 0 && length < control.minLength)
  );
}

const invalid = (control: Control) => !control.validity.valid || tooShort(control);

function messageFor(control: Control, copy: ValidationCopy): string {
  const { validity } = control;
  if (validity.valueMissing) {
    return control.type === "checkbox" ? copy.checkbox : copy.required;
  }
  if (validity.typeMismatch) return copy.email;
  if (tooShort(control)) return copy.tooShort(control.minLength);
  return control.validationMessage;
}

/**
 * Errori dei campi accanto al campo, al posto del fumetto del browser: valgono i
 * vincoli HTML (`required`, `type`, `minLength`). Il fumetto si disattiva solo
 * dopo l'idratazione, così senza JavaScript resta la validazione nativa.
 */
export function useFieldErrors(copy: ValidationCopy) {
  const id = useId();
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Dopo il primo invio ogni campo è stato validato: lo stato vale «true» o «false».
  const [validated, setValidated] = useState(false);
  const ready = useHydrated();
  const errorId = (name: string) => `${id}-${name}-error`;

  return {
    ready,
    form: {
      noValidate: ready,
      /** Riconvalida un campo già segnalato mentre lo si corregge. */
      onInput: (event: React.FormEvent<HTMLFormElement>) => {
        const control = event.target as Control;
        if (!errors[control.name] || invalid(control)) return;
        const { [control.name]: _, ...rest } = errors;
        setErrors(rest);
      },
    },
    /** Da chiamare all'invio: con errori ferma l'invio e porta il focus sul primo campo. */
    check(event: React.FormEvent<HTMLFormElement>): boolean {
      const found: Record<string, string> = {};
      let first: HTMLElement | null = null;
      for (const element of event.currentTarget.elements) {
        const control = element as Control;
        if (!control.name || !control.willValidate || !invalid(control)) continue;
        found[control.name] ??= messageFor(control, copy);
        // La checkbox di Base UI ha un input nascosto: il focus va al controllo visibile.
        first ??= control.hasAttribute("aria-hidden")
          ? (control.parentElement?.querySelector<HTMLElement>('[role="checkbox"]') ?? control)
          : control;
      }
      setErrors(found);
      setValidated(true);
      if (!first) return true;
      event.preventDefault();
      first.focus();
      return false;
    },
    /** Errore deciso dopo i vincoli HTML, per esempio da un controllo remoto: focus sul campo. */
    reject(control: Control, message: string) {
      setErrors((current) => ({ ...current, [control.name]: message }));
      setValidated(true);
      control.focus();
    },
    /**
     * Attributi del controllo: stato di validità, esplicito dopo la prima validazione, e
     * messaggio collegato. Il focus sul campo annuncia l'errore tramite la descrizione.
     */
    control(name: string, describedBy?: string) {
      const invalid = name in errors;
      return {
        "aria-invalid": invalid ? true : validated ? false : undefined,
        "aria-describedby":
          [describedBy, invalid ? errorId(name) : undefined].filter(Boolean).join(" ") || undefined,
      };
    },
    error(name: string) {
      return errors[name] ? <FieldError id={errorId(name)}>{errors[name]}</FieldError> : null;
    },
  };
}

export type FieldErrors = ReturnType<typeof useFieldErrors>;
