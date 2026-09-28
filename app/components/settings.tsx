import { cn } from "cn";
import { ChevronLeft, ChevronRight, Moon, Sun, SunMoon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router";

import { useNotice } from "~/components/app-shell";
import { StatusAlert, StatusBadge } from "~/components/status";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Textarea } from "~/components/ui/textarea";
import type { AppCopy } from "../app-copy";
import { appHref, type AppLinks } from "../app-links";
import { localizedPath, type Language } from "../i18n";
import {
  formatDate,
  formatRelative,
  settingsSections,
  type AccountView,
  type DiagnosticsView,
  type SessionView,
  type SettingsSection,
  type StoreView,
} from "../view-models";

export interface SettingsPageData {
  section: SettingsSection | null;
  account: AccountView;
  stores: StoreView[];
  sessions: SessionView[];
  diagnostics: DiagnosticsView;
  telegramChat: string | null;
  exportEstimate: { orders: number; locked: number };
  /** Il primo salvataggio automatico fallisce, per mostrare il ripristino. */
  saveFailsOnce: boolean;
  now: string;
}

type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Salvataggio automatico delle scelte semplici: stato in corso ed esito
 * espliciti, ripristino del valore precedente se il salvataggio fallisce.
 */
function useAutoSave<T>(initial: T, shouldFail: () => boolean) {
  const [value, setValue] = useState(initial);
  const [state, setState] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const change = (next: T) => {
    const previous = value;
    setValue(next);
    setState("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (shouldFail()) {
        setValue(previous);
        setState("error");
        return;
      }
      setState("saved");
      timer.current = setTimeout(() => setState("idle"), 2000);
    }, 600);
  };
  return [value, change, state] as const;
}

function SaveStatus({ state, t }: { state: SaveState; t: AppCopy }) {
  return (
    <span
      role="status"
      className={cn(
        "text-xs",
        state === "error" ? "basis-full text-danger" : "text-muted-foreground",
        state === "idle" && "sr-only",
      )}
    >
      {state === "saving"
        ? t.settings.saving
        : state === "saved"
          ? t.settings.saved
          : state === "error"
            ? t.settings.saveFailed
            : ""}
    </span>
  );
}

function AutoSwitch({
  label,
  description,
  initial,
  shouldFail,
  t,
  disabled,
}: {
  label: string;
  description?: string;
  initial: boolean;
  shouldFail: () => boolean;
  t: AppCopy;
  disabled?: boolean;
}) {
  const id = useId();
  const [checked, setChecked, state] = useAutoSave(initial, shouldFail);
  return (
    <Field orientation="horizontal" className="flex-wrap items-start">
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(next) => setChecked(next)}
        aria-describedby={description ? `${id}-description` : undefined}
      />
      <div className="grid min-w-0 flex-1 gap-1">
        <FieldLabel htmlFor={id} className="font-normal">
          {label}
        </FieldLabel>
        {description ? (
          <FieldDescription id={`${id}-description`}>{description}</FieldDescription>
        ) : null}
      </div>
      <SaveStatus state={state} t={t} />
    </Field>
  );
}

function AutoRadio({
  legend,
  options,
  initial,
  shouldFail,
  t,
}: {
  legend: string;
  options: Array<{ value: string; label: string }>;
  initial: string;
  shouldFail: () => boolean;
  t: AppCopy;
}) {
  const [value, setValue, state] = useAutoSave(initial, shouldFail);
  return (
    <FieldSet>
      <FieldLegend variant="label">{legend}</FieldLegend>
      <RadioGroup value={value} onValueChange={(next) => setValue(String(next))} className="gap-3">
        {options.map((option) => (
          <FieldLabel key={option.value} className="font-normal">
            <RadioGroupItem value={option.value} />
            {option.label}
          </FieldLabel>
        ))}
      </RadioGroup>
      <SaveStatus state={state} t={t} />
    </FieldSet>
  );
}

