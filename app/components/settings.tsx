import { cn } from "cn";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Database,
  FileSpreadsheet,
  LifeBuoy,
  Mail,
  MessageSquareText,
  Moon,
  Palette,
  Settings,
  ShieldCheck,
  Sun,
  SunMoon,
  User,
} from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";

import { useAction } from "~/components/app-shell";
import { IconTile, InitialsTile, PageTitle } from "~/components/icon-tile";
import { PremiumNote, StatusAlert, StatusBadge, StatusIcon } from "~/components/status";
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
import { buttonVariants } from "~/components/ui/button-variants";
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
  type ActionResult,
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
  now: string;
}

type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Salvataggio automatico delle scelte semplici tramite l'azione `save`: stato in
 * corso ed esito espliciti, ripristino dell'ultimo valore salvato se il server rifiuta.
 */
function useAutoSave<T extends string | boolean>(name: string, initial: T) {
  const action = useAction();
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [outcome, setOutcome] = useState<"idle" | "saved" | "error">("idle");
  const [handled, setHandled] = useState<ActionResult>();
  if (action.result && action.result !== handled) {
    setHandled(action.result);
    if (action.result.ok) {
      setSaved(value);
      setOutcome("saved");
    } else {
      setValue(saved);
      setOutcome("error");
    }
  }
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
  name,
  label,
  description,
  initial,
  t,
  disabled,
}: {
  name: string;
  label: string;
  description?: string;
  initial: boolean;
  t: AppCopy;
  disabled?: boolean;
}) {
  const id = useId();
  const [checked, setChecked, state] = useAutoSave(name, initial);
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
  name,
  legend,
  options,
  initial,
  t,
}: {
  name: string;
  legend: string;
  options: Array<{ value: string; label: string }>;
  initial: string;
  t: AppCopy;
}) {
  const [value, setValue, state] = useAutoSave(name, initial);
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
  premiumLabel,
  onChange,
}: {
  label: string;
  hint?: string;
  /** `premium`: opzione del piano Premium, visibile con la corona ma non selezionabile. */
  items: Array<{ value: string; label: string; premium?: boolean }>;
  value: string;
  premiumLabel?: string;
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

function Group({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={title ? id : undefined}
      className={cn("grid gap-4 border-t pt-6 first:border-t-0 first:pt-0", className)}
    >
      {title ? (
        <h3 id={id} className="text-base font-semibold">
          {title}
        </h3>
      ) : null}
      {children}
    </section>
  );
}

/** Il lifetime conserva l'accesso ai documenti senza presentare un rinnovo. */
function PremiumPlan({
  account,
  t,
  language,
}: {
  account: AccountView;
  t: AppCopy;
  language: Language;
}) {
  const action = useAction();
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
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={() => action.run("manage-billing")}>
          {lifetime ? t.settings.billingDocuments : t.settings.manageBilling}
        </Button>
      </div>
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
  const action = useAction();
  const { account } = data;
  const [downgradeStore, setDowngradeStore] = useState(data.stores[0]?.id ?? "");
  if (account.plan === "premium") {
    return (
      <>
        <PremiumPlan account={account} t={t} language={language} />
        {data.stores.length > 1 && account.premium?.period !== "lifetime" ? (
          <Group>
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
          <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
            {t.settings.trialBody}
          </p>
          <Button className="w-fit" onClick={() => action.run("start-trial")}>
            {t.settings.trialAction}
          </Button>
        </Group>
      ) : null}
      <Group title={t.settings.buyTitle}>
        <PremiumNote>{t.settings.buyBody}</PremiumNote>
        <ul className="grid gap-3 sm:grid-cols-3">
          {[
            { plan: "monthly", price: t.settings.priceMonthly, note: t.settings.priceMonthlyNote },
            { plan: "annual", price: t.settings.priceAnnual, note: t.settings.priceAnnualNote },
            {
              plan: "lifetime",
              price: t.settings.priceLifetime,
              note: t.settings.priceLifetimeNote,
            },
          ].map(({ plan, price, note }) => (
            <li
              key={price}
              className="grid grid-rows-[1fr_auto] gap-3 rounded-xl border bg-card p-4"
            >
              <span className="grid gap-1">
                <span className="font-code text-base font-semibold">{price}</span>
                <span className="text-sm text-muted-foreground">{note}</span>
              </span>
              <Button
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => action.run("buy", { plan })}
              >
                {t.settings.buy}
              </Button>
            </li>
          ))}
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
}: {
  data: SettingsPageData;
  t: AppCopy;
  links: AppLinks;
}) {
  const action = useAction();
  const premium = data.account.plan === "premium";
  const [mode, setMode, modeState] = useAutoSave<string>("telegram-mode", "each");
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
              <Button variant="outline" size="sm" onClick={() => action.run("telegram-change")}>
                {t.settings.telegramChange}
              </Button>
            </div>
            <AutoSwitch name="telegram" label={t.settings.telegramEnabled} initial t={t} />
            <AutoRadio
              name="telegram-filter"
              legend={t.settings.telegramFilter}
              initial="fiscal"
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
                  name={`store-notifications:${store.id}`}
                  label={store.name}
                  initial={store.notifications === true}
                  t={t}
                />
              ))}
            </FieldSet>
          </FieldGroup>
        )}
      </Group>
      <Group title={t.settings.marketingTitle}>
        <AutoSwitch
          name="marketing"
          label={t.settings.marketingConsent}
          description={t.settings.marketingHint}
          initial={false}
          t={t}
        />
      </Group>
    </>
  );
}

