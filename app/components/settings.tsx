import { cn } from "cn";
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Database,
  FileSpreadsheet,
  LifeBuoy,
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
import { Link, useLocation, useBlocker, useBeforeUnload } from "react-router";

import { useAction } from "~/components/app-shell";
import { AccountSecurity } from "~/components/account";
import { useFieldErrors } from "~/components/form-validation";
import { IconTile, InitialsTile, PageTitle } from "~/components/icon-tile";
import { LanguageSwitch } from "~/components/language-switch";
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
import { languageNames, localizedPath, type Language } from "../i18n";
import {
  formatDate,
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
        disabled={disabled || state === "saving"}
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
  disabled,
}: {
  name: string;
  legend: string;
  options: Array<{ value: string; label: string }>;
  initial: string;
  t: AppCopy;
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
      <SaveStatus state={state} t={t} />
    </FieldSet>
  );
}

/**
 * Opzioni con nome accessibile già nell'HTML del server: Base UI collega la `<label>`
 * esterna soltanto dopo l'idratazione.
 */
function RadioOption({
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
    <FieldLabel id={id} className="font-normal">
      <RadioGroupItem value={value} disabled={disabled} aria-labelledby={id} />
      {children}
    </FieldLabel>
  );
}

function CheckboxOption({
  name,
  defaultChecked,
  children,
}: {
  name?: string;
  defaultChecked?: boolean;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <FieldLabel id={id} className="font-normal">
      <Checkbox name={name} defaultChecked={defaultChecked} aria-labelledby={id} />
      {children}
    </FieldLabel>
  );
}

