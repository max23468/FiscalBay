import { env } from "cloudflare:workers";
import { cn } from "cn";
import { useEffect, useRef, useState } from "react";
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

import {
  AnimatePresence,
  domMax,
  LazyMotion,
  m,
  MotionConfig,
  useReducedMotion,
} from "motion/react";

import { LedgerIndicator, TesseraArt } from "~/components/brand";
import { EmptyState } from "~/components/empty-state";
import { StatusAlert, StatusBadge, type StatusTone } from "~/components/status";
import { TaxCode } from "~/components/tax-code";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
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
    { title: `FiscalBay | ${copy[languageFromPath(location.pathname)].title}` },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

const copy = {
  it: {
    title: "Design system",
    intro: "Un’anteprima dello stile di FiscalBay, con ordini di esempio e azioni da provare.",
    language: "Lingua",
    theme: "Tema",
    themeSystem: "Sistema",
    themeLight: "Chiaro",
    themeDark: "Scuro",
    colors: "Colori",
    colorsDescription: "La palette di FiscalBay, per sfondi, testi e avvisi.",
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
    failed: "Aggiornamento non riuscito",
    locked: "Da sbloccare",
    missing: "Non disponibile su eBay",
    alertInfoTitle: "Sincronizzazione in corso",
    alertInfo: "Gli ordini appaiono appena eBay li rende disponibili.",
    alertWarningTitle: "Collegamento scaduto",
    alertWarning: "La sincronizzazione è sospesa. Ricollega il negozio.",
    alertDangerTitle: "Aggiornamento non riuscito",
    alertDanger: "eBay non ha risposto. Gli ordini non sono stati aggiornati. Riprova più tardi.",
    alertMissingTitle: "Codice Fiscale non presente",
    alertMissing: "eBay non lo riporta per questo ordine.",
    form: "Form",
    formDescription: "Etichette chiare e indicazioni vicino a ciò che va corretto.",
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
    tabOrdersBody: "Passa da una scheda all’altra anche con i tasti freccia.",
    tabStoresBody: "Contenuto della seconda scheda.",
    tabSettingsBody: "Contenuto della terza scheda.",
    loadingState: "Caricamento",
    icons: "Icone",
    iconsDescription: "Lucide, outline uniformi da 16 e 20 px.",
    actions: "Azioni",
    copyTaxCode: "Copia Codice Fiscale",
    download: "Scarica",
    refresh: "Aggiorna",
    identity: "Identità",
    identityDescription:
      "La tessera del logo entra nell’interfaccia: le sue tre righe segnano la sincronizzazione, la sua forma gli stati vuoti.",
    syncIdle: "Sincronizzato 5 minuti fa",
    unlock: "Sblocca",
    resetDemo: "Ripristina",
    copyLabel: "Copia Codice Fiscale",
    copiedLabel: "Codice Fiscale copiato",
    copyFailedLabel: "Copia non riuscita. Riprova oppure seleziona e copia il codice.",
    lockedLabel: "Codice Fiscale da sbloccare",
    motion: "Movimento",
    motionDescription: "Quando arrivano nuovi ordini, un avviso permette di aggiornare l’elenco.",
    addOrder: "Simula nuovo ordine",
    emptyTitle: "Nessun negozio collegato",
    emptyDescription:
      "Collega il tuo negozio eBay per consultare gli ordini e i Codici Fiscali disponibili.",
    connectStore: "Collega negozio eBay",
    emptyStates: "Stati vuoti",
    searchEmptyTitle: "Nessun risultato",
    searchEmptyDescription: "Nessun ordine corrisponde ai filtri. Modifica i criteri di ricerca.",
    resetFilters: "Reimposta filtri",
    reconnectStore: "Ricollega negozio",
    surfaces: "Superfici",
    surfacePage: "Pagina",
    surfaceCard: "Contenuto",
    surfaceOverlay: "Dialog e pannelli",
    orderSample: "Scheda ordine",
    orderSampleDescription:
      "Anteprima con ordini di esempio. Puoi provare le azioni: nessun negozio viene modificato e nessuno sblocco viene consumato.",
    sampleState: "Stato del campione",
    available: "Da copiare",
    sampleDate: "27 settembre 2026, 09:42",
    sampleBuyer: "Società Cooperativa Agricola Val di Non e Valle di Sole Soc. Coop.",
    sampleItem:
      "Set di ricambi originali per macchina da scrivere meccanica, edizione da collezione",
    sampleItemOther: "Custodia protettiva e accessori",
    sampleQuantity: "Quantità",
    sampleOrderStatus: "Pagato",
    sampleLocked:
      "Sblocca tutti i dati fiscali di questo ordine. Hai ancora 2 ordini disponibili: dopo lo sblocco ne resterà 1.",
    sampleMissing: "eBay non riporta il Codice Fiscale per questo ordine.",
    sampleVerify: "Controlla che il Codice Fiscale corrisponda all’acquirente prima di usarlo.",
    sampleFailed: "Non siamo riusciti a recuperare il Codice Fiscale da eBay. Riprova tra poco.",
    simulateUnlock: "Sblocca ordine",
    simulateRetry: "Riprova",
    sampleUnlocked: "Ordine sbloccato. Ti resta 1 ordine da sbloccare.",
    sampleRetried: "Codice Fiscale recuperato.",
    readOrder: "Dettaglio ordine",
    compareOrders: "Elenco ordini",
    orderItems: "2 articoli · Mostra dettagli",
    showNew: "Mostra il nuovo ordine",
    searchExample: "Ricerca: macchina da scrivere · Ultimi 7 giorni",
    storeExample: "Il tuo negozio eBay",
    verticalTabs: "Schede verticali",
  },
  en: {
    title: "Design system",
    intro: "A preview of FiscalBay’s style, with sample orders and actions to try.",
    language: "Language",
    theme: "Theme",
    themeSystem: "System",
    themeLight: "Light",
    themeDark: "Dark",
    colors: "Colours",
    colorsDescription: "FiscalBay’s palette for backgrounds, text and notices.",
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
    failed: "Couldn’t update",
    locked: "To unlock",
    missing: "Not available on eBay",
    alertInfoTitle: "Sync in progress",
    alertInfo: "Orders appear as soon as eBay makes them available.",
    alertWarningTitle: "Connection expired",
    alertWarning: "Syncing is paused. Reconnect the store.",
    alertDangerTitle: "Couldn’t update",
    alertDanger: "eBay did not respond. Orders have not been updated. Try again later.",
    alertMissingTitle: "Codice Fiscale not present",
    alertMissing: "eBay does not provide it for this order.",
    form: "Form",
    formDescription: "Clear labels and guidance next to anything that needs correcting.",
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
      "FiscalBay will stop updating this store’s orders. Your history will be kept for the stated period. You can reconnect the store later.",
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
    tabOrdersBody: "Use the arrow keys to move between tabs.",
    tabStoresBody: "Second tab content.",
    tabSettingsBody: "Third tab content.",
    loadingState: "Loading",
    icons: "Icons",
    iconsDescription: "Lucide, uniform outline at 16 and 20 px.",
    actions: "Actions",
    copyTaxCode: "Copy Codice Fiscale",
    download: "Download",
    refresh: "Refresh",
    identity: "Identity",
    identityDescription:
      "The logo card enters the interface: its three lines mark syncing, its shape the empty states.",
    syncIdle: "Synced 5 minutes ago",
    unlock: "Unlock",
    resetDemo: "Reset",
    copyLabel: "Copy Codice Fiscale",
    copiedLabel: "Codice Fiscale copied",
    copyFailedLabel: "Copy failed. Try again, or select and copy the code.",
    lockedLabel: "Codice Fiscale to unlock",
    motion: "Motion",
    motionDescription: "When new orders arrive, a notice lets you update the list.",
    addOrder: "Simulate new order",
    emptyTitle: "No store connected",
    emptyDescription: "Connect your eBay store to view orders and available tax codes.",
    connectStore: "Connect eBay store",
    emptyStates: "Empty states",
    searchEmptyTitle: "No results",
    searchEmptyDescription: "No orders match the filters. Change your search criteria.",
    resetFilters: "Reset filters",
    reconnectStore: "Reconnect store",
    surfaces: "Surfaces",
    surfacePage: "Page",
    surfaceCard: "Content",
    surfaceOverlay: "Dialogs and panels",
    orderSample: "Order card",
    orderSampleDescription:
      "Preview with sample orders. Try the actions: no store is changed and no unlocks are used.",
    sampleState: "Sample state",
    available: "Ready to copy",
    sampleDate: "27 September 2026, 09:42",
    sampleBuyer: "Società Cooperativa Agricola Val di Non e Valle di Sole Soc. Coop.",
    sampleItem: "Original spare parts set for a mechanical typewriter, collector’s edition",
    sampleItemOther: "Protective case and accessories",
    sampleQuantity: "Quantity",
    sampleOrderStatus: "Paid",
    sampleLocked:
      "Unlock all tax details for this order. You have 2 orders left; after unlocking, you will have 1.",
    sampleMissing: "eBay does not provide a tax code for this order.",
    sampleVerify: "Check that the tax code matches the buyer before using it.",
    sampleFailed: "We could not get the tax code from eBay. Try again shortly.",
    simulateUnlock: "Unlock order",
    simulateRetry: "Try again",
    sampleUnlocked: "Order unlocked. You can unlock 1 more order.",
    sampleRetried: "Tax code retrieved.",
    readOrder: "Order details",
    compareOrders: "Order list",
    orderItems: "2 items · Show details",
    showNew: "Show new order",
    searchExample: "Search: typewriter · Last 7 days",
    storeExample: "Your eBay store",
    verticalTabs: "Vertical tabs",
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
    tone: "locked",
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
      <div className="grid gap-1">
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
    { value: "outlet", label: "Outlet ricambi auto e moto d’epoca - magazzino secondario" },
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

function taxCodeLabels(t: Copy) {
  return {
    copy: t.copyLabel,
    copied: t.copiedLabel,
    copyFailed: t.copyFailedLabel,
    locked: t.lockedLabel,
  };
}

/** Campione temporaneo del catalogo: nessun caricamento o mutazione di ordini reali. */
function OrderCardSample({ t }: { t: Copy }) {
  const [state, setState] = useState("available");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  const cases = [
    { value: "available", label: t.available, tone: "success", description: "" },
    { value: "locked", label: t.locked, tone: "locked", description: t.sampleLocked },
    { value: "missing", label: t.missing, tone: "neutral", description: t.sampleMissing },
    { value: "verify", label: t.verify, tone: "warning", description: t.sampleVerify },
    { value: "failed", label: t.failed, tone: "danger", description: t.sampleFailed },
  ] satisfies Array<{ value: string; label: string; tone: StatusTone; description: string }>;
  const current = cases.find((item) => item.value === state)!;
  const hasCode = state === "available" || state === "verify";
  const compactOrders = [
    {
      order: "12-34567-89012",
      buyer: t.sampleBuyer,
      taxCode: hasCode ? "01234567890" : null,
      total: "€ 1.249,00",
      tone: current.tone,
      label: current.label,
    },
    ...rows.slice(1).map((row) => ({ ...row, label: t[row.status] })),
    {
      order: "31-77421-10058",
      buyer: "Giorgio Neri",
      taxCode: "NREGGR80A01H501A",
      total: "€ 18,40",
      tone: "success" as const,
      label: t.available,
    },
  ];
  return (
    <Section title={t.orderSample} description={t.orderSampleDescription}>
      <Field className="max-w-sm">
        <FieldLabel htmlFor="sample-state">{t.sampleState}</FieldLabel>
        <Select
          items={cases}
          value={state}
          onValueChange={(value) => {
            if (value) setState(value);
            setNotice("");
          }}
        >
          <SelectTrigger id="sample-state">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {cases.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="grid min-w-0 gap-3">
          <h3 className="text-xs font-medium text-muted-foreground">{t.readOrder}</h3>
          <Card className="min-w-0 gap-0 py-0" role="article" aria-label={t.orderSample}>
            <CardHeader className="gap-2 p-5 pb-0 sm:p-6 sm:pb-0">
              <p className="font-code text-xs text-muted-foreground">{t.order} 12-34567-89012</p>
              <CardTitle className="text-base leading-relaxed font-semibold text-pretty">
                {t.sampleBuyer}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 p-5 sm:p-6">
              <div className="grid gap-2">
                <h4 className="text-xs font-medium text-muted-foreground">{t.taxCode}</h4>
                <div className="flex min-h-10 items-center">
                  {hasCode ? (
                    <TaxCode value="01234567890" labels={taxCodeLabels(t)} reveal={notice !== ""} />
                  ) : state === "locked" ? (
                    <TaxCode value={null} labels={taxCodeLabels(t)} />
                  ) : (
                    <StatusBadge tone={current.tone}>{current.label}</StatusBadge>
                  )}
                </div>
                {state === "verify" ? <StatusBadge tone="warning">{t.verify}</StatusBadge> : null}
                {current.description ? (
                  <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                    {current.description}
                  </p>
                ) : null}
                {state === "locked" || state === "failed" ? (
                  <Button
                    className="mt-2 w-fit"
                    variant={state === "locked" ? "default" : "outline"}
                    onClick={() => {
                      setNotice(state === "locked" ? t.sampleUnlocked : t.sampleRetried);
                      setState("available");
                    }}
                  >
                    {state === "locked" ? t.simulateUnlock : t.simulateRetry}
                  </Button>
                ) : null}
                <p
                  role="status"
                  className={cn("text-xs text-muted-foreground", !notice && "sr-only")}
                >
                  {notice}
                </p>
              </div>
              <div className="grid gap-2 border-t pt-4 text-sm leading-relaxed text-muted-foreground">
                <p>Outlet ricambi auto e moto d’epoca - magazzino secondario</p>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs">
                  <time dateTime="2026-09-27T09:42:00+02:00">{t.sampleDate}</time>
                  <span className="font-code whitespace-nowrap">
                    {t.sampleOrderStatus} · € 1.249,00
                  </span>
                </div>
              </div>
              <details className="group border-t pt-4 text-sm">
                <summary className="w-fit cursor-pointer rounded-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring">
                  {t.orderItems}
                </summary>
                <ul className="mt-3 grid gap-3 leading-relaxed text-muted-foreground">
                  <li>
                    {t.sampleItem}{" "}
                    <span className="whitespace-nowrap">· {t.sampleQuantity}: 2</span>
                  </li>
                  <li>
                    {t.sampleItemOther}{" "}
                    <span className="whitespace-nowrap">· {t.sampleQuantity}: 1</span>
                  </li>
                </ul>
              </details>
            </CardContent>
          </Card>
        </div>
        <div className="grid min-w-0 gap-3">
          <h3 className="text-xs font-medium text-muted-foreground">{t.compareOrders}</h3>
          <ul aria-label={t.compareOrders} className="divide-y border-y">
            {compactOrders.map((row) => (
              <li
                key={row.order}
                className="grid gap-x-4 gap-y-2 py-4 sm:grid-cols-[minmax(0,1fr)_14rem] sm:items-center"
              >
                <div className="grid min-w-0 gap-1">
                  <p className="text-sm leading-relaxed font-medium text-pretty">{row.buyer}</p>
                  <p className="font-code flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="whitespace-nowrap">{row.order}</span>
                    <span className="whitespace-nowrap">{row.total}</span>
                  </p>
                </div>
                <div className="min-w-0">
                  {row.taxCode ? (
                    <TaxCode value={row.taxCode} labels={taxCodeLabels(t)} />
                  ) : (
                    <StatusBadge tone={row.tone}>{row.label}</StatusBadge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}

function IdentityDemo({ t }: { t: Copy }) {
  const [unlocked, setUnlocked] = useState(false);
  const labels = taxCodeLabels(t);
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <LedgerIndicator />
            {t.syncIdle}
          </span>
          <span className="inline-flex items-center gap-2">
            <LedgerIndicator active />
            {t.alertInfoTitle}
          </span>
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-[10rem_1fr] sm:items-center">
          <dt className="text-muted-foreground">Maria Rossi</dt>
          <dd>
            <TaxCode value="RSSMRA80A41H501U" labels={labels} />
          </dd>
          <dt className="text-muted-foreground">Luca Bianchi</dt>
          <dd className="flex flex-wrap items-center gap-3">
            <TaxCode value={unlocked ? "BNCLCU75C12F205X" : null} labels={labels} reveal />
            <Button
              size="sm"
              variant={unlocked ? "ghost" : "default"}
              onClick={() => setUnlocked((value) => !value)}
            >
              {unlocked ? t.resetDemo : t.unlock}
            </Button>
          </dd>
          <dt className="text-muted-foreground">Tecnoufficio S.r.l.</dt>
          <dd>
            <TaxCode value="01234567890" labels={labels} />
          </dd>
        </dl>
      </div>
      <TesseraArt className="hidden md:block" />
    </div>
  );
}

const incoming = [
  { order: "31-77421-10058", buyer: "Giorgio Neri", total: "€ 18,40" },
  { order: "08-33110-45672", buyer: "Elena Galli", total: "€ 212,00" },
  { order: "22-90807-66341", buyer: "Paolo Conti", total: "€ 9,99" },
];

function MotionDemo({ t }: { t: Copy }) {
  const reducedMotion = useReducedMotion();
  const [pending, setPending] = useState(false);
  const [items, setItems] = useState(() =>
    rows.slice(0, 2).map(({ order, buyer, total }) => ({ order, buyer, total })),
  );
  const next = incoming.find((item) => !items.some((row) => row.order === item.order));
  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig
        reducedMotion="user"
        transition={{ duration: reducedMotion ? 0 : 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="grid max-w-xl gap-3">
          <div className="flex min-h-10 flex-wrap items-center gap-3">
            <Button
              variant="outline"
              disabled={!next}
              onClick={() => {
                if (pending && next) setItems((list) => [next, ...list]);
                setPending(!pending);
              }}
            >
              {pending ? t.showNew : t.addOrder}
            </Button>
          </div>
          <ul className="grid gap-2">
            <AnimatePresence initial={false}>
              {items.map((item) => (
                <m.li
                  key={item.order}
                  layout={!reducedMotion}
                  initial={reducedMotion ? false : { opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 border-b px-1 py-3 text-sm"
                >
                  <span className="font-code font-medium whitespace-nowrap">{item.order}</span>
                  <span className="font-code shrink-0 text-xs text-muted-foreground whitespace-nowrap">
                    {item.total}
                  </span>
                  <span className="col-span-2 text-pretty leading-relaxed text-muted-foreground">
                    {item.buyer}
                  </span>
                </m.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      </MotionConfig>
    </LazyMotion>
  );
}

function PageHeader({ language, t }: { language: Language; t: Copy }) {
  const [theme, setTheme] = useState<Theme>("system");
  return (
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
  );
}

function Foundations({ t }: { t: Copy }) {
  return (
    <>
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
          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">{t.taxCode}</dt>
              <dd className="font-code text-[0.9375rem] font-medium whitespace-nowrap">
                RSSMRA80A41H501U
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t.order}</dt>
              <dd className="font-code text-sm font-medium whitespace-nowrap">12-34567-89012</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t.total}</dt>
              <dd className="font-code text-lg font-semibold whitespace-nowrap">€ 1.249,00</dd>
            </div>
          </dl>
        </div>
      </Section>
      <Section title={t.surfaces}>
        <div className="grid gap-4 sm:grid-cols-2">
          {(["light", "dark"] as const).map((theme) => (
            <div
              key={theme}
              className={
                theme === "dark"
                  ? "dark-tokens rounded-xl border bg-background p-5 text-foreground"
                  : "rounded-xl border bg-[#f5f7fa] p-5 text-[#0f1b2d]"
              }
            >
              <p className="mb-4 text-sm font-medium">
                {theme === "dark" ? t.themeDark : t.themeLight} · {t.surfacePage}
              </p>
              <div
                className={
                  theme === "dark"
                    ? "rounded-xl border bg-card p-4"
                    : "rounded-xl border border-[#d9dfe8] bg-white p-4"
                }
              >
                <p className="text-sm">{t.surfaceCard}</p>
                <div
                  className={
                    theme === "dark"
                      ? "mt-4 rounded-xl border bg-popover p-4 shadow-md"
                      : "mt-4 rounded-xl border border-[#d9dfe8] bg-white p-4 shadow-md"
                  }
                >
                  {t.surfaceOverlay}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

function ButtonsSection({ t }: { t: Copy }) {
  return (
    <>
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
          <Button disabled focusableWhenDisabled aria-busy="true">
            <Spinner
              label={t.loading}
              aria-hidden="true"
              role={undefined}
              data-icon="inline-start"
            />
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
    </>
  );
}

function StatesSection({ t }: { t: Copy }) {
  return (
    <>
      <Section title={t.states} description={t.statesDescription}>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone="success">{t.connected}</StatusBadge>
          <StatusBadge tone="info">{t.info}</StatusBadge>
          <StatusBadge tone="warning">{t.verify}</StatusBadge>
          <StatusBadge tone="danger">{t.failed}</StatusBadge>
          <StatusBadge tone="premium">Premium</StatusBadge>
          <StatusBadge tone="locked">{t.locked}</StatusBadge>
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
    </>
  );
}

function OverlaysSection({ t }: { t: Copy }) {
  return (
    <>
      <Section title={t.overlays}>
        <div className="flex flex-wrap gap-3">
          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="destructive" />}>
              {t.openDialog}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t.dialogTitle}</AlertDialogTitle>
                <AlertDialogDescription>{t.dialogDescription}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
                <AlertDialogClose render={<Button variant="destructive-solid" />}>
                  {t.confirm}
                </AlertDialogClose>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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
                  <dd>
                    <TaxCode value="RSSMRA80A41H501U" labels={taxCodeLabels(t)} />
                  </dd>
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
    </>
  );
}

function TableSection({ t }: { t: Copy }) {
  return (
    <>
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
                  <TableCell className="font-code text-xs text-muted-foreground whitespace-nowrap">
                    {row.order}
                  </TableCell>
                  <TableCell className="max-w-64 whitespace-normal">{row.buyer}</TableCell>
                  <TableCell>
                    {row.taxCode ? (
                      <TaxCode value={row.taxCode} labels={taxCodeLabels(t)} />
                    ) : (
                      <StatusBadge tone={row.tone}>{t[row.status]}</StatusBadge>
                    )}
                  </TableCell>
                  <TableCell className="font-code text-right text-muted-foreground whitespace-nowrap">
                    {row.total}
                  </TableCell>
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
    </>
  );
}

function TabsSection({ t }: { t: Copy }) {
  return (
    <>
      <Section title={t.tabs}>
        <Tabs defaultValue="orders" orientation="vertical" className="max-w-xl">
          <TabsList aria-label={t.verticalTabs}>
            <TabsTrigger value="orders">{t.tabOrders}</TabsTrigger>
            <TabsTrigger value="stores">{t.tabStores}</TabsTrigger>
            <TabsTrigger value="settings">{t.tabSettings}</TabsTrigger>
          </TabsList>
          <TabsContent value="orders">{t.tabOrdersBody}</TabsContent>
          <TabsContent value="stores">{t.tabStoresBody}</TabsContent>
          <TabsContent value="settings">{t.tabSettingsBody}</TabsContent>
        </Tabs>
        <Tabs defaultValue="orders" className="max-w-xl">
          <TabsList variant="line">
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
    </>
  );
}

export default function DesignSystem({ loaderData }: Route.ComponentProps) {
  const { language } = loaderData;
  const t = copy[language];
  return (
    <main className="mx-auto grid w-[min(72rem,calc(100%-2rem))] gap-12 py-10">
      <PageHeader language={language} t={t} />
      <Section title={t.identity} description={t.identityDescription}>
        <IdentityDemo t={t} />
      </Section>
      <Section title={t.motion} description={t.motionDescription}>
        <MotionDemo t={t} />
      </Section>
      <OrderCardSample t={t} />
      <Foundations t={t} />
      <ButtonsSection t={t} />
      <StatesSection t={t} />
      <Section title={t.form} description={t.formDescription}>
        <SampleForm t={t} />
      </Section>
      <OverlaysSection t={t} />
      <TableSection t={t} />
      <TabsSection t={t} />
      <Section title={t.emptyStates}>
        <EmptyState
          title={t.emptyTitle}
          description={t.emptyDescription}
          action={<Button>{t.connectStore}</Button>}
        />
        <div className="mt-4 grid gap-3">
          <p className="text-xs text-muted-foreground">{t.searchExample}</p>
          <EmptyState
            variant="search"
            title={t.searchEmptyTitle}
            description={t.searchEmptyDescription}
            action={<Button variant="outline">{t.resetFilters}</Button>}
          />
        </div>
        <div className="mt-4 grid gap-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Store aria-hidden="true" className="size-4 text-muted-foreground" />
            {t.storeExample} · Outlet ricambi
          </p>
          <EmptyState
            variant="connection"
            title={t.alertWarningTitle}
            description={t.alertWarning}
            action={<Button variant="outline">{t.reconnectStore}</Button>}
          />
        </div>
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
