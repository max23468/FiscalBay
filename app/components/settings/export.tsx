import { useState } from "react";
import { Link } from "react-router";

import { useAction, useNotice } from "~/components/action";
import { PremiumNote, StatusBadge } from "~/components/status";
import { Button } from "~/components/ui/button";
import { FieldGroup, FieldLegend, FieldSet } from "~/components/ui/field";
import { RadioGroup } from "~/components/ui/radio-group";
import { useCopy, useLinks } from "~/components/copy-context";
import { orderExportPath } from "../../app-links";
import type { AppCopy } from "../../copy/copy-it";
import type { ExportContext, ExportTally } from "../../orders/export-scope";
import { orderPeriods, premiumOrderPeriods, type OrderPeriod } from "../../view-models";
import { CheckboxOption, Group, RadioOption, SimpleSelect } from "./controls";

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

/** Nome del file proposto dal server, senza dati personali. */
function fileName(response: Response) {
  return /filename="([^"]+)"/u.exec(response.headers.get("content-disposition") ?? "")?.[1];
}

/**
 * Crea il file nell'area reale: il modulo invia ambito e opzioni e il browser salva la risposta.
 * Con JavaScript la richiesta resta nella pagina, così un rifiuto diventa un avviso; senza,
 * l'invio ordinario scarica il file o torna alla sezione.
 */
function CreateFileForm({
  context,
  fields,
  disabled,
}: {
  context: ExportContext | null;
  fields: Record<string, string>;
  disabled: boolean;
}) {
  const { t } = useCopy();
  const notify = useNotice();
  const [pending, setPending] = useState(false);
  const download = async (form: HTMLFormElement) => {
    setPending(true);
    try {
      const response = await fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { accept: "text/csv, application/json" },
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { notice?: string } | null;
        notify(result?.notice ?? t.settings.export.exportFailed);
        return;
      }
      // Il file arriva intero prima del salvataggio: un flusso interrotto non diventa un file.
      const href = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = href;
      link.download = fileName(response) ?? "fiscalbay.csv";
      link.click();
      // Safari legge l'oggetto dopo il clic: si libera più tardi.
      setTimeout(() => URL.revokeObjectURL(href), 60_000);
    } catch {
      notify(t.settings.export.exportFailed);
    } finally {
      setPending(false);
    }
  };
  return (
    <form
      method="post"
      action={context ? `${orderExportPath}?${context.query}` : orderExportPath}
      onSubmit={(event) => {
        event.preventDefault();
        void download(event.currentTarget);
      }}
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Button type="submit" disabled={disabled || pending}>
        {t.settings.export.exportCreate}
      </Button>
    </form>
  );
}

/** Ordini del file con le scelte correnti, oppure perché non ce ne sono. */
function exportStatus(
  t: AppCopy,
  tally: ExportTally,
  available: boolean,
  scoped: boolean,
): { orders: number; text: string } {
  const copy = t.settings.export;
  const orders = available ? tally.available : tally.orders;
  if (orders > 0) return { orders, text: copy.exportCount(orders, available ? 0 : tally.locked) };
  if (available && tally.orders > 0) return { orders, text: copy.exportNone.available };
  return { orders, text: scoped ? copy.exportNone.scope : copy.exportNone.period };
}

/** Formato del file: XLSX soltanto con Premium. */
function FormatField({
  premium,
  value,
  onChange,
}: {
  premium: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useCopy();
  return (
    <FieldSet>
      <FieldLegend variant="label">{t.settings.export.exportFormat}</FieldLegend>
      <RadioGroup value={value} onValueChange={(next) => onChange(String(next))} className="gap-3">
        <RadioOption value="csv">CSV</RadioOption>
        <RadioOption value="xlsx" disabled={!premium}>
          XLSX
          {premium ? null : <StatusBadge tone="premium">{t.settings.premiumBadge}</StatusBadge>}
        </RadioOption>
      </RadioGroup>
    </FieldSet>
  );
}

/** Colonne scelte con Premium; nel Free soltanto la nota del piano. */
function ColumnsField({
  premium,
  chosen,
  onChoose,
}: {
  premium: boolean;
  chosen: ReadonlySet<string>;
  onChoose: (key: string, checked: boolean) => void;
}) {
  const { t } = useCopy();
  return (
    <FieldSet>
      <FieldLegend variant="label">{t.settings.export.exportColumns}</FieldLegend>
      {premium ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(t.settings.export.columns).map(([key, label]) => (
            <CheckboxOption
              key={key}
              checked={chosen.has(key)}
              onCheckedChange={(checked) => onChoose(key, checked)}
            >
              {label}
            </CheckboxOption>
          ))}
        </div>
      ) : (
        <PremiumNote>{t.settings.export.exportColumnsPremium}</PremiumNote>
      )}
    </FieldSet>
  );
}

