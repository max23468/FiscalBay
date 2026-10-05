import { Field, FieldLabel } from "~/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { appCopy } from "../app-copy";
import type { Language } from "../i18n";

const environments = ["production", "sandbox"] as const;

export type EbayEnvironment = (typeof environments)[number];

/** Scelta dell'ambiente eBay, sul solo dominio di test: nome dell'ambiente e tipo di account. */
export function EbayEnvironmentField({
  language,
  className,
  onValueChange,
  ...select
}: {
  language: Language;
  className?: string;
  name?: string;
  defaultValue?: EbayEnvironment;
  value?: EbayEnvironment;
  onValueChange?: (value: EbayEnvironment) => void;
}) {
  const t = appCopy[language].storeLink;
  const items = environments.map((environment) => ({
    value: environment,
    label: (
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="shrink-0">{t[environment].name}</span>
        <span className="truncate text-muted-foreground">{t[environment].detail}</span>
      </span>
    ),
  }));
  return (
    <Field className={className}>
      <FieldLabel htmlFor="ebay-environment">{t.environment}</FieldLabel>
      <Select
        items={items}
        {...select}
        onValueChange={onValueChange && ((next) => onValueChange(next as EbayEnvironment))}
      >
        <SelectTrigger id="ebay-environment" className="w-full min-w-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
