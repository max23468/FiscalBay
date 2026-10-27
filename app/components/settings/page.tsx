import { cn } from "cn";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Database,
  FileSpreadsheet,
  LifeBuoy,
  MessageSquareText,
  Palette,
  Settings,
  ShieldCheck,
  User,
} from "lucide-react";
import { useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router";

import { useCopy, useLinks } from "~/components/copy-context";
import { IconTile, PageTitle } from "~/components/icon-tile";
import { appHref } from "../../app-links";
import type { Language } from "../../i18n";
import type { Theme, TimeZoneChoice } from "../../preferences";
import {
  settingsGroups,
  type AccountView,
  type DiagnosticsView,
  type OrderPeriod,
  type SettingsSection,
  type TelegramView,
} from "../../view-models";
import { AppearanceSection } from "./appearance";
import type { ExportConfiguration } from "../../domain/export-configurations.server";
import type { ExportFileView } from "../../domain/export-jobs.server";
import type { ExportContext, ExportTally } from "../../orders/export-scope";
import { ExportSection } from "./export";
import { NotificationsSection } from "./notifications";
import { PlanSection, type FreeStoreView, type PurchaseView } from "./plan";
import { PrivacySection } from "./privacy";
import { ProfileSection } from "./profile";
import { SecuritySection, type SecurityData } from "./security";
import { SupportSection } from "./support";
import { TemplateSection } from "./template";
import { UnsavedDialog, useDraft, useUnsavedGuard } from "./unsaved";

export interface SettingsPageData {
  confirmUnlock: boolean;
  section: SettingsSection | null;
  /** Categorie presenti: nell'area reale mancano quelle di servizi non ancora disponibili. */
  sections: readonly SettingsSection[];
  /** Servizi che eseguono le azioni; nell'anteprima sono tutti simulati. */
  services: SettingsServices;
  account: AccountView;
  purchase: PurchaseView;
  /** Negozio attivo del Free; null in Premium o senza negozi. */
  freeStore: FreeStoreView | null;
  security: SecurityData;
  /** Valori salvati, con i testi predefiniti dove non c'è una scelta. */
  preferences: {
    theme: Theme;
    timeZone: TimeZoneChoice;
    /** Fuso del dispositivo, se il browser l'ha già comunicato. */
    detectedTimeZone: string | null;
    marketing: boolean;
    templates: Record<Language, string>;
  };
  /** Dati tecnici allegabili alla richiesta di assistenza; null se non si leggono. */
  diagnostics: DiagnosticsView | null;
  /** Pagina Novità con voci (D203): Supporto la collega. */
  whatsNew: boolean;
  /** Notifiche Telegram dello spazio; null senza il servizio o senza uno spazio. */
  telegram: TelegramView | null;
  /** Ordini di ogni periodo dell'esportazione aperta dalle Impostazioni; null con un ambito. */
  exportPeriods: Record<OrderPeriod, ExportTally> | null;
  /** Ambito ricevuto dagli Ordini, con i suoi ordini; null se l'esportazione è aperta dalle Impostazioni. */
  exportContext: ExportContext | null;
  /** Configurazioni dell'esportazione salvate, mostrate soltanto con Premium. */
  exportConfigurations: ExportConfiguration[];
  /** File creati e lavori delle ultime 24 ore ancora utili. */
  exportFiles: ExportFileView[];
  now: string;
}

/**
 * Servizi dietro le azioni: pagamenti e prova (Stripe), gestione dell'abbonamento e documenti
 * su Stripe, Telegram, esportazione e cancellazione dell'account, modulo di assistenza. Senza il
 * servizio l'azione non compare.
 */
export interface SettingsServices {
  billing: boolean;
  billingPortal: boolean;
  telegram: boolean;
  accountExport: boolean;
  accountDeletion: boolean;
  support: boolean;
}

/** Icone neutre: le Impostazioni restano sobrie, il colore sta in Ordini e Negozi. */
const sectionIcons: Record<SettingsSection, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  profilo: User,
  piano: CreditCard,
  notifiche: Bell,
  esportazione: FileSpreadsheet,
  sicurezza: ShieldCheck,
  aspetto: Palette,
  messaggio: MessageSquareText,
  privacy: Database,
  supporto: LifeBuoy,
};

