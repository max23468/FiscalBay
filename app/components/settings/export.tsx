import { ArrowDown, ArrowUp } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Link, useRevalidator } from "react-router";

import { useAction, useNotice } from "~/components/action";
import { PremiumNote, StatusBadge } from "~/components/status";
import { Button } from "~/components/ui/button";
import { FieldGroup, FieldLabel, FieldLegend, FieldSet } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { RadioGroup } from "~/components/ui/radio-group";
import { useCopy, useLinks } from "~/components/copy-context";
import { useTimeZone } from "~/components/time-zone";
import { exportFilePath, orderExportPath } from "../../app-links";
import { formatDate } from "../../format";
import { localizedPath } from "../../i18n";
import type { ExportFileView } from "../../domain/export-jobs.server";
import { downloadExport, saveFile } from "./download";
import type { AppCopy } from "../../copy/copy-it";
import type { ExportConfiguration } from "../../domain/export-configurations.server";
import {
  columnName,
  fileColumns,
  layoutOf,
  maxConfigurationName,
  standardColumns,
  type ExportColumn,
  type ExportFormat,
  type FileLayout,
} from "../../orders/export-columns";
import type { ExportContext, ExportTally } from "../../orders/export-scope";
import { orderPeriods, premiumOrderPeriods, type OrderPeriod } from "../../view-models";
import { CheckboxOption, Group, RadioOption, SimpleSelect } from "./controls";

/** Valore della scelta «Standard» fra le configurazioni salvate. */
const standardChoice = "";

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

/**
 * Crea il file nell'area reale: il modulo invia ambito e opzioni e il browser salva la risposta.
 * Con JavaScript la richiesta resta nella pagina, così un rifiuto diventa un avviso e un file
 * preparato dalla coda compare fra i file creati; senza, l'invio ordinario scarica il file o
 * torna alla sezione.
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
  const revalidator = useRevalidator();
  const [pending, setPending] = useState(false);
  const download = async (form: HTMLFormElement) => {
    setPending(true);
    try {
      const response = await fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: {
          accept:
            "text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/json",
        },
      });
      if (!response.ok || response.status === 202) {
        const result = (await response.json().catch(() => null)) as { notice?: string } | null;
        notify(result?.notice ?? t.settings.export.exportFailed);
        // Il lavoro accodato compare fra i file creati, in preparazione.
        if (response.status === 202) void revalidator.revalidate();
        return;
      }
      await saveFile(response);
      // Il file resta fra quelli creati, scaricabile di nuovo finché vale.
      void revalidator.revalidate();
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
      <Button type="submit" disabled={disabled} pending={pending}>
        {t.settings.export.exportCreate}
      </Button>
    </form>
  );
}

/** «Crea file»: nell'anteprima la risposta è simulata, nell'area reale il file si scarica. */
function CreateFile({
  context,
  fields,
  disabled,
}: {
  context: ExportContext | null;
  fields: Record<string, string>;
  disabled: boolean;
}) {
  const { t } = useCopy();
  const { preview } = useLinks();
  const action = useAction();
  if (!preview) return <CreateFileForm context={context} fields={fields} disabled={disabled} />;
  return (
    <Button
      disabled={disabled}
      onClick={() =>
        action.run("export-create", { ...fields, ...(context ? { scope: context.query } : {}) })
      }
    >
      {t.settings.export.exportCreate}
    </Button>
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
  value: ExportFormat;
  onChange: (value: ExportFormat) => void;
}) {
  const { t } = useCopy();
  return (
    <FieldSet>
      <FieldLegend variant="label">{t.settings.export.exportFormat}</FieldLegend>
      <RadioGroup
        value={value}
        onValueChange={(next) => onChange(next === "xlsx" ? "xlsx" : "csv")}
        className="gap-3"
      >
        <RadioOption value="csv">CSV</RadioOption>
        <RadioOption value="xlsx" disabled={!premium}>
          XLSX
          {premium ? null : <StatusBadge tone="premium">{t.settings.premiumBadge}</StatusBadge>}
        </RadioOption>
      </RadioGroup>
    </FieldSet>
  );
}

