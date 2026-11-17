import { useId } from "react";

import { useCopy } from "~/components/copy-context";
import { Field, FieldLabel, FieldLegend, FieldSet } from "~/components/ui/field";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";

import { appCopy } from "../app-copy";
import type { EbayEnvironment } from "../view-models";

const environments: readonly EbayEnvironment[] = ["production", "sandbox"];

/**
 * Scelta dell'ambiente eBay, sul solo dominio di test: nome dell'ambiente e tipo di account. Con
 * due sole opzioni restano entrambe visibili.
 */
export function EbayEnvironmentField({
  className,
  onValueChange,
  ...group
}: {
  className?: string;
  name?: string;
  defaultValue?: EbayEnvironment;
  value?: EbayEnvironment;
  onValueChange?: (value: EbayEnvironment) => void;
}) {
  const { language } = useCopy();
  const t = appCopy[language].storeLink;
  const id = useId();
  return (
    <FieldSet className={className}>
      <FieldLegend id={`${id}-legend`} variant="label">
        {t.environment}
      </FieldLegend>
      <RadioGroup
        aria-labelledby={`${id}-legend`}
        {...group}
        onValueChange={onValueChange && ((next) => onValueChange(next as EbayEnvironment))}
      >
        {environments.map((environment) => (
          <Field key={environment} orientation="horizontal">
            <RadioGroupItem value={environment} id={`${id}-${environment}`} />
            <FieldLabel htmlFor={`${id}-${environment}`} className="flex-wrap font-normal">
              <span>{t[environment].name}</span>
              <span className="text-muted-foreground">{t[environment].detail}</span>
            </FieldLabel>
          </Field>
        ))}
      </RadioGroup>
    </FieldSet>
  );
}