export function ExportSection({
  premium,
  advanced,
  context,
  periods,
}: {
  premium: boolean;
  /** XLSX, colonne scelte e configurazioni salvate; senza il servizio non compaiono. */
  advanced: boolean;
  context: ExportContext | null;
  /** Ordini di ogni periodo, quando l'esportazione non viene dagli Ordini. */
  periods: Record<OrderPeriod, ExportTally> | null;
}) {
  const { t, language } = useCopy();
  const { preview } = useLinks();
  const action = useAction();
  const [period, setPeriod] = useState<OrderPeriod>("30");
  const [format, setFormat] = useState("csv");
  const [rows, setRows] = useState("order");
  const [fiscal, setFiscal] = useState("all");
  // Colonne del file, tutte all'inizio: la scelta viaggia con la richiesta dell'esportazione.
  const [chosen, setChosen] = useState(() => new Set(Object.keys(t.settings.export.columns)));
  const choose = (key: string, checked: boolean) =>
    setChosen((current) => {
      const next = new Set(current);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  const tally = context?.estimate ?? periods?.[period] ?? { orders: 0, locked: 0, available: 0 };
  const status = exportStatus(t, tally, fiscal === "available", context !== null);
  const orders = status.orders;
  const fields = {
    language,
    rows,
    fiscal,
    ...(context ? {} : { period }),
  };
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
              onChange={(next) => setPeriod(next as OrderPeriod)}
            />
          )}
          <FieldSet>
            <FieldLegend variant="label">{t.settings.export.exportFiscal}</FieldLegend>
            <RadioGroup
              value={fiscal}
              onValueChange={(next) => setFiscal(String(next))}
              className="gap-3"
            >
              <RadioOption value="all">{t.settings.export.exportFiscalAll}</RadioOption>
              <RadioOption value="available">{t.settings.export.exportFiscalAvailable}</RadioOption>
            </RadioGroup>
          </FieldSet>
          {advanced ? <FormatField premium={premium} value={format} onChange={setFormat} /> : null}
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
          {advanced ? <ColumnsField premium={premium} chosen={chosen} onChoose={choose} /> : null}
        </FieldGroup>
        <p className="text-sm text-muted-foreground" role="status">
          {status.text}
        </p>
        <div className="flex flex-wrap gap-2">
          {/* Il file nasce soltanto da qui: nessuno sblocco e nessun download prima. */}
          {preview ? (
            <Button
              disabled={orders === 0}
              onClick={() =>
                action.run("export-create", {
                  ...(context ? { scope: context.query } : { period }),
                  format,
                  rows,
                  fiscal,
                  ...(premium ? { columns: [...chosen].join(",") } : {}),
                })
              }
            >
              {t.settings.export.exportCreate}
            </Button>
          ) : (
            <CreateFileForm context={context} fields={fields} disabled={orders === 0} />
          )}
          {advanced && premium ? (
            <Button variant="outline" onClick={() => action.run("export-save")}>
              {t.settings.export.exportSaveConfig}
            </Button>
          ) : null}
        </div>
        {/* Le istruzioni seguono il file; l'ultimo elemento della sezione non è un comando. */}
        <p className="text-sm text-muted-foreground">{t.settings.export.exportTextHint}</p>
      </Group>
    </>
  );
}