/**
 * Colonne scelte e ordinate con Premium: ogni colonna si include e si sposta con i pulsanti,
 * e lo spostamento è annunciato. Nel Free soltanto la nota del piano.
 */
function ColumnsField({
  premium,
  layout,
  onChange,
}: {
  premium: boolean;
  layout: FileLayout;
  onChange: (layout: FileLayout) => void;
}) {
  const { t } = useCopy();
  const copy = t.settings.export;
  const [moved, setMoved] = useState("");
  if (!premium)
    return (
      <FieldSet>
        <FieldLegend variant="label">{copy.exportColumns}</FieldLegend>
        <PremiumNote>{copy.exportColumnsPremium}</PremiumNote>
      </FieldSet>
    );
  const available = new Set(standardColumns(layout.rows));
  const visible = layout.order.filter((column) => available.has(column));
  const chosen = new Set(layout.chosen);
  const name = (column: ExportColumn) => columnName(column, layout.rows, t);
  const move = (column: ExportColumn, step: -1 | 1) => {
    const index = visible.indexOf(column);
    const other = visible[index + step];
    if (!other) return;
    const order = layout.order.map((current) =>
      current === column ? other : current === other ? column : current,
    );
    onChange({ ...layout, order });
    setMoved(copy.exportColumnMoved(name(column), index + step + 1, visible.length));
  };
  return (
    <FieldSet>
      <FieldLegend variant="label">{copy.exportColumns}</FieldLegend>
      <ol className="grid max-h-96 gap-1 overflow-y-auto rounded-lg border p-2">
        {visible.map((column, index) => (
          <li key={column} className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <CheckboxOption
                checked={chosen.has(column)}
                onCheckedChange={(checked) =>
                  onChange({
                    ...layout,
                    chosen: checked
                      ? [...layout.chosen, column]
                      : layout.chosen.filter((current) => current !== column),
                  })
                }
              >
                {name(column)}
              </CheckboxOption>
            </div>
            {/* Agli estremi il pulsante resta raggiungibile: disattivarlo sposterebbe il focus. */}
            <Button
              variant="ghost"
              size="icon-sm"
              className="aria-disabled:opacity-40"
              aria-label={copy.exportMoveUp(name(column))}
              aria-disabled={index === 0 || undefined}
              onClick={() => move(column, -1)}
            >
              <ArrowUp aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="aria-disabled:opacity-40"
              aria-label={copy.exportMoveDown(name(column))}
              aria-disabled={index === visible.length - 1 || undefined}
              onClick={() => move(column, 1)}
            >
              <ArrowDown aria-hidden />
            </Button>
          </li>
        ))}
      </ol>
      <p role="status" className="sr-only">
        {moved}
      </p>
    </FieldSet>
  );
}

/**
 * Salvataggio della forma corrente con un nome: un nome già usato sostituisce quella
 * configurazione. Annullando, il focus torna a «Salva configurazione».
 */
function SaveConfiguration({
  name,
  layout,
  onSaved,
  children,
}: {
  name: string;
  layout: FileLayout;
  onSaved: (name: string) => void;
  /** Comandi accanto a «Salva configurazione», nascosti mentre si scrive il nome. */
  children?: React.ReactNode;
}) {
  const { t } = useCopy();
  const copy = t.settings.export;
  const id = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(name);
  const trigger = useRef<HTMLButtonElement>(null);
  const action = useAction((result) => {
    if (!result.ok) return;
    setOpen(false);
    onSaved(draft.trim());
  });
  const columns = fileColumns(layout);
  if (!open)
    return (
      <>
        <Button
          ref={trigger}
          variant="outline"
          disabled={columns.length === 0}
          onClick={() => {
            setDraft(name);
            setOpen(true);
          }}
        >
          {copy.exportSaveConfig}
        </Button>
        {children}
      </>
    );
  return (
    <form
      className="grid basis-full justify-items-start gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        action.run("export-save", {
          name: draft.trim(),
          format: layout.format,
          rows: layout.rows,
          columns: columns.join(","),
        });
      }}
    >
      <FieldLabel htmlFor={id}>{copy.exportConfigName}</FieldLabel>
      <Input
        id={id}
        value={draft}
        required
        maxLength={maxConfigurationName}
        className="sm:max-w-sm"
        autoFocus
        onChange={(event) => setDraft(event.currentTarget.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={!draft.trim()} pending={action.pending}>
          {action.pending ? t.common.saving : t.common.save}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setOpen(false);
            requestAnimationFrame(() => trigger.current?.focus());
          }}
        >
          {t.common.cancel}
        </Button>
      </div>
    </form>
  );
}

