import { useId, useState, useSyncExternalStore } from "react";

import { FieldError } from "~/components/ui/field";

export interface ValidationCopy {
  required: string;
  email: string;
  tooShort: (min: number) => string;
  checkbox: string;
}

type Control = HTMLInputElement | HTMLTextAreaElement;

const subscribeNever = () => () => {};

function messageFor(control: Control, copy: ValidationCopy): string {
  const { validity } = control;
  if (validity.valueMissing) {
    return control.type === "checkbox" ? copy.checkbox : copy.required;
  }
  if (validity.typeMismatch) return copy.email;
  if (validity.tooShort && control.minLength > 0) return copy.tooShort(control.minLength);
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
  // Falso sul server e durante l'idratazione, vero nel browser idratato.
  const ready = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  const errorId = (name: string) => `${id}-${name}-error`;

  return {
    form: {
      noValidate: ready,
      /** Riconvalida un campo già segnalato mentre lo si corregge. */
      onInput: (event: React.FormEvent<HTMLFormElement>) => {
        const control = event.target as Control;
        if (!errors[control.name] || !control.validity.valid) return;
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
        if (!control.name || !control.willValidate || control.validity.valid) continue;
        found[control.name] ??= messageFor(control, copy);
        // La checkbox di Base UI ha un input nascosto: il focus va al controllo visibile.
        first ??= control.hasAttribute("aria-hidden")
          ? (control.parentElement?.querySelector<HTMLElement>('[role="checkbox"]') ?? control)
          : control;
      }
      setErrors(found);
      if (!first) return true;
      event.preventDefault();
      first.focus();
      return false;
    },
    /** Attributi del controllo: stato non valido e messaggio collegato. */
    control(name: string, describedBy?: string) {
      const invalid = name in errors;
      return {
        "aria-invalid": invalid || undefined,
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
