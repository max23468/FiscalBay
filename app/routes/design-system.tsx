import { env } from "cloudflare:workers";
import { useRef, useState } from "react";
import { data } from "react-router";
import {
  Copy,
  Download,
  EllipsisVertical,
  Languages,
  Moon,
  PanelRight,
  RefreshCw,
  Search,
  Store,
  Sun,
  SunMoon,
} from "lucide-react";

import { StatusAlert, StatusBadge, type StatusTone } from "~/components/status";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
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
import { Separator } from "~/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { Skeleton } from "~/components/ui/skeleton";
import { Spinner } from "~/components/ui/spinner";
import { Switch } from "~/components/ui/switch";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Textarea } from "~/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import logoDarkUrl from "../../docs/brand/logo/fiscalbay-logo-dark.svg?url";
import logoUrl from "../../docs/brand/logo/fiscalbay-logo.svg?url";
import { languageFromPath, type Language } from "../i18n";
import type { Route } from "./+types/design-system";

const productionOrigin = "https://fiscalbay.it";

/** Catalogo interno del design system: esiste solo negli ambienti non Production. */
export function loader({ request }: Route.LoaderArgs) {
  if (env.APP_ORIGIN === productionOrigin) throw data(null, { status: 404 });
  return { language: languageFromPath(new URL(request.url).pathname) };
}

