import { StatusIcon } from "~/components/status";
import { SelectItem } from "~/components/ui/select";
import { useCopy } from "~/components/copy-context";

/**
 * Voce di un menu di scelta. Un'opzione del piano Premium resta visibile con la corona e la
 * dicitura, ma non si seleziona.
 */
export function PremiumSelectItem({
  value,
  label,
  premium,
}: {
  value: string;
  label: string;
  premium?: boolean;
}) {
  const { t } = useCopy();
  return (
    <SelectItem value={value} disabled={premium}>
      {label}
      {premium ? (
        <>
          <StatusIcon tone="premium" className="ml-auto" />
          <span className="text-xs">{t.orders.premiumOption}</span>
        </>
      ) : null}
    </SelectItem>
  );
}
