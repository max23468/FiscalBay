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
import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router";

import { IconTile, PageTitle } from "~/components/icon-tile";
import type { AppCopy } from "../../app-copy";
import { appHref, type AppLinks } from "../../app-links";
import type { Language } from "../../i18n";
import type { Theme, TimeZoneChoice } from "../../preferences";
import {
  settingsGroups,
  type AccountView,
  type DiagnosticsView,
  type SettingsSection,
  type StoreView,
} from "../../view-models";
import { AppearanceSection } from "./appearance";
import { ExportSection, type ExportContext } from "./export";
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
  /** Scenario dell'anteprima: le azioni sono simulate e le scelte non restano. */
  preview: boolean;
  account: AccountView;
  purchase: PurchaseView;
  /** Negozio attivo del Free; null in Premium o senza negozi. */
  freeStore: FreeStoreView | null;
  stores: StoreView[];
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
  /** Dati tecnici allegabili alla richiesta di assistenza; null senza il modulo. */
  diagnostics: DiagnosticsView | null;
  telegramChat: string | null;
  /** Ordini dell'esportazione e quanti fra loro hanno un dato ancora da sbloccare. */
  exportEstimate: { orders: number; locked: number };
  /** Ambito ricevuto dagli Ordini; null se l'esportazione è aperta dalle Impostazioni. */
  exportContext: ExportContext | null;
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
  accountData: boolean;
  support: boolean;
}

/** La descrizione della categoria nomina soltanto i servizi disponibili. */
function sectionDescription(t: AppCopy, id: SettingsSection, services: SettingsServices) {
  const limited = t.settings.limitedDescriptions;
  if (id === "piano" && !services.billing) return limited.piano;
  if (id === "notifiche" && !services.telegram) return limited.notifiche;
  if (id === "privacy" && !services.accountData) return limited.privacy;
  return t.settings.sections[id].description;
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
    profilo: <ProfileSection account={data.account} form={profileDraft} t={t} />,
    piano: (
      <PlanSection
        account={data.account}
        freeStore={data.freeStore}
        billing={data.services.billing}
        billingPortal={data.services.billingPortal}
        purchase={data.purchase}
        confirmUnlock={data.confirmUnlock}
        now={data.now}
        t={t}
        language={language}
      />
    ),
    notifiche: (
      <NotificationsSection
        telegram={data.services.telegram}
        premium={premium}
        telegramChat={data.telegramChat}
        stores={data.stores}
        marketing={data.preferences.marketing}
        t={t}
        links={links}
      />
    ),
    esportazione: (
      <ExportSection
        premium={premium}
        context={data.exportContext}
        estimate={data.exportEstimate}
        t={t}
      />
    ),
    sicurezza: (
      <SecuritySection
        security={data.security}
        email={data.account.email}
        now={data.now}
        preview={data.preview}
        language={language}
      />
    ),
    aspetto: (
      <AppearanceSection
        theme={data.preferences.theme}
        timeZone={data.preferences.timeZone}
        detectedTimeZone={data.preferences.detectedTimeZone}
        preview={data.preview}
        t={t}
        links={links}
      />
    ),
    messaggio: <TemplateSection form={templateDraft} t={t} />,
    privacy: <PrivacySection accountData={data.services.accountData} t={t} links={links} />,
    supporto: (
      <SupportSection
        support={data.services.support}
        diagnostics={data.diagnostics}
        email={data.account.email}
        t={t}
      />
    ),
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
    clearTimeout(release.current);
    setActive(id);
    following.current = behavior === "smooth";
    if (following.current) release.current = setTimeout(finishFollowing, 1000);
    sections.current[id]?.scrollIntoView({ behavior, block: "start" });
  };

  const spy = () => {
    if (following.current || !window.matchMedia(wideQuery).matches) return;
    let next: SettingsSection = sectionIds[0]!;
    for (const id of sectionIds) {
      const top = sections.current[id]?.getBoundingClientRect().top ?? Infinity;
      if (top <= Math.max(spyOffset, window.innerHeight * 0.35)) next = id;
    }
    const atBottom =
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    setActive(atBottom ? sectionIds[sectionIds.length - 1]! : next);
  };

  const finishFollowing = () => {
    following.current = false;
    clearTimeout(release.current);
    spy();
  };

  useLayoutEffect(() => {
    // Dopo il ripristino dello scroll della route, riallinea anche il cambio lingua.
    const frame = requestAnimationFrame(() => {
      if (data.section) goTo(data.section, "instant");
      else spy();
    });
    window.addEventListener("scroll", spy, { passive: true });
    window.addEventListener("resize", spy);
    window.addEventListener("scrollend", finishFollowing);
    return () => {
      window.removeEventListener("scroll", spy);
      window.removeEventListener("resize", spy);
      window.removeEventListener("scrollend", finishFollowing);
      cancelAnimationFrame(frame);
      clearTimeout(release.current);
      following.current = false;
    };
    // Apertura, cambio lingua e ritorno dal pagamento; i clic fra categorie scorrono dal menu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, data.purchase.checkout]);

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
                          <span className="grid min-w-0 flex-1 gap-0.5">
                            <span className="font-medium md:font-[inherit]">
                              {t.settings.sections[id].title}
                            </span>
                            <span className="text-sm text-muted-foreground md:hidden">
                              {sectionDescription(t, id, data.services)}
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
