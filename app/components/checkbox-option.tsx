import { useId } from "react";

import { Checkbox } from "~/components/ui/checkbox";
import { FieldLabel } from "~/components/ui/field";

/**
 * Casella con nome accessibile già nell'HTML del server: Base UI collega la `<label>` esterna
 * soltanto dopo l'idratazione.
 */
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