function ExportSection({ data, t }: { data: SettingsPageData; t: AppCopy }) {
  const action = useAction();
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
              { value: "90", label: t.orders.last90, premium: !premium },
            ]}
            value={period}
            premiumLabel={t.orders.premiumOption}
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
              <PremiumNote>{t.settings.exportColumnsPremium}</PremiumNote>
            )}
          </FieldSet>
        </FieldGroup>
        <p className="text-sm text-muted-foreground" role="status">
          {t.settings.exportPreview(data.exportEstimate.orders, data.exportEstimate.locked)}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => action.run("export-create", { period, format, rows })}>
            {t.settings.exportCreate}
          </Button>
          {premium ? (
            <Button variant="outline" onClick={() => action.run("export-save")}>
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
  const action = useAction();
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => action.run("sign-in-method", { method: method.id })}
              >
                {method.action}
              </Button>
            </li>
          ))}
          <li className="flex flex-wrap items-center justify-between gap-3 py-3">
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
              <Button variant="outline" size="sm" onClick={() => action.run("passkey-remove")}>
                {t.settings.remove}
              </Button>
              <Button variant="outline" size="sm" onClick={() => action.run("passkey-add")}>
                {t.settings.addPasskey}
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => action.run("session-sign-out", { session: session.id })}
                >
                  {t.settings.signOutSession}
                </Button>
              )}
            </li>
          ))}
        </ul>
        <Button variant="destructive" className="w-fit" onClick={() => action.run("sign-out-all")}>
          {t.settings.signOutAll}
        </Button>
      </Group>
    </>
  );
}

type Theme = "system" | "light" | "dark";

function AppearanceSection({ t, links }: { t: AppCopy; links: AppLinks }) {
  const location = useLocation();
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document === "undefined"
      ? "system"
      : ((document.documentElement.dataset.theme as Theme | undefined) ?? "system"),
  );
  const [timeZone, setTimeZone, zoneState] = useAutoSave<string>("time-zone", "Europe/Rome");
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
              preventScrollReset
              lang={code}
              aria-current={links.language === code ? "page" : undefined}
              className="inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring aria-[current=page]:border-transparent aria-[current=page]:bg-secondary pointer-coarse:h-11"
            >
              {label}
            </Link>
          ))}
        </nav>
      </Group>
      <Group>
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
  const action = useAction();
  const [dirty, setDirty] = useState(false);
  const state: SaveState = action.pending
    ? "saving"
    : dirty || !action.result
      ? "idle"
      : action.result.ok
        ? "saved"
        : "error";
  return (
    <div className="grid gap-4">
      <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
        {t.settings.templateIntro}
      </p>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setDirty(false);
          action.run("template", { it: String(form.get("it")), en: String(form.get("en")) });
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
                  onChange={() => setDirty(true)}
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
    </div>
  );
}