/** Configurazione salvata, formato, granularità e colonne del file. */
function LayoutFields({
  premium,
  configurations,
  configuration,
  layout,
  onChange,
  onChoose,
}: {
  premium: boolean;
  configurations: ExportConfiguration[];
  configuration: ExportConfiguration | null;
  layout: FileLayout;
  onChange: (layout: FileLayout) => void;
  onChoose: (name: string) => void;
}) {
  const copy = useCopy().t.settings.export;
  return (
    <>
      {premium && configurations.length ? (
        <SimpleSelect
          label={copy.exportConfiguration}
          items={[
            { value: standardChoice, label: copy.exportConfigurationStandard },
            ...configurations.map((current) => ({ value: current.name, label: current.name })),
          ]}
          value={configuration?.name ?? standardChoice}
          onChange={onChoose}
        />
      ) : null}
      <FormatField
        premium={premium}
        value={layout.format}
        onChange={(format) => onChange({ ...layout, format })}
      />
      <FieldSet>
        <FieldLegend variant="label">{copy.exportRows}</FieldLegend>
        <RadioGroup
          value={layout.rows}
          onValueChange={(next) =>
            onChange({ ...layout, rows: next === "item" ? "item" : "order" })
          }
          className="gap-3"
        >
          <RadioOption value="order">{copy.exportRowOrder}</RadioOption>
          <RadioOption value="item">{copy.exportRowItem}</RadioOption>
        </RadioGroup>
      </FieldSet>
      <ColumnsField premium={premium} layout={layout} onChange={onChange} />
    </>
  );
}

/** Salvataggio della forma corrente ed eliminazione della configurazione scelta. */
function ConfigurationCommands({
  configuration,
  layout,
  onSelect,
}: {
  configuration: ExportConfiguration | null;
  layout: FileLayout;
  onSelect: (name: string | null) => void;
}) {
  const copy = useCopy().t.settings.export;
  const remove = useAction((result) => {
    if (result.ok) onSelect(null);
  });
  return (
    <SaveConfiguration
      key={configuration?.name ?? standardChoice}
      name={configuration?.name ?? ""}
      layout={layout}
      onSaved={onSelect}
    >
      {configuration ? (
        <Button
          variant="destructive"
          pending={remove.pending}
          onClick={() => remove.run("export-delete", { id: configuration.id })}
        >
          {copy.exportConfigDelete}
        </Button>
      ) : null}
    </SaveConfiguration>
  );
}

/**
 * File creati nelle ultime 24 ore e ancora validi, lavori in preparazione e non riusciti. Il
 * download passa dal percorso autenticato, che ricontrolla sessione e validità.
 */