/** Radice delle Impostazioni di un indirizzo, oppure l'indirizzo stesso fuori da esse. */
function settingsRoot(pathname: string) {
  return /^(.*\/impostazioni)(?:\/[^/]*)?$/u.exec(pathname)?.[1] ?? pathname;
}

/** Campi modificabili del profilo; la ragione sociale soltanto per un'azienda. */
function profileFields(profile: AccountView["profile"]): Record<string, string> {
  return {
    nome: profile.firstName,
    cognome: profile.lastName,
    ...(profile.accountType === "business" ? { ragione_sociale: profile.companyName ?? "" } : {}),
  };
}

/** Da 768 px tutte le categorie stanno in una pagina che scorre. */
const wideQuery = "(min-width: 48rem)";

/** Distanza dal bordo superiore oltre la quale una sezione diventa quella attiva. */
const spyOffset = 140;

/**
 * Sezione attiva su desktop, dove le categorie formano una sola pagina che scorre: l'indicatore
 * segue la sezione visibile e, durante lo scorrimento avviato dal menu, resta sulla voce scelta.
 * All'apertura, al cambio lingua e al ritorno dal pagamento la pagina torna sulla categoria
 * dell'indirizzo; i clic fra categorie scorrono dal menu con `goTo`.
 */
function useScrollSpy(
  ids: readonly SettingsSection[],
  opened: SettingsSection | null,
  align: string,
) {
  const sections = useRef<Partial<Record<SettingsSection, HTMLElement | null>>>({});
  const [active, setActive] = useState<SettingsSection>(opened ?? ids[0]!);
  const following = useRef(false);
  const release = useRef<ReturnType<typeof setTimeout>>(undefined);

  const spy = () => {
    if (following.current || !window.matchMedia(wideQuery).matches) return;
    let next: SettingsSection = ids[0]!;
    for (const id of ids) {
      const top = sections.current[id]?.getBoundingClientRect().top ?? Infinity;
      if (top <= Math.max(spyOffset, window.innerHeight * 0.35)) next = id;
    }
    const atBottom =
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    setActive(atBottom ? ids[ids.length - 1]! : next);
  };

  const finishFollowing = () => {
    following.current = false;
    clearTimeout(release.current);
    spy();
  };

  const goTo = (id: SettingsSection, behavior: ScrollBehavior) => {
    if (!window.matchMedia(wideQuery).matches) return;
    clearTimeout(release.current);
    setActive(id);
    following.current = behavior === "smooth";
    if (following.current) release.current = setTimeout(finishFollowing, 1000);
    sections.current[id]?.scrollIntoView({ behavior, block: "start" });
  };

  const onOpen = useEffectEvent(() => (opened ? goTo(opened, "instant") : spy()));
  const onScroll = useEffectEvent(spy);
  const onScrollEnd = useEffectEvent(finishFollowing);
  useLayoutEffect(() => {
    // Dopo il ripristino dello scroll della route.
    const frame = requestAnimationFrame(onOpen);
    const scrolled = () => onScroll();
    const ended = () => onScrollEnd();
    window.addEventListener("scroll", scrolled, { passive: true });
    window.addEventListener("resize", scrolled);
    window.addEventListener("scrollend", ended);
    return () => {
      window.removeEventListener("scroll", scrolled);
      window.removeEventListener("resize", scrolled);
      window.removeEventListener("scrollend", ended);
      cancelAnimationFrame(frame);
      clearTimeout(release.current);
      following.current = false;
    };
  }, [align]);

  return { sections, active, goTo };
}

/**
 * Impostazioni. Su desktop le categorie formano una sola pagina che scorre:
 * il menu resta fisso e l'indicatore segue la sezione visibile. Su mobile
 * restano elenco e poi pagina della singola categoria.
 */