function SimpleSelect({
  label,
  hint,
  items,
  value,
  premiumLabel,
  onChange,
  disabled,
}: {
  label: string;
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
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
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
      {lifetime ? null : <p className="text-sm text-muted-foreground">{t.settings.billingDocs}</p>}
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
  const [downgradeStore, setDowngradeStore] = useState(
    () => data.stores.find((store) => store.pauseReason !== "plan")?.id ?? "",
  );
  // La scelta del negozio attivo compare solo nel Free: in Premium non anticipa il downgrade.
  if (account.plan === "premium") {
    return <PremiumPlan account={account} t={t} language={language} />;
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
      {data.stores.length > 1 ? (
        <Group>
          <SimpleSelect
            label={t.stores.chooseFreeStore}
            hint={t.settings.freeStoreHint}
            items={data.stores.map((store) => ({ value: store.id, label: store.name }))}
            value={downgradeStore}
            onChange={(value) => {
              setDowngradeStore(value);
              action.run("free-store", { store: value });
            }}
          />
        </Group>
      ) : null}
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
              className={cn(
                "grid grid-rows-[1fr_auto] gap-3 rounded-xl border bg-card p-4",
                plan === "annual" && "border-primary bg-primary/5",
              )}
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
                {t.settings.buyPeriod[plan as keyof typeof t.settings.buyPeriod]}
              </Button>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">{t.settings.pricesNote}</p>
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
  const [enabled, setEnabled, enabledState] = useAutoSave<boolean>("telegram", true);
  return (
    <>
      <Group title={t.settings.telegramTitle}>
        {!premium ? (
          <StatusAlert tone="premium" title={t.settings.telegramPremium}>
            <Link
              to={appHref(links, "impostazioni/piano")}
              data-slot="button"
              className={buttonVariants({ variant: "outline", size: "sm", className: "mt-2" })}
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
            <Field orientation="horizontal" className="flex-wrap items-start">
              <Switch
                id="telegram-enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
                disabled={enabledState === "saving"}
                aria-labelledby="telegram-enabled-label"
              />
              <FieldLabel
                id="telegram-enabled-label"
                htmlFor="telegram-enabled"
                className="flex-1 font-normal"
              >
                {t.settings.telegramEnabled}
              </FieldLabel>
              <SaveStatus state={enabledState} t={t} />
            </Field>
            <fieldset disabled={!enabled} className="grid gap-5 disabled:opacity-60">
              <AutoRadio
                name="telegram-filter"
                legend={t.settings.telegramFilter}
                disabled={!enabled}
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
                  disabled={!enabled || modeState === "saving"}
                  onValueChange={(next) => setMode(String(next))}
                  className="gap-3"
                >
                  <RadioOption value="each">{t.settings.telegramModeEach}</RadioOption>
                  <RadioOption value="digest">{t.settings.telegramModeDigest}</RadioOption>
                </RadioGroup>
                <SaveStatus state={modeState} t={t} />
              </FieldSet>
              {mode === "digest" ? (
                <SimpleSelect
                  label={t.settings.telegramDigestTime}
                  disabled={!enabled}
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
                    disabled={!enabled || store.pauseReason === "plan"}
                  />
                ))}
              </FieldSet>
            </fieldset>
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
            <FieldLegend variant="label">{t.settings.exportRows}</FieldLegend>
            <RadioGroup
              value={rows}
              onValueChange={(next) => setRows(String(next))}
              className="gap-3"
            >
              <RadioOption value="order">{t.settings.exportRowOrder}</RadioOption>
              <RadioOption value="item">{t.settings.exportRowItem}</RadioOption>
            </RadioGroup>
          </FieldSet>
          <FieldSet>
            <FieldLegend variant="label">{t.settings.exportColumns}</FieldLegend>
            {premium ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {columns.map(([key, label]) => (
                  <CheckboxOption key={key} defaultChecked>
                    {label}
                  </CheckboxOption>
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
  language,
}: {
  data: SettingsPageData;
  t: AppCopy;
  language: Language;
}) {
  const action = useAction();
  return (
    <AccountSecurity
      className="grid gap-4"
      language={language}
      email={data.account.email}
      methods={{
        accounts: { password: true, google: true, ebay: false },
        passkeys: [
          { id: "preview-passkey", name: "MacBook Air", createdAt: "2026-09-21T10:12:00Z" },
        ],
      }}
      sessions={data.sessions}
      now={data.now}
      passkeyBlock="nuovo-accesso"
      onAction={(intent, fields) => action.run(intent, fields)}
    />
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
            <RadioOption key={value} value={value}>
              <Icon aria-hidden="true" className="size-4" />
              {label}
            </RadioOption>
          ))}
        </RadioGroup>
        <p className="text-sm text-muted-foreground">{t.settings.themeNote}</p>
      </Group>
      <Group title={t.settings.language}>
        <LanguageSwitch
          label={t.settings.language}
          current={links.language}
          hrefFor={(code) => localizedPath(code, barePath)}
        />
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
          ].map((zone) => ({
            value: zone,
            label: t.settings.timeZones[zone as keyof typeof t.settings.timeZones],
          }))}
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
            <TabsTrigger value="it" lang="it">
              {languageNames.it}
            </TabsTrigger>
            <TabsTrigger value="en" lang="en">
              {languageNames.en}
            </TabsTrigger>
          </TabsList>
          {(
            [
              ["it", languageNames.it, t.settings.templateDefaultIt],
              ["en", languageNames.en, t.settings.templateDefaultEn],
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
      action: t.settings.readPolicy,
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
                <AlertDialogDescription>
                  {t.settings.deleteAccountConfirmation}
                </AlertDialogDescription>
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
            <details key={item.q} className="group py-1 text-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-sm py-2 font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                {item.q}
                <ChevronDown
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground transition-[rotate] duration-(--duration-quick) group-open:rotate-180"
                />
              </summary>
              <p className="pr-7 pb-2 leading-relaxed text-pretty text-muted-foreground">
                {item.a}
              </p>
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
          <p className="text-sm text-muted-foreground">{t.access.requiredFields}</p>
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
              <FieldLabel htmlFor="support-message" required>
                {t.settings.message}
              </FieldLabel>
              <Textarea
                ref={messageRef}
                id="support-message"
                name="message"
                required
                rows={5}
                placeholder={t.settings.messagePlaceholder}
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
              <CheckboxOption name="diagnostics" defaultChecked>
                {t.settings.includeDiagnostics}
              </CheckboxOption>
            </FieldSet>
          </FieldGroup>
          <Button type="submit" className="w-fit">
            {t.settings.send}
          </Button>
          <p className="text-sm text-muted-foreground">
            {t.settings.supportEmail}{" "}
            <a href="mailto:supporto@fiscalbay.it" className="underline underline-offset-4">
              supporto@fiscalbay.it
            </a>
            .
          </p>
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
      spy();
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
      if (top <= Math.max(spyOffset, window.innerHeight * 0.35)) next = id;
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
    window.addEventListener("resize", spy);
    return () => {
      window.removeEventListener("scroll", spy);
      window.removeEventListener("resize", spy);
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
        <div className={cn("grid min-w-0 content-start gap-6", !data.section && "max-md:hidden")}>
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
                <h2 id={`settings-${id}`} className="flex items-center gap-3 text-lg font-semibold">
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
      <h2 id={id} className="flex items-center gap-3 text-lg font-semibold">
        <IconTile icon={icon} tone="neutral" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function useProfileDraft(profile: AccountView["profile"], action: ReturnType<typeof useAction>) {
  const current = JSON.stringify([profile.firstName, profile.lastName, profile.companyName ?? ""]);
  const [observed, setObserved] = useState(current);
  const [saved, setSaved] = useState(current);
  const [submitted, setSubmitted] = useState(saved);
  const [dirty, setDirty] = useState(false);
  const [handled, setHandled] = useState(action.result);
  // Una rilettura aggiorna il form pulito; una bozza locale resta disponibile.
  if (current !== observed && !dirty && !action.pending) {
    setObserved(current);
    setSaved(current);
    setSubmitted(current);
  }
  const formKey = (form: HTMLFormElement) => {
    return JSON.stringify(
      ["nome", "cognome", "ragione_sociale"].map(
        (name) => (form.elements.namedItem(name) as HTMLInputElement | null)?.value.trim() ?? "",
      ),
    );
  };
  // Il risultato si applica ai valori inviati, senza perdere eventuali modifiche successive.
  if (action.result && action.result !== handled) {
    setHandled(action.result);
    if (action.result.ok) {
      setSaved(submitted);
      setDirty(false);
    }
  }
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  );
  useBeforeUnload((event) => {
    if (dirty) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  return { dirty, setDirty, setSubmitted, saved, formKey, blocker };
}

/** Profilo dall'avatar: soltanto le informazioni personali minime. */
export function ProfilePage({
  account,
  t,
  links,
}: {
  account: Pick<AccountView, "name" | "email" | "profile">;
  t: AppCopy;
  links: AppLinks;
}) {
  const action = useAction();
  const v = useFieldErrors(t.access.validation);
  const profile = account.profile;
  const { dirty, setDirty, setSubmitted, saved, formKey, blocker } = useProfileDraft(
    profile,
    action,
  );
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
          <p className="truncate text-sm text-muted-foreground">{account.name}</p>
        </div>
      </div>
      <ProfileCard icon={User} title={t.profile.details} id="profile-name-title">
        <form
          key={saved}
          className="grid gap-4"
          {...v.form}
          onChange={(event) => setDirty(formKey(event.currentTarget) !== saved)}
          onSubmit={(event) => {
            event.preventDefault();
            if (!dirty || action.pending) return;
            if (!v.check(event)) return;
            const form = new FormData(event.currentTarget);
            setSubmitted(formKey(event.currentTarget));
            action.run("profile", {
              nome: String(form.get("nome")),
              cognome: String(form.get("cognome")),
              tipo: profile.accountType === "business" ? "azienda" : "privato",
              ...(profile.accountType === "business"
                ? { ragione_sociale: String(form.get("ragione_sociale")) }
                : {}),
            });
          }}
        >
          <p className="text-sm text-muted-foreground">{t.access.requiredFields}</p>
          <p className="text-sm text-muted-foreground">
            {t.profile.accountType}:{" "}
            {profile.accountType === "business" ? t.access.business : t.access.private}
          </p>
          <Field>
            <FieldLabel htmlFor="profile-name" required>
              {t.access.firstName}
            </FieldLabel>
            <Input
              id="profile-name"
              name="nome"
              autoComplete="given-name"
              defaultValue={profile.firstName}
              disabled={action.pending}
              maxLength={100}
              required
              {...v.control("nome", "profile-name-hint")}
            />
            {v.error("nome")}
            <FieldDescription id="profile-name-hint">{t.profile.nameHint}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="profile-last-name" required>
              {t.access.lastName}
            </FieldLabel>
            <Input
              id="profile-last-name"
              name="cognome"
              autoComplete="family-name"
              maxLength={100}
              required
              defaultValue={profile.lastName}
              disabled={action.pending}
              {...v.control("cognome")}
            />
            {v.error("cognome")}
          </Field>
          {profile.accountType === "business" ? (
            <Field>
              <FieldLabel htmlFor="profile-company" required>
                {t.access.companyName}
              </FieldLabel>
              <Input
                id="profile-company"
                name="ragione_sociale"
                autoComplete="organization"
                maxLength={200}
                required
                defaultValue={profile.companyName ?? ""}
                disabled={action.pending}
                {...v.control("ragione_sociale")}
              />
              {v.error("ragione_sociale")}
            </Field>
          ) : null}
          <Button
            type="submit"
            className="w-fit"
            disabled={!dirty || action.pending}
            aria-busy={action.pending || undefined}
          >
            {action.pending ? t.settings.saving : t.settings.save}
          </Button>
          {action.result ? (
            <p
              role={action.result.ok ? "status" : "alert"}
              className={action.result.ok ? "text-sm text-muted-foreground" : "text-sm text-danger"}
            >
              {action.result.notice}
            </p>
          ) : null}
        </form>
      </ProfileCard>
      <AlertDialog
        open={blocker.state === "blocked"}
        onOpenChange={(open) => {
          if (!open && blocker.state === "blocked") blocker.reset();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.profile.unsaved}</AlertDialogTitle>
            <AlertDialogDescription>{t.profile.unsaved}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.profile.stay}</AlertDialogCancel>
            <Button
              disabled={action.pending}
              onClick={() => {
                if (blocker.state === "blocked") blocker.proceed();
              }}
            >
              {t.profile.leave}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ProfileCard
        icon={ShieldCheck}
        title={t.settings.sections.sicurezza.title}
        id="profile-security"
      >
        <p className="grid gap-1 text-sm">
          <span className="text-muted-foreground">{t.profile.email}</span>
          <span className="break-all">{account.email}</span>
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{t.profile.security}</p>
          <Link
            to={appHref(links, "impostazioni/sicurezza")}
            data-slot="button"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {t.profile.securityLink}
          </Link>
        </div>
      </ProfileCard>
    </div>
  );
}
