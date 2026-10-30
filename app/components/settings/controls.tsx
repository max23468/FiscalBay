import { cn } from "cn";
import { useEffect, useId, useState } from "react";

import { useAction } from "~/components/action";
import { useHydrated } from "~/components/hydrated";
import { StatusIcon } from "~/components/status";
import { Checkbox } from "~/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from "~/components/ui/field";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { useCopy } from "~/components/copy-context";

export type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Salvataggio automatico delle scelte semplici tramite l'azione `save`: stato in
 * corso ed esito espliciti, ripristino dell'ultimo valore salvato se il server rifiuta.
 */
export function useAutoSave<T extends string | boolean>(name: string, initial: T) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [outcome, setOutcome] = useState<"idle" | "saved" | "error">("idle");
  const action = useAction((result) => {
    if (result.ok) {
      setSaved(value);
      setOutcome("saved");
    } else {
      setValue(saved);
      setOutcome("error");
    }
  });
  useEffect(() => {
    if (outcome !== "saved") return;
    const timer = setTimeout(() => setOutcome("idle"), 2000);
    return () => clearTimeout(timer);
  }, [outcome]);
  const change = (next: T) => {
    setValue(next);
    setOutcome("idle");
    action.run("save", { name, value: String(next) });
  };
  const state: SaveState = action.pending ? "saving" : outcome;
  return [value, change, state] as const;
}

/**
 * Esito del salvataggio automatico in una riga sempre riservata: comparire e sparire non
 * sposta il testo intorno. Con `inline` sta accanto al titolo del gruppo, senza riga propria.
 */
export function SaveStatus({ state, inline = false }: { state: SaveState; inline?: boolean }) {
  const { t } = useCopy();
  return (
    <span
      role="status"
      className={cn(
        inline ? "text-xs" : "block min-h-4 text-xs leading-4",
        state === "error" ? "text-danger" : "text-muted-foreground",
      )}
    >
      {state === "saving"
        ? t.common.saving
        : state === "saved"
          ? t.settings.saved
          : state === "error"
            ? t.settings.saveFailed
            : ""}
    </span>
  );
}

export function AutoSwitch({
  name,
  label,
  description,
  initial,
  disabled,
}: {
  name: string;
  label: string;
  description?: string;
  initial: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  const [checked, setChecked, state] = useAutoSave(name, initial);
  const ready = useHydrated();
  return (
    <Field orientation="horizontal" className="items-start">
      <Switch
        id={id}
        checked={checked}
        disabled={!ready || disabled || state === "saving"}
        onCheckedChange={(next) => setChecked(next)}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-description` : undefined}
      />
      <div className="grid min-w-0 flex-1 gap-1">
        <FieldLabel id={`${id}-label`} htmlFor={id} className="font-normal">
          {label}
        </FieldLabel>
        {description ? (
          <FieldDescription id={`${id}-description`}>{description}</FieldDescription>
        ) : null}
        <SaveStatus state={state} />
      </div>
    </Field>
  );
}

export function AutoRadio({
  name,
  legend,
  options,
  initial,
  disabled,
}: {
  name: string;
  legend: string;
  options: Array<{ value: string; label: string }>;
  initial: string;
  disabled?: boolean;
}) {
  const [value, setValue, state] = useAutoSave(name, initial);
  return (
    <FieldSet>
      <FieldLegend variant="label">{legend}</FieldLegend>
      <RadioGroup
        disabled={disabled || state === "saving"}
        value={value}
        onValueChange={(next) => setValue(String(next))}
        className="gap-3"
      >
        {options.map((option) => (
          <RadioOption key={option.value} value={option.value}>
            {option.label}
          </RadioOption>
        ))}
      </RadioGroup>
      <SaveStatus state={state} />
    </FieldSet>
  );
}

/**
 * Opzioni con nome accessibile già nell'HTML del server: Base UI collega la `<label>`
 * esterna soltanto dopo l'idratazione.
 */
export function RadioOption({
  value,
  disabled,
  children,
}: {
  value: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <FieldLabel
      id={id}
      className="font-normal has-data-disabled:cursor-not-allowed has-data-disabled:text-muted-foreground"
    >
      <RadioGroupItem value={value} disabled={disabled} aria-labelledby={id} />
      {children}
    </FieldLabel>
  );
}

export function CheckboxOption({
  name,
  defaultChecked,
  checked,
  onCheckedChange,
  children,
}: {
  name?: string;
  defaultChecked?: boolean;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <FieldLabel id={id} className="font-normal">
      <Checkbox
        name={name}
        defaultChecked={defaultChecked}
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-labelledby={id}
      />
      {children}
    </FieldLabel>
  );
}

export function SimpleSelect({
  label,
  status,
  hint,
  items,
  value,
  premiumLabel,
  onChange,
  disabled,
}: {
  label: string;
  /** Esito del salvataggio automatico, accanto all'etichetta. */
  status?: SaveState;
  hint?: string;
  /** `premium`: opzione del piano Premium, visibile con la corona ma non selezionabile. */
  items: Array<{ value: string; label: string; premium?: boolean }>;
  value: string;
  premiumLabel?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <Field>
      {/* L'esito sta accanto all'etichetta, fuori dal nome del campo. */}
      <div className="flex flex-wrap items-baseline gap-x-2">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {status ? <SaveStatus state={status} inline /> : null}
      </div>
      <Select
        disabled={disabled}
        items={items}
        value={value}
        onValueChange={(next) => onChange(String(next))}
      >
        <SelectTrigger
          id={id}
          className="w-full min-w-0 sm:max-w-sm"
          aria-describedby={hint ? `${id}-hint` : undefined}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value} disabled={item.premium}>
              {item.label}
              {item.premium ? (
                <>
                  <StatusIcon tone="premium" className="ml-auto" />
                  <span className="sr-only">{premiumLabel}</span>
                </>
              ) : null}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint ? <FieldDescription id={`${id}-hint`}>{hint}</FieldDescription> : null}
    </Field>
  );
}

export function Group({
  id: anchor,
  title,
  status,
  children,
  className,
  separated = true,
}: {
  /** Identificativo del titolo, quando un collegamento porta al gruppo. */
  id?: string;
  title?: string;
  /** Esito del salvataggio automatico, sulla riga del titolo. */
  status?: SaveState;
  children: React.ReactNode;
  className?: string;
  /** Linea sopra il gruppo; senza, quando il gruppo precedente finisce già con una linea. */
  separated?: boolean;
}) {
  const generated = useId();
  const id = anchor ?? generated;
  return (
    <section
      aria-labelledby={title ? id : undefined}
      className={cn(
        "grid gap-4",
        separated && "border-t pt-6 first:border-t-0 first:pt-0",
        className,
      )}
    >
      {title && status ? (
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h3 id={id} className="text-base font-semibold">
            {title}
          </h3>
          <SaveStatus state={status} inline />
        </div>
      ) : title ? (
        <h3 id={id} className="text-base font-semibold">
          {title}
        </h3>
      ) : null}
      {children}
    </section>
  );
}