export function SettingsPage({ data }: { data: SettingsPageData }) {
  const { t, language } = useCopy();
  const { links } = useLinks();
  const sectionIds = data.sections;
  const current = data.section ?? sectionIds[0]!;
  // Gruppi con le sole categorie presenti, nell'ordine delle Impostazioni.
  const present = new Set(sectionIds);
  const groups = settingsGroups
    .map((group) => ({
      id: group.id,
      sections: (group.sections as readonly SettingsSection[]).filter((id) => present.has(id)),
    }))
    .filter((group) => group.sections.length > 0);
  const premium = data.account.plan === "premium";
  // Le bozze stanno nella pagina: il router ammette un solo blocco della navigazione, quindi
  // l'avviso d'uscita è uno per entrambe. Fra le categorie restano, perché la pagina è la stessa.
  const profileDraft = useDraft(profileFields(data.account.profile), "profile");
  const templateDraft = useDraft(data.preferences.templates, "template");
  const blocker = useUnsavedGuard(profileDraft.dirty || templateDraft.dirty, settingsRoot);
  const unsaved =
    profileDraft.dirty && templateDraft.dirty
      ? t.settings.template.unsavedBoth
      : profileDraft.dirty
        ? t.profile.unsaved
        : t.settings.template.unsaved;
  const content = {
    profilo: <ProfileSection account={data.account} form={profileDraft} />,
    piano: (
      <PlanSection
        account={data.account}
        freeStore={data.freeStore}
        billing={data.services.billing}
        billingPortal={data.services.billingPortal}
        purchase={data.purchase}
        confirmUnlock={data.confirmUnlock}
        now={data.now}
      />
    ),
    notifiche: (
      <NotificationsSection
        telegram={data.services.telegram ? data.telegram : null}
        premium={premium}
        marketing={data.preferences.marketing}
      />
    ),
    esportazione: (
      <ExportSection
        premium={premium}
        configurations={data.exportConfigurations}
        context={data.exportContext}
        periods={data.exportPeriods}
        files={data.exportFiles}
      />
    ),
    sicurezza: (
      <SecuritySection security={data.security} email={data.account.email} now={data.now} />
    ),
    aspetto: (
      <AppearanceSection
        theme={data.preferences.theme}
        timeZone={data.preferences.timeZone}
        detectedTimeZone={data.preferences.detectedTimeZone}
      />
    ),
    messaggio: <TemplateSection form={templateDraft} />,
    privacy: (
      <PrivacySection
        accountExport={data.services.accountExport}
        accountDeletion={data.services.accountDeletion}
      />
    ),
    supporto: (
      <SupportSection
        support={data.services.support}
        diagnostics={data.diagnostics}
        email={data.account.email}
        whatsNew={data.whatsNew ? appHref(links, "novita") : undefined}
      />
    ),
  } satisfies Record<SettingsSection, React.ReactNode>;
  const { sections, active, goTo } = useScrollSpy(
    sectionIds,
    data.section,
    `${language}:${data.purchase.checkout ?? ""}`,
  );
  const items = useRef<Partial<Record<SettingsSection, HTMLElement | null>>>({});
  const [indicator, setIndicator] = useState<{ top: number; height: number } | null>(null);

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
          <ul className="relative grid gap-6 md:gap-4">
            {/* Indicatore che scorre fra le voci insieme alla sezione visibile. */}
            {indicator ? (
              <li
                aria-hidden="true"
                className="absolute inset-x-0 top-0 hidden rounded-lg bg-secondary transition-[translate,height] duration-(--duration-fast) ease-(--ease-smooth-out) md:block"
                style={{ translate: `0 ${indicator.top}px`, height: indicator.height }}
              />
            ) : null}
            {groups.map((group) => (
              <li key={group.id} className="grid gap-2 md:gap-1">
                <span
                  id={`settings-group-${group.id}`}
                  className="text-sm font-medium text-muted-foreground md:px-2 md:text-xs"
                >
                  {t.settings.groups[group.id]}
                </span>
                <ul
                  aria-labelledby={`settings-group-${group.id}`}
                  className="grid divide-y border-y md:gap-1 md:divide-y-0 md:border-y-0"
                >
                  {group.sections.map((id) => {
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
                          <span className="min-w-0 flex-1 font-medium md:font-[inherit]">
                            {t.settings.sections[id].title}
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
          {sectionIds.map((id) => {
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
      <UnsavedDialog
        blocker={blocker}
        title={t.settings.template.unsavedTitle}
        description={unsaved}
        leave={t.settings.template.leave}
        stay={t.profile.stay}
        pending={profileDraft.action.pending || templateDraft.action.pending}
      />
    </div>
  );
}