function ExportFiles({ files }: { files: ExportFileView[] }) {
  const { t, language } = useCopy();
  const { links, preview } = useLinks();
  const zone = useTimeZone();
  const action = useAction();
  const notify = useNotice();
  const revalidator = useRevalidator();
  // Il file si salva soltanto quando è arrivato intero; un file non più disponibile diventa
  // un avviso e l'elenco si rilegge.
  const download = async (href: string) => {
    try {
      const notice = await downloadExport(href);
      if (notice === null) return;
      notify(notice || copy.exportGone);
      void revalidator.revalidate();
    } catch {
      notify(copy.exportFailed);
    }
  };
  const copy = t.settings.export;
  if (files.length === 0) return null;
  return (
    <Group title={copy.exportFiles}>
      <ul className="grid divide-y border-t">
        {files.map((file) => (
          <li key={file.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <span className="grid min-w-0 flex-1 gap-0.5">
              <span className="font-medium break-all">{file.name}</span>
              <span className="text-sm text-muted-foreground">
                {file.state === "ready"
                  ? copy.exportFileReady(formatDate(file.expiresAt!, language, "dateTime", zone))
                  : file.state === "queued"
                    ? copy.exportFileQueued
                    : copy.exportFileFailed}
              </span>
            </span>
            {file.state === "ready" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  preview
                    ? action.run("export-download")
                    : void download(localizedPath(links.language, exportFilePath(file.id)))
                }
              >
                {copy.exportDownload}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </Group>
  );
}

export function ExportSection({
  premium,
  configurations,
  context,
  periods,
  files,
}: {
  premium: boolean;
  /** Configurazioni salvate; valgono soltanto con Premium. */
  configurations: ExportConfiguration[];
  context: ExportContext | null;
  /** Ordini di ogni periodo, quando l'esportazione non viene dagli Ordini. */
  periods: Record<OrderPeriod, ExportTally> | null;
  files: ExportFileView[];
}) {
  const { t, language } = useCopy();
  const copy = t.settings.export;
  const [period, setPeriod] = useState<OrderPeriod>("30");
  const [fiscal, setFiscal] = useState("all");
  const [layout, setLayout] = useState(() => layoutOf(null));
  // Configurazione scelta, per nome: dopo un salvataggio la rilettura la ritrova.
  const [selected, setSelected] = useState<string | null>(null);
  const configuration = premium
    ? (configurations.find((current) => current.name === selected) ?? null)
    : null;
  const tally = context?.estimate ?? periods?.[period] ?? { orders: 0, locked: 0, available: 0 };
  const status = exportStatus(t, tally, fiscal === "available", context !== null);
  const columns = fileColumns(layout);
  // Il file standard nel Free; con Premium formato e colonne scelti.
  const fields: Record<string, string> = {
    language,
    rows: layout.rows,
    fiscal,
    ...(premium ? { format: layout.format, columns: columns.join(",") } : {}),
    ...(context ? {} : { period }),
  };
  const choose = (name: string) => {
    const next = configurations.find((current) => current.name === name) ?? null;
    setSelected(next?.name ?? null);
    setLayout(layoutOf(next));
  };
  return (
    <>
      {/* In testa, dove arriva la notifica di un file pronto; la sezione chiude con il testo. */}
      <ExportFiles files={files} />
      <Group title={copy.exportScope}>
        {context ? <ExportContextNote context={context} /> : null}
        <FieldGroup>
          {/* Con l'ambito degli Ordini il periodo è già nei loro filtri. */}
          {context ? null : (
            <SimpleSelect
              label={copy.exportPeriod}
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
            <FieldLegend variant="label">{copy.exportFiscal}</FieldLegend>
            <RadioGroup
              value={fiscal}
              onValueChange={(next) => setFiscal(String(next))}
              className="gap-3"
            >
              <RadioOption value="all">{copy.exportFiscalAll}</RadioOption>
              <RadioOption value="available">{copy.exportFiscalAvailable}</RadioOption>
            </RadioGroup>
          </FieldSet>
          <LayoutFields
            premium={premium}
            configurations={configurations}
            configuration={configuration}
            layout={layout}
            onChange={setLayout}
            onChoose={choose}
          />
        </FieldGroup>
        <p className="text-sm text-muted-foreground" role="status">
          {columns.length === 0 ? copy.exportColumnsInvalid : status.text}
        </p>
        <div className="flex flex-wrap items-start gap-2">
          {/* Il file nasce soltanto da qui: nessuno sblocco e nessun download prima. */}
          <CreateFile
            context={context}
            fields={fields}
            disabled={status.orders === 0 || columns.length === 0}
          />
          {premium ? (
            <ConfigurationCommands
              configuration={configuration}
              layout={layout}
              onSelect={setSelected}
            />
          ) : null}
        </div>
        {/* Le istruzioni seguono il file; l'ultimo elemento della sezione non è un comando. */}
        <p className="text-sm text-muted-foreground">
          {premium && layout.format === "xlsx" ? copy.exportXlsxHint : copy.exportTextHint}
        </p>
      </Group>
    </>
  );
}