export function meta({ location }: Route.MetaArgs): Route.MetaDescriptors {
  return [
    { title: `FiscalBay — ${copy[languageFromPath(location.pathname)].title}` },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

const copy = {
  it: {
    title: "Design system",
    intro:
      "Campione dei token e dei componenti di FiscalBay. I dati sono dimostrativi e non descrivono funzioni nuove.",
    language: "Lingua",
    theme: "Tema",
    themeSystem: "Sistema",
    themeLight: "Chiaro",
    themeDark: "Scuro",
    colors: "Colori",
    colorsDescription: "Token semantici di superfici, testo e stati.",
    typography: "Tipografia",
    typographyDescription: "Inter Variable, un solo sans-serif.",
    typeSample: "Trova e gestisci il Codice Fiscale dei tuoi ordini eBay.",
    buttons: "Pulsanti",
    primary: "Esporta",
    secondary: "Sincronizza",
    outline: "Copia",
    ghost: "Annulla",
    destructive: "Scollega negozio",
    loading: "Caricamento",
    disabled: "Non disponibile",
    iconOnly: "Altre azioni",
    tooltip: "Copia il Codice Fiscale",
    states: "Stati",
    statesDescription: "Colore, icona e testo insieme; il dato assente non è un errore.",
    found: "Trovato",
    connected: "Collegato",
    info: "In sincronizzazione",
    verify: "Da verificare",
    failed: "Lettura non riuscita",
    locked: "Da sbloccare",
    missing: "Non disponibile su eBay",
    alertInfoTitle: "Sincronizzazione in corso",
    alertInfo: "Gli ordini appaiono appena eBay li rende disponibili.",
    alertWarningTitle: "Collegamento da rinnovare",
    alertWarning: "Ricollega il negozio per continuare a leggere gli ordini.",
    alertDangerTitle: "Lettura non riuscita",
    alertDanger: "eBay non ha risposto. Riprova più tardi.",
    alertMissingTitle: "Codice Fiscale non presente",
    alertMissing: "eBay non lo riporta per questo ordine: non è un errore.",
    form: "Form",
    formDescription:
      "Errori associati ai campi e annunciati; il primo campo errato riceve il focus.",
    email: "Email",
    emailHint: "Usata solo per le comunicazioni di servizio.",
    emailRequired: "Inserisci un indirizzo email.",
    emailInvalid: "L’indirizzo email non è valido.",
    store: "Negozio",
    storePlaceholder: "Scegli un negozio",
    storeRequired: "Scegli un negozio.",
    note: "Nota",
    noteHint: "Massimo 200 caratteri.",
    notifications: "Notifiche",
    telegram: "Notifiche Telegram",
    dailyDigest: "Riepilogo giornaliero",
    fiscalOnly: "Solo ordini con dato fiscale",
    submit: "Salva",
    formErrors: "Correggi i campi evidenziati.",
    formSaved: "Impostazioni salvate.",
    overlays: "Dialog e pannello",
    openDialog: "Scollega negozio",
    dialogTitle: "Scollegare il negozio?",
    dialogDescription:
      "FiscalBay smette di leggere il negozio su eBay. Lo storico resta secondo i tempi di conservazione e puoi ricollegare lo stesso negozio in seguito.",
    cancel: "Annulla",
    confirm: "Scollega",
    openSheet: "Dettaglio ordine",
    sheetDescription: "Pannello laterale; Esc o il pulsante di chiusura lo chiudono.",
    close: "Chiudi",
    list: "Tabella",
    order: "Ordine",
    buyer: "Acquirente",
    taxCode: "Codice Fiscale",
    total: "Totale",
    caption: "Righe dimostrative con testi lunghi e dati mancanti.",
    tabs: "Schede",
    tabOrders: "Ordini",
    tabStores: "Negozi",
    tabSettings: "Impostazioni",
    tabOrdersBody: "Contenuto della prima scheda. Le frecce spostano il focus tra le schede.",
    tabStoresBody: "Contenuto della seconda scheda.",
    tabSettingsBody: "Contenuto della terza scheda.",
    loadingState: "Caricamento",
    icons: "Icone",
    iconsDescription: "Lucide, outline uniformi da 16 e 20 px.",
    actions: "Azioni",
    copyTaxCode: "Copia Codice Fiscale",
    download: "Scarica",
    refresh: "Aggiorna",
  },
  en: {
    title: "Design system",
    intro:
      "Sample of FiscalBay tokens and components. The data is illustrative and does not describe new features.",
    language: "Language",
    theme: "Theme",
    themeSystem: "System",
    themeLight: "Light",
    themeDark: "Dark",
    colors: "Colours",
    colorsDescription: "Semantic tokens for surfaces, text and states.",
    typography: "Typography",
    typographyDescription: "Inter Variable, a single sans-serif.",
    typeSample: "Find and manage the Codice Fiscale of your eBay orders.",
    buttons: "Buttons",
    primary: "Export",
    secondary: "Sync",
    outline: "Copy",
    ghost: "Cancel",
    destructive: "Disconnect store",
    loading: "Loading",
    disabled: "Unavailable",
    iconOnly: "More actions",
    tooltip: "Copy the tax code",
    states: "States",
    statesDescription: "Colour, icon and text together; missing data is not an error.",
    found: "Found",
    connected: "Connected",
    info: "Syncing",
    verify: "Needs review",
    failed: "Read failed",
    locked: "To unlock",
    missing: "Not available on eBay",
    alertInfoTitle: "Sync in progress",
    alertInfo: "Orders appear as soon as eBay makes them available.",
    alertWarningTitle: "Connection needs renewal",
    alertWarning: "Reconnect the store to keep reading orders.",
    alertDangerTitle: "Read failed",
    alertDanger: "eBay did not respond. Try again later.",
    alertMissingTitle: "Codice Fiscale not present",
    alertMissing: "eBay does not report it for this order: this is not an error.",
    form: "Form",
    formDescription: "Errors are tied to fields and announced; the first invalid field gets focus.",
    email: "Email",
    emailHint: "Used only for service messages.",
    emailRequired: "Enter an email address.",
    emailInvalid: "The email address is not valid.",
    store: "Store",
    storePlaceholder: "Choose a store",
    storeRequired: "Choose a store.",
    note: "Note",
    noteHint: "Up to 200 characters.",
    notifications: "Notifications",
    telegram: "Telegram notifications",
    dailyDigest: "Daily summary",
    fiscalOnly: "Only orders with tax data",
    submit: "Save",
    formErrors: "Fix the highlighted fields.",
    formSaved: "Settings saved.",
    overlays: "Dialog and panel",
    openDialog: "Disconnect store",
    dialogTitle: "Disconnect the store?",
    dialogDescription:
      "FiscalBay stops reading the store on eBay. History is kept according to the retention periods, and you can reconnect the same store later.",
    cancel: "Cancel",
    confirm: "Disconnect",
    openSheet: "Order details",
    sheetDescription: "Side panel; Esc or the close button dismisses it.",
    close: "Close",
    list: "Table",
    order: "Order",
    buyer: "Buyer",
    taxCode: "Codice Fiscale",
    total: "Total",
    caption: "Illustrative rows with long text and missing data.",
    tabs: "Tabs",
    tabOrders: "Orders",
    tabStores: "Stores",
    tabSettings: "Settings",
    tabOrdersBody: "First tab content. Arrow keys move focus between tabs.",
    tabStoresBody: "Second tab content.",
    tabSettingsBody: "Third tab content.",
    loadingState: "Loading",
    icons: "Icons",
    iconsDescription: "Lucide, uniform outline at 16 and 20 px.",
    actions: "Actions",
    copyTaxCode: "Copy Codice Fiscale",
    download: "Download",
    refresh: "Refresh",
  },
} satisfies Record<Language, Record<string, string>>;

type Copy = (typeof copy)[Language];

const colorTokens = [
  "background",
  "card",
  "foreground",
  "muted-foreground",
  "primary",
  "secondary",
  "border",
  "ring",
  "success",
  "info",
  "warning",
  "danger",
  "premium",
  "neutral",
];

const rows: Array<{
  order: string;
  buyer: string;
  taxCode: string | null;
  tone: StatusTone;
  status: keyof Copy;
  total: string;
}> = [
  {
    order: "12-34567-89012",
    buyer: "Maria Rossi",
    taxCode: "RSSMRA80A41H501U",
    tone: "success",
    status: "found",
    total: "€ 49,90",
  },
  {
    order: "27-10293-84756",
    buyer: "Società Cooperativa Agricola Val di Non e Valle di Sole Soc. Coop.",
    taxCode: null,
    tone: "neutral",
    status: "missing",
    total: "€ 1.249,00",
  },
  {
    order: "05-55555-12121",
    buyer: "Luca Bianchi",
    taxCode: null,
    tone: "premium",
    status: "locked",
    total: "€ 12,00",
  },
  {
    order: "19-00001-99999",
    buyer: "Giulia Verdi",
    taxCode: null,
    tone: "danger",
    status: "failed",
    total: "€ 7,50",
  },
];

type Theme = "system" | "light" | "dark";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const id = `ds-${title.toLowerCase().replace(/[^a-z]+/gu, "-")}`;
  return (
    <section aria-labelledby={id} className="grid gap-4">
      <div>
        <h2 id={id} className="text-xl font-semibold">
          {title}
        </h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function SampleForm({ t }: { t: Copy }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [store, setStore] = useState<string | null>(null);

  const stores = [
    { value: "main", label: "Vintage Garage Italia" },
    { value: "outlet", label: "Outlet ricambi auto e moto d’epoca — magazzino secondario" },
  ];

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const next: Record<string, string> = {};
    if (!email) next.email = t.emailRequired;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) next.email = t.emailInvalid;
    if (!store) next.store = t.storeRequired;
    setErrors(next);
    setSaved(Object.keys(next).length === 0);
    const first = Object.keys(next)[0];
    if (first) formRef.current?.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus();
  }

  const count = Object.keys(errors).length;
  return (
    <form ref={formRef} noValidate onSubmit={submit} className="grid max-w-xl gap-6">
      {count > 0 ? (
        <StatusAlert tone="danger" title={t.formErrors} />
      ) : saved ? (
        <StatusAlert tone="success" title={t.formSaved} />
      ) : null}
      <FieldGroup>
        <Field data-invalid={errors.email ? true : undefined}>
          <FieldLabel htmlFor="ds-email">{t.email}</FieldLabel>
          <Input
            id="ds-email"
            name="email"
            type="email"
            autoComplete="email"
            data-field="email"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "ds-email-error ds-email-hint" : "ds-email-hint"}
          />
          <FieldDescription id="ds-email-hint">{t.emailHint}</FieldDescription>
          {errors.email ? <FieldError id="ds-email-error">{errors.email}</FieldError> : null}
        </Field>
        <Field data-invalid={errors.store ? true : undefined}>
          <FieldLabel htmlFor="ds-store">{t.store}</FieldLabel>
          <Select items={stores} value={store} onValueChange={(value) => setStore(value)}>
            <SelectTrigger
              id="ds-store"
              data-field="store"
              className="w-full"
              aria-invalid={errors.store ? true : undefined}
              aria-describedby={errors.store ? "ds-store-error" : undefined}
            >
              <SelectValue placeholder={t.storePlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {stores.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  <Store aria-hidden="true" />
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.store ? <FieldError id="ds-store-error">{errors.store}</FieldError> : null}
        </Field>
        <Field>
          <FieldLabel htmlFor="ds-note">{t.note}</FieldLabel>
          <Textarea id="ds-note" name="note" maxLength={200} aria-describedby="ds-note-hint" />
          <FieldDescription id="ds-note-hint">{t.noteHint}</FieldDescription>
        </Field>
        <FieldSet>
          <FieldLegend variant="label">{t.notifications}</FieldLegend>
          <Field orientation="horizontal">
            <FieldLabel className="font-normal">
              <Switch name="telegram" defaultChecked />
              {t.telegram}
            </FieldLabel>
          </Field>
          <Field orientation="horizontal">
            <FieldLabel className="font-normal">
              <Switch name="digest" />
              {t.dailyDigest}
            </FieldLabel>
          </Field>
          <Field orientation="horizontal">
            <FieldLabel className="font-normal">
              <Checkbox name="fiscalOnly" defaultChecked />
              {t.fiscalOnly}
            </FieldLabel>
          </Field>
        </FieldSet>
      </FieldGroup>
      <div>
        <Button type="submit">{t.submit}</Button>
      </div>
    </form>
  );
}

export default function DesignSystem({ loaderData }: Route.ComponentProps) {
  const { language } = loaderData;
  const t = copy[language];
  const [theme, setTheme] = useState<Theme>("system");

  return (
    <main className="mx-auto grid w-[min(72rem,calc(100%-2rem))] gap-12 py-10">
      <header className="grid gap-4">
        <img src={logoUrl} alt="FiscalBay" className="h-8 w-fit dark:hidden" />
        <img src={logoDarkUrl} alt="FiscalBay" className="hidden h-8 w-fit dark:block" />
        <h1 className="text-3xl font-bold sm:text-4xl">{t.title}</h1>
        <p className="max-w-2xl text-muted-foreground">{t.intro}</p>
        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          <nav aria-label={t.language} className="flex items-center gap-1">
            <Languages aria-hidden="true" className="size-4 text-muted-foreground" />
            {(
              [
                ["it", "/design", "Italiano"],
                ["en", "/en/design", "English"],
              ] as const
            ).map(([code, href, label]) => (
              <a
                key={code}
                href={href}
                lang={code}
                aria-current={language === code ? "page" : undefined}
                className="inline-flex h-8 items-center rounded-md px-2.5 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring aria-[current=page]:bg-secondary aria-[current=page]:text-secondary-foreground pointer-coarse:h-11"
              >
                {label}
              </a>
            ))}
          </nav>
          <FieldSet className="w-fit">
            <FieldLegend variant="label">{t.theme}</FieldLegend>
            <RadioGroup
              value={theme}
              onValueChange={(value) => {
                setTheme(value as Theme);
                applyTheme(value as Theme);
              }}
              className="flex flex-wrap gap-4"
            >
              {(
                [
                  ["system", t.themeSystem, SunMoon],
                  ["light", t.themeLight, Sun],
                  ["dark", t.themeDark, Moon],
                ] as const
              ).map(([value, label, Icon]) => (
                <FieldLabel key={value} className="font-normal">
                  <RadioGroupItem value={value} />
                  <Icon aria-hidden="true" className="size-4" />
                  {label}
                </FieldLabel>
              ))}
            </RadioGroup>
          </FieldSet>
        </div>
      </header>

      <Section title={t.colors} description={t.colorsDescription}>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {colorTokens.map((token) => (
            <li key={token} className="grid gap-1.5 text-xs">
              <span className="h-12 rounded-lg border" style={{ background: `var(--${token})` }} />
              <code className="text-muted-foreground">--{token}</code>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t.typography} description={t.typographyDescription}>
        <div className="grid gap-2">
          <p className="text-4xl font-bold tracking-tight">{t.typeSample}</p>
          <p className="text-2xl font-semibold tracking-tight">{t.typeSample}</p>
          <p className="text-lg font-medium">{t.typeSample}</p>
          <p className="text-base">{t.typeSample}</p>
          <p className="text-sm text-muted-foreground">{t.typeSample}</p>
          <p className="font-mono text-sm tabular-nums">
            RSSMRA80A41H501U · 12-34567-89012 · € 1.249,00
          </p>
        </div>
      </Section>

      <Section title={t.buttons}>
        <div className="flex flex-wrap items-center gap-3">
          <Button>
            <Download aria-hidden="true" data-icon="inline-start" />
            {t.primary}
          </Button>
          <Button variant="secondary">
            <RefreshCw aria-hidden="true" data-icon="inline-start" />
            {t.secondary}
          </Button>
          <Tooltip>
            <TooltipTrigger render={<Button variant="outline" />}>
              <Copy aria-hidden="true" data-icon="inline-start" />
              {t.outline}
            </TooltipTrigger>
            <TooltipContent>{t.tooltip}</TooltipContent>
          </Tooltip>
          <Button variant="ghost">{t.ghost}</Button>
          <Button variant="destructive">{t.destructive}</Button>
          <Button disabled aria-busy="true">
            <Spinner label={t.loading} data-icon="inline-start" />
            {t.loading}
          </Button>
          <Button variant="outline" disabled>
            {t.disabled}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon" aria-label={t.iconOnly} />}
            >
              <EllipsisVertical aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Copy aria-hidden="true" />
                {t.copyTaxCode}
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Download aria-hidden="true" />
                {t.download}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive">{t.destructive}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Section>

      <Section title={t.states} description={t.statesDescription}>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone="success">{t.connected}</StatusBadge>
          <StatusBadge tone="info">{t.info}</StatusBadge>
          <StatusBadge tone="warning">{t.verify}</StatusBadge>
          <StatusBadge tone="danger">{t.failed}</StatusBadge>
          <StatusBadge tone="premium">{t.locked}</StatusBadge>
          <StatusBadge tone="neutral">{t.missing}</StatusBadge>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <StatusAlert tone="info" title={t.alertInfoTitle}>
            {t.alertInfo}
          </StatusAlert>
          <StatusAlert tone="warning" title={t.alertWarningTitle}>
            {t.alertWarning}
          </StatusAlert>
          <StatusAlert tone="danger" title={t.alertDangerTitle}>
            {t.alertDanger}
          </StatusAlert>
          <StatusAlert tone="neutral" title={t.alertMissingTitle}>
            {t.alertMissing}
          </StatusAlert>
        </div>
      </Section>

      <Section title={t.form} description={t.formDescription}>
        <SampleForm t={t} />
      </Section>

      <Section title={t.overlays}>
        <div className="flex flex-wrap gap-3">
          <Dialog>
            <DialogTrigger render={<Button variant="destructive" />}>{t.openDialog}</DialogTrigger>
            <DialogContent closeLabel={t.close}>
              <DialogHeader>
                <DialogTitle>{t.dialogTitle}</DialogTitle>
                <DialogDescription>{t.dialogDescription}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>{t.cancel}</DialogClose>
                <DialogClose render={<Button variant="destructive" />}>{t.confirm}</DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Sheet>
            <SheetTrigger render={<Button variant="outline" />}>
              <PanelRight aria-hidden="true" data-icon="inline-start" />
              {t.openSheet}
            </SheetTrigger>
            <SheetContent closeLabel={t.close}>
              <SheetHeader>
                <SheetTitle>{t.openSheet} 12-34567-89012</SheetTitle>
                <SheetDescription>{t.sheetDescription}</SheetDescription>
              </SheetHeader>
              <dl className="grid gap-3 px-4 text-sm">
                <div className="grid gap-0.5">
                  <dt className="text-muted-foreground">{t.buyer}</dt>
                  <dd>Maria Rossi</dd>
                </div>
                <div className="grid gap-0.5">
                  <dt className="text-muted-foreground">{t.taxCode}</dt>
                  <dd className="font-mono">RSSMRA80A41H501U</dd>
                </div>
                <div className="grid gap-0.5">
                  <dt className="text-muted-foreground">{t.total}</dt>
                  <dd className="tabular-nums">€ 49,90</dd>
                </div>
              </dl>
            </SheetContent>
          </Sheet>
        </div>
      </Section>

      <Section title={t.list}>
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableCaption className="pb-3">{t.caption}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>{t.order}</TableHead>
                <TableHead>{t.buyer}</TableHead>
                <TableHead>{t.taxCode}</TableHead>
                <TableHead className="text-right">{t.total}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.order}>
                  <TableCell className="font-mono tabular-nums">{row.order}</TableCell>
                  <TableCell className="max-w-64 whitespace-normal">{row.buyer}</TableCell>
                  <TableCell>
                    {row.taxCode ? (
                      <span className="font-mono">{row.taxCode}</span>
                    ) : (
                      <StatusBadge tone={row.tone}>{t[row.status]}</StatusBadge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.total}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell>
                  <Skeleton className="h-4 w-28" />
                  <span className="sr-only">{t.loadingState}</span>
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-40" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-32" />
                </TableCell>
                <TableCell>
                  <Skeleton className="ml-auto h-4 w-16" />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Section>

      <Section title={t.tabs}>
        <Tabs defaultValue="orders" className="max-w-xl">
          <TabsList>
            <TabsTrigger value="orders">{t.tabOrders}</TabsTrigger>
            <TabsTrigger value="stores">{t.tabStores}</TabsTrigger>
            <TabsTrigger value="settings">{t.tabSettings}</TabsTrigger>
          </TabsList>
          {(
            [
              ["orders", t.tabOrders, t.tabOrdersBody],
              ["stores", t.tabStores, t.tabStoresBody],
              ["settings", t.tabSettings, t.tabSettingsBody],
            ] as const
          ).map(([value, title, body]) => (
            <TabsContent key={value} value={value}>
              <Card>
                <CardHeader>
                  <CardTitle>{title}</CardTitle>
                  <CardDescription>{body}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Separator />
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </Section>

      <Section title={t.icons} description={t.iconsDescription}>
        <div className="flex flex-wrap items-center gap-4 text-muted-foreground" aria-hidden="true">
          {[Search, Store, Copy, Download, RefreshCw, PanelRight, Languages, SunMoon].map(
            (Icon, index) => (
              <Icon key={index} className={index % 2 ? "size-5" : "size-4"} />
            ),
          )}
        </div>
      </Section>
    </main>
  );
}