function SimpleSelect({
  label,
  hint,
  items,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  items: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select items={items} value={value} onValueChange={(next) => onChange(String(next))}>
        <SelectTrigger
          id={id}
          className="w-full min-w-0 sm:max-w-sm"
          aria-describedby={hint ? `${id}-hint` : undefined}
        >
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
      {hint ? <FieldDescription id={`${id}-hint`}>{hint}</FieldDescription> : null}
    </Field>
  );
}

function Group({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className={cn("grid gap-4 border-t pt-6 first:border-t-0 first:pt-0", className)}
    >
      <h3 id={id} className="text-base font-semibold">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Piano Premium in corso: il piano a vita non ha rinnovo né abbonamento da gestire. */
function PremiumPlan({
  account,
  t,
  language,
}: {
  account: AccountView;
  t: AppCopy;
  language: Language;
}) {
  const notify = useNotice();
  const lifetime = account.premium?.period === "lifetime";
  return (
    <Group title={t.settings.currentPlan}>
      <div className="grid gap-1">
        <p className="flex items-center gap-2 text-lg font-semibold">
          {t.settings.premiumPeriod[account.premium?.period ?? "annual"]}
          <StatusBadge tone="premium">{t.settings.premium}</StatusBadge>
        </p>
        {lifetime ? (
          <p className="text-sm text-muted-foreground">{t.settings.premiumLifetime}</p>
        ) : account.premium?.renewsAt ? (
          <p className="text-sm text-muted-foreground">
            {t.settings.premiumRenews(formatDate(account.premium.renewsAt, language, "date"))}
          </p>
        ) : null}
      </div>
      {lifetime ? null : (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => notify(t.preview.simulated)}>
            {t.settings.manageBilling}
          </Button>
        </div>
      )}
      <p className="text-sm text-muted-foreground">{t.settings.billingDocs}</p>
    </Group>
  );
}

function PlanSection({
  data,
  t,
  language,
}: {
  data: SettingsPageData;
  t: AppCopy;
  language: Language;
}) {
  const notify = useNotice();
  const { account } = data;
  const [downgradeStore, setDowngradeStore] = useState(data.stores[0]?.id ?? "");
  if (account.plan === "premium") {
    return (
      <>
        <PremiumPlan account={account} t={t} language={language} />{" "}
        {data.stores.length > 1 ? (
          <Group title={t.settings.downgradeStore}>
            <SimpleSelect
              label={t.settings.downgradeStore}
              hint={t.settings.downgradeStoreHint}
              items={data.stores.map((store) => ({ value: store.id, label: store.name }))}
              value={downgradeStore}
              onChange={setDowngradeStore}
            />
          </Group>
        ) : null}
      </>
    );
  }
  const quota = account.quota;
  return (
    <>
      <Group title={t.settings.currentPlan}>
        <div className="grid gap-1">
          <p className="text-lg font-semibold">{t.settings.free}</p>
          <p className="text-sm text-muted-foreground">{t.settings.freeSummary}</p>
        </div>
        {quota ? (
          <div className="grid max-w-md gap-2">
            <p className="flex justify-between gap-4 text-sm">
              <span>{t.settings.unlocksCycle}</span>
              <span className="font-code">{t.settings.unlocksUsed(quota.used, quota.limit)}</span>
            </p>
            {/* Il valore è già nel testo sopra: la barra è solo visiva. */}
            <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full",
                  quota.used >= quota.limit ? "bg-warning" : "bg-primary",
                )}
                style={{ width: `${Math.min(quota.used / quota.limit, 1) * 100}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {t.settings.cycleEnds(formatDate(quota.cycleEndsAt, language))}
            </p>
          </div>
        ) : null}
      </Group>
      {account.trialAvailable ? (
        <Group title={t.settings.trialTitle}>
          <p className="max-w-xl text-sm leading-relaxed text-pretty text-muted-foreground">
            {t.settings.trialBody}
          </p>
          <Button className="w-fit" onClick={() => notify(t.preview.simulated)}>
            {t.settings.trialAction}
          </Button>
        </Group>
      ) : null}
      <Group title={t.settings.buyTitle}>
        <p className="max-w-xl text-sm leading-relaxed text-pretty text-muted-foreground">
          {t.settings.buyBody}
        </p>
        <ul className="grid gap-3 sm:grid-cols-3">
          {[t.settings.priceMonthly, t.settings.priceAnnual, t.settings.priceLifetime].map(
            (price) => (
              <li key={price} className="grid gap-3 rounded-xl border bg-card p-4">
                <span className="font-code text-base font-semibold">{price}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  onClick={() => notify(t.preview.simulated)}
                >
                  {t.settings.buy}
                </Button>
              </li>
            ),
          )}
        </ul>
        <p className="text-xs text-muted-foreground">{t.settings.pricesNote}</p>
      </Group>
    </>
  );
}

function NotificationsSection({
  data,
  t,
  links,
  shouldFail,
}: {
  data: SettingsPageData;
  t: AppCopy;
  links: AppLinks;
  shouldFail: () => boolean;
}) {
  const notify = useNotice();
  const premium = data.account.plan === "premium";
  const [mode, setMode, modeState] = useAutoSave("each", shouldFail);
  const [digestTime, setDigestTime] = useState("18:00");
  return (
    <>
      <Group title={t.settings.telegramTitle}>
        {!premium ? (
          <StatusAlert tone="premium" title={t.settings.telegramPremium}>
            <Link
              to={appHref(links, "impostazioni/piano")}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {t.settings.buyTitle}
            </Link>
          </StatusAlert>
        ) : (
          <FieldGroup>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm">
              <span className="grid">
                <span className="text-muted-foreground">{t.settings.telegramChat}</span>
                <span className="font-medium">{data.telegramChat}</span>
              </span>
              <Button variant="outline" size="sm" onClick={() => notify(t.preview.simulated)}>
                {t.settings.telegramChange}
              </Button>
            </div>
            <AutoSwitch label={t.settings.telegramEnabled} initial shouldFail={shouldFail} t={t} />
            <AutoRadio
              legend={t.settings.telegramFilter}
              initial="fiscal"
              shouldFail={shouldFail}
              t={t}
              options={[
                { value: "fiscal", label: t.settings.telegramFilterFiscal },
                { value: "all", label: t.settings.telegramFilterAll },
              ]}
            />
            <FieldSet>
              <FieldLegend variant="label">{t.settings.telegramMode}</FieldLegend>
              <RadioGroup
                value={mode}
                onValueChange={(next) => setMode(String(next))}
                className="gap-3"
              >
                <FieldLabel className="font-normal">
                  <RadioGroupItem value="each" />
                  {t.settings.telegramModeEach}
                </FieldLabel>
                <FieldLabel className="font-normal">
                  <RadioGroupItem value="digest" />
                  {t.settings.telegramModeDigest}
                </FieldLabel>
              </RadioGroup>
              <SaveStatus state={modeState} t={t} />
            </FieldSet>
            {mode === "digest" ? (
              <SimpleSelect
                label={t.settings.telegramDigestTime}
                items={["08:00", "12:00", "18:00", "21:00"].map((time) => ({
                  value: time,
                  label: time,
                }))}
                value={digestTime}
                onChange={setDigestTime}
              />
            ) : null}
            <FieldSet>
              <FieldLegend variant="label">{t.settings.telegramStores}</FieldLegend>
              {data.stores.map((store) => (
                <AutoSwitch
                  key={store.id}
                  label={store.name}
                  initial={store.notifications === true}
                  shouldFail={shouldFail}
                  t={t}
                />
              ))}
            </FieldSet>
          </FieldGroup>
        )}
      </Group>
      <Group title={t.settings.marketingTitle}>
        <AutoSwitch
          label={t.settings.marketingConsent}
          description={t.settings.marketingHint}
          initial={false}
          shouldFail={shouldFail}
          t={t}
        />
      </Group>
    </>
  );
}

function ExportSection({ data, t }: { data: SettingsPageData; t: AppCopy }) {
  const notify = useNotice();
  const premium = data.account.plan === "premium";
  const [period, setPeriod] = useState("30");
  const [format, setFormat] = useState("csv");
  const [rows, setRows] = useState("order");
  const columns = Object.entries(t.settings.columns);
  return (
    <>
      <Group title={t.settings.exportScope}>
        <FieldGroup>
          <SimpleSelect
            label={t.settings.exportPeriod}
            items={[
              { value: "7", label: t.orders.last7 },
              { value: "30", label: t.orders.last30 },
              ...(premium ? [{ value: "90", label: t.orders.last90 }] : []),
            ]}
            value={period}
            onChange={setPeriod}
          />
          <FieldSet>
            <FieldLegend variant="label">{t.settings.exportFormat}</FieldLegend>
            <RadioGroup
              value={format}
              onValueChange={(next) => setFormat(String(next))}
              className="gap-3"
            >
              <FieldLabel className="font-normal">
                <RadioGroupItem value="csv" />
                CSV
              </FieldLabel>
              <FieldLabel className="font-normal">
                <RadioGroupItem value="xlsx" disabled={!premium} />
                XLSX
                {premium ? null : (
                  <StatusBadge tone="premium">{t.settings.premiumBadge}</StatusBadge>
                )}
              </FieldLabel>
            </RadioGroup>
          </FieldSet>
          <FieldSet>
            <FieldLegend variant="label">{t.settings.exportRows}</FieldLegend>
            <RadioGroup
              value={rows}
              onValueChange={(next) => setRows(String(next))}
              className="gap-3"
            >
              <FieldLabel className="font-normal">
                <RadioGroupItem value="order" />
                {t.settings.exportRowOrder}
              </FieldLabel>
              <FieldLabel className="font-normal">
                <RadioGroupItem value="item" />
                {t.settings.exportRowItem}
              </FieldLabel>
            </RadioGroup>
          </FieldSet>
          <FieldSet>
            <FieldLegend variant="label">{t.settings.exportColumns}</FieldLegend>
            {premium ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {columns.map(([key, label]) => (
                  <FieldLabel key={key} className="font-normal">
                    <Checkbox defaultChecked />
                    {label}
                  </FieldLabel>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t.settings.exportColumnsPremium}</p>
            )}
          </FieldSet>
        </FieldGroup>
        <p className="text-sm text-muted-foreground" role="status">
          {t.settings.exportPreview(data.exportEstimate.orders, data.exportEstimate.locked)}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => notify(t.settings.exportCreated)}>
            {t.settings.exportCreate}
          </Button>
          {premium ? (
            <Button variant="outline" onClick={() => notify(t.preview.simulated)}>
              {t.settings.exportSaveConfig}
            </Button>
          ) : null}
        </div>
      </Group>
    </>
  );
}

function SecuritySection({
  data,
  t,
  language,
}: {
  data: SettingsPageData;
  t: AppCopy;
  language: Language;
}) {
  const notify = useNotice();
  const methods = [
    {
      id: "password",
      label: t.settings.methodPassword,
      connected: true,
      action: t.settings.changePassword,
    },
    { id: "google", label: t.settings.methodGoogle, connected: true, action: t.settings.remove },
    { id: "ebay", label: t.settings.methodEbay, connected: false, action: t.settings.connect },
  ];
  return (
    <>
      <Group title={t.settings.methods}>
        <ul className="grid divide-y border-y">
          {methods.map((method) => (
            <li key={method.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span className="grid">
                <span className="font-medium">{method.label}</span>
                <span className="text-sm text-muted-foreground">
                  {method.connected ? t.settings.methodConnected : t.settings.methodNotConnected}
                </span>
              </span>
              <Button variant="outline" size="sm" onClick={() => notify(t.preview.simulated)}>
                {method.action}
              </Button>
            </li>
          ))}
          <li className="grid gap-3 py-3">
            <span className="grid">
              <span className="font-medium">{t.settings.methodPasskey}</span>
              <span className="text-sm text-muted-foreground">
                {t.settings.passkeyItem(
                  "MacBook Air",
                  formatDate("2026-09-21T10:12:00Z", language, "date"),
                )}
              </span>
            </span>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => notify(t.preview.simulated)}>
                {t.settings.addPasskey}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => notify(t.preview.simulated)}>
                {t.settings.remove}
              </Button>
            </div>
          </li>
        </ul>
        <p className="text-xs text-muted-foreground">{t.settings.lastMethod}</p>
      </Group>
      <Group title={t.settings.sessions}>
        <ul className="grid divide-y border-y">
          {data.sessions.map((session) => (
            <li key={session.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span className="grid">
                <span className="font-medium">{session.device}</span>
                <span className="text-sm text-muted-foreground">
                  {session.location} ·{" "}
                  {session.current
                    ? t.settings.thisDevice
                    : t.settings.lastActive(
                        formatRelative(session.lastActiveAt, data.now, language),
                      )}
                </span>
              </span>
              {session.current ? null : (
                <Button variant="outline" size="sm" onClick={() => notify(t.preview.simulated)}>
                  {t.settings.signOutSession}
                </Button>
              )}
            </li>
          ))}
        </ul>
        <Button variant="destructive" className="w-fit" onClick={() => notify(t.preview.simulated)}>
          {t.settings.signOutAll}
        </Button>
      </Group>
    </>
  );
}

type Theme = "system" | "light" | "dark";

function AppearanceSection({
  t,
  links,
  shouldFail,
}: {
  t: AppCopy;
  links: AppLinks;
  shouldFail: () => boolean;
}) {
  const location = useLocation();
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document === "undefined"
      ? "system"
      : ((document.documentElement.dataset.theme as Theme | undefined) ?? "system"),
  );
  const [timeZone, setTimeZone, zoneState] = useAutoSave("Europe/Rome", shouldFail);
  const barePath = location.pathname.replace(/^\/en(?=\/|$)/u, "") || "/";
  return (
    <>
      <Group title={t.settings.theme}>
        <RadioGroup
          value={theme}
          onValueChange={(value) => {
            const next = value as Theme;
            setTheme(next);
            const root = document.documentElement;
            if (next === "system") delete root.dataset.theme;
            else root.dataset.theme = next;
          }}
          className="flex flex-wrap gap-5"
          aria-label={t.settings.theme}
        >
          {(
            [
              ["system", t.settings.themeSystem, SunMoon],
              ["light", t.settings.themeLight, Sun],
              ["dark", t.settings.themeDark, Moon],
            ] as const
          ).map(([value, label, Icon]) => (
            <FieldLabel key={value} className="font-normal">
              <RadioGroupItem value={value} />
              <Icon aria-hidden="true" className="size-4" />
              {label}
            </FieldLabel>
          ))}
        </RadioGroup>
        <p className="text-xs text-muted-foreground">{t.settings.themeNote}</p>
      </Group>
      <Group title={t.settings.language}>
        <nav aria-label={t.settings.language} className="flex gap-1">
          {(
            [
              ["it", "Italiano"],
              ["en", "English"],
            ] as const
          ).map(([code, label]) => (
            <Link
              key={code}
              to={localizedPath(code, barePath)}
              lang={code}
              aria-current={links.language === code ? "page" : undefined}
              className="inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring aria-[current=page]:border-transparent aria-[current=page]:bg-secondary pointer-coarse:h-11"
            >
              {label}
            </Link>
          ))}
        </nav>
      </Group>
      <Group title={t.settings.timeZone}>
        <SimpleSelect
          label={t.settings.timeZone}
          hint={t.settings.timeZoneHint}
          items={[
            "Europe/Rome",
            "Europe/London",
            "Europe/Berlin",
            "Europe/Madrid",
            "America/New_York",
          ].map((zone) => ({ value: zone, label: zone.replace("_", " ") }))}
          value={timeZone}
          onChange={setTimeZone}
        />
        <SaveStatus state={zoneState} t={t} />
      </Group>
    </>
  );
}

function TemplateSection({ t }: { t: AppCopy }) {
  const [state, setState] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <Group title={t.settings.sections.messaggio.title} className="border-t-0 pt-0">
      <p className="max-w-2xl text-sm leading-relaxed text-pretty text-muted-foreground">
        {t.settings.templateIntro}
      </p>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setState("saving");
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setState("saved"), 600);
        }}
      >
        <Tabs defaultValue="it">
          <TabsList variant="line">
            <TabsTrigger value="it">{t.settings.templateIt}</TabsTrigger>
            <TabsTrigger value="en">{t.settings.templateEn}</TabsTrigger>
          </TabsList>
          {(
            [
              ["it", t.settings.templateIt, t.settings.templateDefaultIt],
              ["en", t.settings.templateEn, t.settings.templateDefaultEn],
            ] as const
          ).map(([code, label, value]) => (
            <TabsContent key={code} value={code} className="pt-3">
              <Field>
                <FieldLabel htmlFor={`template-${code}`} className="sr-only">
                  {label}
                </FieldLabel>
                <Textarea
                  id={`template-${code}`}
                  name={code}
                  rows={5}
                  defaultValue={value}
                  onChange={() => setState("idle")}
                  aria-describedby="template-hint"
                />
              </Field>
            </TabsContent>
          ))}
        </Tabs>
        <FieldDescription id="template-hint">{t.settings.templateHint}</FieldDescription>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={state === "saving"}>
            {t.settings.save}
          </Button>
          <SaveStatus state={state} t={t} />
        </div>
      </form>
    </Group>
  );
}

function PrivacySection({ t }: { t: AppCopy }) {
  const notify = useNotice();
  const rows = [
    {
      title: t.settings.privacyPolicy,
      body: t.settings.privacyPolicyBody,
      action: t.settings.privacyPolicy,
    },
    {
      title: t.settings.accountExport,
      body: t.settings.accountExportBody,
      action: t.settings.accountExportAction,
    },
  ];
  return (
    <Group title={t.settings.sections.privacy.title} className="border-t-0 pt-0">
      <ul className="grid divide-y border-y">
        {rows.map((row) => (
          <li key={row.title} className="flex flex-wrap items-center justify-between gap-3 py-4">
            <span className="grid max-w-md gap-0.5">
              <span className="font-medium">{row.title}</span>
              <span className="text-sm text-pretty text-muted-foreground">{row.body}</span>
            </span>
            <Button variant="outline" size="sm" onClick={() => notify(t.preview.simulated)}>
              {row.action}
            </Button>
          </li>
        ))}
        <li className="flex flex-wrap items-center justify-between gap-3 py-4">
          <span className="grid max-w-md gap-0.5">
            <span className="font-medium">{t.settings.deleteAccount}</span>
            <span className="text-sm text-pretty text-muted-foreground">
              {t.settings.deleteAccountBody}
            </span>
          </span>
          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="destructive" size="sm" />}>
              {t.settings.deleteAccount}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t.settings.deleteAccountTitle}</AlertDialogTitle>
                <AlertDialogDescription>{t.settings.deleteAccountBody}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t.orders.cancel}</AlertDialogCancel>
                <AlertDialogClose
                  render={<Button variant="destructive-solid" />}
                  onClick={() => notify(t.preview.simulated)}
                >
                  {t.settings.deleteAccountConfirm}
                </AlertDialogClose>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </li>
      </ul>
    </Group>
  );
}

function SupportSection({ data, t }: { data: SettingsPageData; t: AppCopy }) {
  const [topic, setTopic] = useState("orders");
  const [error, setError] = useState(false);
  const [sent, setSent] = useState(false);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const { diagnostics } = data;
  const diag = t.settings.diag;
  const rows = [
    [diag.version, diagnostics.version],
    [diag.store, diagnostics.storeRef ?? diag.none],
    [diag.sync, diagnostics.syncPhase],
    [diag.error, diagnostics.errorCode ?? diag.none],
    [diag.rights, diagnostics.rights],
    [diag.reference, diagnostics.correlationId],
  ] as const;
  return (
    <>
      <Group title={t.settings.faq}>
        <div className="grid divide-y border-t">
          {t.settings.faqItems.map((item) => (
            <details key={item.q} className="group py-3 text-sm">
              <summary className="w-fit cursor-pointer rounded-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring">
                {item.q}
              </summary>
              <p className="mt-2 max-w-2xl leading-relaxed text-pretty text-muted-foreground">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </Group>
      <Group title={t.settings.contact}>
        <form
          noValidate
          className="grid max-w-2xl gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            const message = String(new FormData(event.currentTarget).get("message") ?? "").trim();
            setError(!message);
            setSent(Boolean(message));
            if (!message) messageRef.current?.focus();
          }}
        >
          {error ? <StatusAlert tone="danger" title={t.settings.formErrors} /> : null}
          {sent ? <StatusAlert tone="success" title={t.settings.sent(data.account.email)} /> : null}
          <FieldGroup>
            <SimpleSelect
              label={t.settings.topic}
              items={Object.entries(t.settings.topics).map(([value, label]) => ({ value, label }))}
              value={topic}
              onChange={setTopic}
            />
            <Field data-invalid={error || undefined}>
              <FieldLabel htmlFor="support-message">{t.settings.message}</FieldLabel>
              <Textarea
                ref={messageRef}
                id="support-message"
                name="message"
                rows={5}
                aria-invalid={error || undefined}
                aria-describedby={error ? "support-message-error" : undefined}
              />
              {error ? (
                <FieldError id="support-message-error">{t.settings.messageRequired}</FieldError>
              ) : null}
            </Field>
            <FieldSet>
              <FieldLegend variant="label">{t.settings.diagnostics}</FieldLegend>
              <FieldDescription>{t.settings.diagnosticsHint}</FieldDescription>
              <dl className="grid gap-x-6 gap-y-2 rounded-lg border bg-muted/40 p-3 text-sm sm:grid-cols-[auto_1fr]">
                {rows.map(([label, value]) => (
                  <div key={label} className="contents">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="font-code min-w-0 break-words">{value}</dd>
                  </div>
                ))}
              </dl>
              <FieldLabel className="font-normal">
                <Checkbox name="diagnostics" defaultChecked />
                {t.settings.includeDiagnostics}
              </FieldLabel>
            </FieldSet>
          </FieldGroup>
          <Button type="submit" className="w-fit">
            {t.settings.send}
          </Button>
          <p className="text-sm text-muted-foreground">{t.settings.supportEmail}</p>
        </form>
      </Group>
    </>
  );
}

/** Impostazioni: categorie a sinistra su desktop, elenco e poi pagina su mobile. */
export function SettingsPage({
  data,
  t,
  links,
}: {
  data: SettingsPageData;
  t: AppCopy;
  links: AppLinks;
}) {
  const { language } = links;
  const failPending = useRef(data.saveFailsOnce);
  const shouldFail = () => {
    if (!failPending.current) return false;
    failPending.current = false;
    return true;
  };
  const current = data.section ?? "piano";
  const content = {
    piano: <PlanSection data={data} t={t} language={language} />,
    notifiche: <NotificationsSection data={data} t={t} links={links} shouldFail={shouldFail} />,
    esportazione: <ExportSection data={data} t={t} />,
    sicurezza: <SecuritySection data={data} t={t} language={language} />,
    aspetto: <AppearanceSection t={t} links={links} shouldFail={shouldFail} />,
    messaggio: <TemplateSection t={t} />,
    privacy: <PrivacySection t={t} />,
    supporto: <SupportSection data={data} t={t} />,
  } satisfies Record<SettingsSection, React.ReactNode>;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <h1 className={cn("text-2xl font-bold sm:text-3xl", data.section && "max-md:sr-only")}>
        {t.settings.title}
      </h1>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 md:grid-cols-[15rem_minmax(0,1fr)] md:gap-10">
        <nav aria-label={t.settings.categories} className={cn(data.section && "max-md:hidden")}>
          <ul className="grid divide-y border-y md:gap-1 md:divide-y-0 md:border-y-0">
            {settingsSections.map((id) => (
              <li key={id}>
                <NavLink
                  to={appHref(links, `impostazioni/${id}`)}
                  className={cn(
                    "flex items-center justify-between gap-3 py-3.5 outline-none focus-visible:ring-3 focus-visible:ring-ring md:rounded-lg md:px-3 md:py-2 md:text-sm md:text-muted-foreground md:hover:bg-muted md:hover:text-foreground md:aria-[current=page]:bg-secondary md:aria-[current=page]:font-medium md:aria-[current=page]:text-foreground",
                    !data.section &&
                      id === "piano" &&
                      "md:bg-secondary md:font-medium md:text-foreground",
                  )}
                >
                  <span className="grid gap-0.5">
                    <span className="font-medium md:font-[inherit]">
                      {t.settings.sections[id].title}
                    </span>
                    <span className="text-sm text-muted-foreground md:hidden">
                      {t.settings.sections[id].description}
                    </span>
                  </span>
                  <ChevronRight
                    aria-hidden="true"
                    className="size-4 text-muted-foreground md:hidden"
                  />
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className={cn("grid min-w-0 content-start gap-6", !data.section && "max-md:hidden")}>
          <Link
            to={appHref(links, "impostazioni")}
            className="-ml-1 inline-flex w-fit items-center gap-1 rounded-md py-1 pr-2 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring md:hidden"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
            {t.settings.title}
          </Link>
          <h2 className="text-xl font-semibold">{t.settings.sections[current].title}</h2>
          <div key={current} className="grid gap-6">
            {content[current]}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Profilo dall'avatar: soltanto le informazioni personali minime. */
export function ProfilePage({
  account,
  t,
  links,
}: {
  account: AccountView;
  t: AppCopy;
  links: AppLinks;
}) {
  const notify = useNotice();
  return (
    <div className="grid max-w-xl gap-6">
      <h1 className="text-2xl font-bold sm:text-3xl">{t.profile.title}</h1>
      <form
        className="grid gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          notify(t.profile.saved);
        }}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="profile-name">{t.profile.name}</FieldLabel>
            <Input
              id="profile-name"
              name="name"
              autoComplete="name"
              defaultValue={account.name}
              aria-describedby="profile-name-hint"
            />
            <FieldDescription id="profile-name-hint">{t.profile.nameHint}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="profile-email">{t.profile.email}</FieldLabel>
            <Input
              id="profile-email"
              type="email"
              value={account.email}
              readOnly
              aria-describedby="profile-email-hint"
            />
            <FieldDescription id="profile-email-hint">{t.profile.emailHint}</FieldDescription>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => notify(t.preview.simulated)}
            >
              {t.profile.changeEmail}
            </Button>
          </Field>
        </FieldGroup>
        <Button type="submit" className="w-fit">
          {t.settings.save}
        </Button>
      </form>
      <p className="text-sm text-muted-foreground">
        {t.profile.security}{" "}
        <Link
          to={appHref(links, "impostazioni/sicurezza")}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {t.profile.securityLink}
        </Link>
      </p>
    </div>
  );
}