function PrivacySection({ t }: { t: AppCopy }) {
  const action = useAction();
  const rows = [
    {
      intent: "privacy-policy",
      title: t.settings.privacyPolicy,
      body: t.settings.privacyPolicyBody,
      action: t.settings.privacyPolicy,
    },
    {
      intent: "account-export",
      title: t.settings.accountExport,
      body: t.settings.accountExportBody,
      action: t.settings.accountExportAction,
    },
  ];
  return (
    <div className="grid gap-4">
      <ul className="grid divide-y border-y">
        {rows.map((row) => (
          <li key={row.title} className="flex flex-wrap items-center justify-between gap-3 py-4">
            <span className="grid min-w-0 flex-1 gap-0.5">
              <span className="font-medium">{row.title}</span>
              <span className="text-sm text-pretty text-muted-foreground">{row.body}</span>
            </span>
            <Button variant="outline" size="sm" onClick={() => action.run(row.intent)}>
              {row.action}
            </Button>
          </li>
        ))}
        <li className="flex flex-wrap items-center justify-between gap-3 py-4">
          <span className="grid min-w-0 flex-1 gap-0.5">
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
                  onClick={() => action.run("account-delete")}
                >
                  {t.settings.deleteAccountConfirm}
                </AlertDialogClose>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </li>
      </ul>
    </div>
  );
}

function SupportSection({ data, t }: { data: SettingsPageData; t: AppCopy }) {
  const action = useAction();
  const [topic, setTopic] = useState("orders");
  const [error, setError] = useState(false);
  const sent = !error && action.result?.ok === true;
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
              <p className="mt-2 leading-relaxed text-pretty text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </Group>
      <Group title={t.settings.contact} className="scroll-mt-20">
        <form
          noValidate
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const message = String(form.get("message") ?? "").trim();
            setError(!message);
            if (!message) {
              messageRef.current?.focus({ preventScroll: true });
              event.currentTarget.parentElement?.scrollIntoView({ block: "start" });
              return;
            }
            action.run("support", {
              topic,
              message,
              diagnostics: String(form.get("diagnostics") === "on"),
            });
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

/** Icone neutre: le Impostazioni restano sobrie, il colore sta in Ordini e Negozi. */
const sectionIcons: Record<SettingsSection, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  piano: CreditCard,
  notifiche: Bell,
  esportazione: FileSpreadsheet,
  sicurezza: ShieldCheck,
  aspetto: Palette,
  messaggio: MessageSquareText,
  privacy: Database,
  supporto: LifeBuoy,
};

/** Da 768 px tutte le categorie stanno in una pagina che scorre. */
const wideQuery = "(min-width: 48rem)";

/** Distanza dal bordo superiore oltre la quale una sezione diventa quella attiva. */
const spyOffset = 140;

