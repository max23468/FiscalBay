import { useState } from "react";
import { Link } from "react-router";

import { useAction } from "~/components/action";
import { PremiumNote, StatusBadge } from "~/components/status";
import { Button } from "~/components/ui/button";
import { FieldGroup, FieldLegend, FieldSet } from "~/components/ui/field";
import { RadioGroup } from "~/components/ui/radio-group";
import { useCopy } from "~/components/copy-context";
import { orderPeriods, premiumOrderPeriods } from "../../view-models";
import { CheckboxOption, Group, RadioOption, SimpleSelect } from "./controls";

/** Selezione, singolo ordine o elenco filtrato degli Ordini, da esportare così com'è. */
export interface ExportContext {
  kind: "orders" | "filtered";
  /** Numero eBay quando l'ambito è un solo ordine. */
  order: string | null;
  /** L'elenco ha filtri o una ricerca attivi. */
  filtered: boolean;
  /** Torna all'elenco degli Ordini con lo stesso contesto. */
  returnHref: string;
  /** Ambito trasmesso alla creazione del file, nella forma dell'indirizzo. */
  query: string;
}

/** Ambito ricevuto dagli Ordini, sempre esplicito, con il ritorno all'elenco di partenza. */
function ExportContextNote({ context }: { context: ExportContext }) {
  const { t } = useCopy();
  return (
    <div className="grid justify-items-start gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
      <p>
        {context.order
          ? t.settings.export.exportContextOrder(context.order)
          : context.kind === "orders"
            ? t.settings.export.exportContextSelection
            : context.filtered
              ? t.settings.export.exportContextFiltered
              : t.settings.export.exportContextAll}
      </p>
      <Link to={context.returnHref} className="underline underline-offset-4">
        {t.settings.export.exportContextBack}
      </Link>
    </div>
  );
}

export function ExportSection({
  premium,
  context,
  estimate,
}: {
  premium: boolean;
  context: ExportContext | null;
  /** Ordini dell'esportazione e quanti fra loro hanno un dato ancora da sbloccare. */
  estimate: { orders: number; locked: number };
}) {
  const { t } = useCopy();
  const action = useAction();
  const [period, setPeriod] = useState("30");
  const [format, setFormat] = useState("csv");
  const [rows, setRows] = useState("order");
  const columns = Object.entries(t.settings.export.columns);
  // Colonne del file, tutte all'inizio: la scelta viaggia con la richiesta dell'esportazione.
  const [chosen, setChosen] = useState(() => new Set(columns.map(([key]) => key)));
  const choose = (key: string, checked: boolean) =>
    setChosen((current) => {
      const next = new Set(current);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  const { orders, locked } = estimate;
  return (
    <>
      <Group title={t.settings.export.exportScope}>
        {context ? <ExportContextNote context={context} /> : null}
        <FieldGroup>
          {/* Con l'ambito degli Ordini il periodo è già nei loro filtri. */}
          {context ? null : (
            <SimpleSelect
              label={t.settings.export.exportPeriod}
              items={orderPeriods.map((period) => ({
                value: period,
                label: t.orders.periods[period],
                premium: !premium && premiumOrderPeriods.has(period),
              }))}
              value={period}
              premiumLabel={t.orders.premiumOption}
              onChange={setPeriod}
            />
          )}
          <FieldSet>
            <FieldLegend variant="label">{t.settings.export.exportFormat}</FieldLegend>
            <RadioGroup
              value={format}
              onValueChange={(next) => setFormat(String(next))}
              className="gap-3"
            >
              <RadioOption value="csv">CSV</RadioOption>
              <RadioOption value="xlsx" disabled={!premium}>
                XLSX
                {premium ? null : (
                  <StatusBadge tone="premium">{t.settings.premiumBadge}</StatusBadge>
                )}
              </RadioOption>
            </RadioGroup>
          </FieldSet>
          <FieldSet>
            <FieldLegend variant="label">{t.settings.export.exportRows}</FieldLegend>
            <RadioGroup
              value={rows}
              onValueChange={(next) => setRows(String(next))}
              className="gap-3"
            >
              <RadioOption value="order">{t.settings.export.exportRowOrder}</RadioOption>
              <RadioOption value="item">{t.settings.export.exportRowItem}</RadioOption>
            </RadioGroup>
          </FieldSet>
          <FieldSet>
            <FieldLegend variant="label">{t.settings.export.exportColumns}</FieldLegend>
            {premium ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {columns.map(([key, label]) => (
                  <CheckboxOption
                    key={key}
                    checked={chosen.has(key)}
                    onCheckedChange={(checked) => choose(key, checked)}
                  >
                    {label}
                  </CheckboxOption>
                ))}
              </div>
            ) : (
              <PremiumNote>{t.settings.export.exportColumnsPremium}</PremiumNote>
            )}
          </FieldSet>
        </FieldGroup>
        <p className="text-sm text-muted-foreground" role="status">
          {context
            ? t.settings.export.exportCount(orders, locked)
            : t.settings.export.exportPreview(orders, locked)}
        </p>
        <div className="flex flex-wrap gap-2">
          {/* Il file nasce soltanto da qui: nessuno sblocco e nessun download prima. */}
          <Button
            disabled={context !== null && orders === 0}
            onClick={() =>
              action.run("export-create", {
                ...(context ? { scope: context.query } : { period }),
                format,
                rows,
                ...(premium ? { columns: [...chosen].join(",") } : {}),
              })
            }
          >
            {t.settings.export.exportCreate}
          </Button>
          {premium ? (
            <Button variant="outline" onClick={() => action.run("export-save")}>
              {t.settings.export.exportSaveConfig}
            </Button>
          ) : null}
        </div>
      </Group>
    </>
  );
}