/**
 * Impostazioni. Su desktop le categorie formano una sola pagina che scorre:
 * il menu resta fisso e l'indicatore segue la sezione visibile. Su mobile
 * restano elenco e poi pagina della singola categoria.
 */
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
  const current = data.section ?? "piano";
  const content = {
    piano: <PlanSection data={data} t={t} language={language} />,
    notifiche: <NotificationsSection data={data} t={t} links={links} />,
    esportazione: <ExportSection data={data} t={t} />,
    sicurezza: <SecuritySection data={data} t={t} language={language} />,
    aspetto: <AppearanceSection t={t} links={links} />,
    messaggio: <TemplateSection t={t} />,
    privacy: <PrivacySection t={t} />,
    supporto: <SupportSection data={data} t={t} />,
  } satisfies Record<SettingsSection, React.ReactNode>;
  const sections = useRef<Partial<Record<SettingsSection, HTMLElement | null>>>({});
  const items = useRef<Partial<Record<SettingsSection, HTMLElement | null>>>({});
  const [active, setActive] = useState<SettingsSection>(current);
  const [indicator, setIndicator] = useState<{ top: number; height: number } | null>(null);
  // Durante lo scorrimento avviato dal menu l'indicatore resta sulla voce scelta.
  const following = useRef(false);
  const release = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Usa solo riferimenti e setter stabili: vale anche nell'effetto di apertura.
  const goTo = (id: SettingsSection, behavior: ScrollBehavior) => {
    if (!window.matchMedia(wideQuery).matches) return;
    setActive(id);
    following.current = true;
    clearTimeout(release.current);
    const done = () => {
      following.current = false;
      window.removeEventListener("scrollend", done);
    };
    window.addEventListener("scrollend", done);
    release.current = setTimeout(done, 1000);
    sections.current[id]?.scrollIntoView({ behavior, block: "start" });
  };

  const spy = () => {
    if (following.current || !window.matchMedia(wideQuery).matches) return;
    let next: SettingsSection = settingsSections[0];
    for (const id of settingsSections) {
      const top = sections.current[id]?.getBoundingClientRect().top ?? Infinity;
      if (top <= spyOffset) next = id;
    }
    const atBottom =
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    setActive(atBottom ? settingsSections[settingsSections.length - 1] : next);
  };

  useEffect(() => {
    // Dopo il ripristino dello scroll della route, riallinea anche il cambio lingua.
    const frame = requestAnimationFrame(() => {
      if (data.section) goTo(data.section, "instant");
      else spy();
    });
    window.addEventListener("scroll", spy, { passive: true });
    return () => {
      window.removeEventListener("scroll", spy);
      cancelAnimationFrame(frame);
      clearTimeout(release.current);
    };
    // Apertura e cambio lingua; i clic fra categorie scorrono dal menu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  useLayoutEffect(() => {
    const item = items.current[active];
    if (item) setIndicator({ top: item.offsetTop, height: item.offsetHeight });
  }, [active, language]);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <PageTitle icon={Settings} tone="neutral" className={cn(data.section && "max-md:sr-only")}>
        {t.settings.title}
      </PageTitle>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 md:grid-cols-[15rem_minmax(0,1fr)] md:gap-10">
        <nav
          aria-label={t.settings.categories}
          className={cn("md:sticky md:top-20 md:self-start", data.section && "max-md:hidden")}
        >
          <ul className="relative grid divide-y border-y md:gap-1 md:divide-y-0 md:border-y-0">
            {/* Indicatore che scorre fra le voci insieme alla sezione visibile. */}
            {indicator ? (
              <li
                aria-hidden="true"
                className="absolute inset-x-0 top-0 hidden rounded-lg bg-secondary transition-[translate,height] duration-(--duration-fast) ease-(--ease-smooth-out) md:block"
                style={{ translate: `0 ${indicator.top}px`, height: indicator.height }}
              />
            ) : null}
            {settingsSections.map((id) => {
              const icon = sectionIcons[id];
              return (
                <li
                  key={id}
                  ref={(node) => {
                    items.current[id] = node;
                  }}
                  className="relative"
                >
                  <Link
                    to={appHref(links, `impostazioni/${id}`)}
                    preventScrollReset
                    aria-current={active === id ? "true" : undefined}
                    onClick={() => goTo(id, "smooth")}
                    className={cn(
                      "flex items-center gap-3 py-3.5 outline-none focus-visible:ring-3 focus-visible:ring-ring md:rounded-lg md:px-2 md:py-1.5 md:text-sm md:text-muted-foreground md:transition-colors md:duration-(--duration-quick) md:hover:text-foreground md:aria-[current=true]:font-medium md:aria-[current=true]:text-foreground",
                      // Prima della misura l'indicatore non c'è: la voce attiva ha il suo fondo.
                      !indicator && "md:aria-[current=true]:bg-secondary",
                    )}
                  >
                    <IconTile icon={icon} tone="neutral" size="sm" />
                    <span className="grid min-w-0 flex-1 gap-0.5">
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
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div
          className={cn(
            "grid max-w-3xl min-w-0 content-start gap-6",
            !data.section && "max-md:hidden",
          )}
        >
          <Link
            to={appHref(links, "impostazioni")}
            className="-ml-1 inline-flex w-fit items-center gap-1 rounded-md py-1 pr-2 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring md:hidden"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
            {t.settings.title}
          </Link>
          {settingsSections.map((id) => {
            const icon = sectionIcons[id];
            return (
              <section
                key={id}
                ref={(node) => {
                  sections.current[id] = node;
                }}
                aria-labelledby={`settings-${id}`}
                className={cn(
                  "grid scroll-mt-20 gap-6 md:rounded-xl md:border md:bg-card md:p-6",
                  id !== current && "max-md:hidden",
                )}
              >
                <h2 id={`settings-${id}`} className="flex items-center gap-3 text-xl font-semibold">
                  <IconTile icon={icon} tone="neutral" />
                  {t.settings.sections[id].title}
                </h2>
                <div className="grid gap-6">{content[id]}</div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Riquadro del profilo con icona neutra, titolo e contenuto. */
function ProfileCard({
  icon,
  title,
  id,
  children,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  title: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="grid gap-4 rounded-xl border bg-card p-5">
      <h2 id={id} className="flex items-center gap-3 text-base font-semibold">
        <IconTile icon={icon} tone="neutral" />
        {title}
      </h2>
      {children}
    </section>
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
  const action = useAction();
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6">
      <div className="flex items-center gap-4">
        <InitialsTile
          name={account.name}
          fallback={account.email}
          size="lg"
          className="size-14 rounded-full text-lg"
        />
        <div className="grid min-w-0 gap-0.5">
          <h1 className="text-2xl font-bold sm:text-3xl">{t.profile.title}</h1>
          <p className="truncate text-sm text-muted-foreground">{account.email}</p>
        </div>
      </div>
      <ProfileCard icon={User} title={t.profile.name} id="profile-name-title">
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            action.run("profile", { name: String(new FormData(event.currentTarget).get("name")) });
          }}
        >
          <Field>
            <FieldLabel htmlFor="profile-name" className="sr-only">
              {t.profile.name}
            </FieldLabel>
            <Input
              id="profile-name"
              name="name"
              autoComplete="name"
              defaultValue={account.name}
              aria-describedby="profile-name-hint"
            />
            <FieldDescription id="profile-name-hint">{t.profile.nameHint}</FieldDescription>
          </Field>
          <Button type="submit" className="w-fit">
            {t.settings.save}
          </Button>
        </form>
      </ProfileCard>
      {/* L'email non si modifica nel campo: il cambio passa dalla verifica del nuovo indirizzo. */}
      <ProfileCard icon={Mail} title={t.profile.email} id="profile-email">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="min-w-0 font-medium break-all">{account.email}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-describedby="profile-email-hint"
            onClick={() => action.run("change-email")}
          >
            {t.profile.changeEmail}
          </Button>
        </div>
        <p id="profile-email-hint" className="text-sm text-muted-foreground">
          {t.profile.emailHint}
        </p>
      </ProfileCard>
      <ProfileCard
        icon={ShieldCheck}
        title={t.settings.sections.sicurezza.title}
        id="profile-security"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{t.profile.security}</p>
          <Link
            to={appHref(links, "impostazioni/sicurezza")}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {t.profile.securityLink}
          </Link>
        </div>
      </ProfileCard>
    </div>
  );
}
