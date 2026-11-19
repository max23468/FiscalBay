import { lazy, Suspense, useState } from "react";
import { useLocation, useNavigation, useSubmit } from "react-router";

import { AppShell } from "~/components/app-shell";
import { useCopy } from "~/components/copy-context";
import { useDeviceTimeZone } from "~/components/device-time-zone";
import { OrdersLoading } from "~/components/orders/loading";
import { shellDestinations, shellMenu } from "~/components/shell-links";

import { appCopy } from "../app-copy";
import {
  accessPath,
  appBase,
  appHref,
  environmentOf,
  environmentParam,
  languagePath,
  notificationsPath,
  orderSearchPath,
  withEnvironment,
} from "../app-links";
import { localizedPath, type Language } from "../i18n";
import { clearAppBadge, microsoftStoreUrl, useInstall } from "../installed-app";
import type { ShellData } from "../preferences";

// Le istruzioni di Safari arrivano al primo clic, fuori dal JavaScript iniziale dell'area.
const InstallGuideDialog = lazy(() =>
  import("~/components/install-guide").then(({ InstallGuideDialog }) => ({
    default: InstallGuideDialog,
  })),
);

/**
 * Voce `Installa l'app`: su Windows apre la scheda dello Store, altrove l'installazione di Chrome
 * ed Edge oppure le istruzioni di Safari.
 */
function installAction(
  install: ReturnType<typeof useInstall>,
  language: Language,
  openGuide: () => void,
) {
  if (!install) return undefined;
  if (install.kind === "store")
    return () => void window.open(microsoftStoreUrl(language), "_blank", "noopener");
  return install.kind === "prompt" ? install.open : openGuide;
}

/**
 * Shell dell'area reale: le stesse barra e menu dell'anteprima, con le sole destinazioni che
 * esistono. Prima della conferma dell'email le Impostazioni non sono raggiungibili e la lingua
 * resta nel menu.
 */
export function AccountShell({
  account,
  security,
  shell,
  searchQuery = null,
  children,
}: {
  account: { name: string; email: string };
  /** Dopo la conferma dell'email: navigazione, ricerca ordini, campanella e Impostazioni. */
  security: boolean;
  shell?: ShellData;
  /** Ricerca attiva della pagina Ordini; null nelle altre pagine. */
  searchQuery?: string | null;
  children: React.ReactNode;
}) {
  const { language } = useCopy();
  const t = appCopy[language];
  const submit = useSubmit();
  const { pathname, search } = useLocation();
  useDeviceTimeZone();
  const install = useInstall();
  const [guideOpen, setGuideOpen] = useState(false);
  // La ricerca resta nell'ambiente eBay mostrato, che sul test può essere la Sandbox.
  const environment = environmentOf(new URLSearchParams(search).get(environmentParam));
  const links = { language, base: appBase };
  // Verso gli Ordini da un'altra sezione la pagina precedente lascia subito il posto allo
  // scheletro dell'elenco; dentro gli Ordini i dati mostrati restano durante la lettura.
  const navigation = useNavigation();
  const ordersList = appHref(links, "ordini");
  const loadingOrders =
    navigation.state === "loading"
    && navigation.location.pathname === ordersList
    && !pathname.startsWith(ordersList);
  return (
    <>
      <AppShell
        account={account}
        notifications={security ? (shell?.notifications ?? undefined) : undefined}
        notificationsAction={notificationsPath}
        now={shell?.now}
        navigation={security ? shellDestinations(links, t) : []}
        home={ordersList}
        search={
          security
            ? {
                action:
                  environment === "sandbox"
                    ? withEnvironment(orderSearchPath, environment)
                    : orderSearchPath,
                query: searchQuery,
              }
            : undefined
        }
        menu={shellMenu(links, t, {
          verified: security,
          whatsNew: shell?.whatsNew,
          admin: shell?.admin,
          install: installAction(install, language, () => setGuideOpen(true)),
          language: {
            href: languagePath,
            onSelect: (chosen) =>
              void submit(
                { language: chosen, returnTo: `${pathname}${search}` },
                { method: "post", action: languagePath },
              ),
          },
        })}
        onSignOut={() => {
          // Dopo l'uscita l'icona dell'app installata non conta più notifiche.
          clearAppBadge();
          void submit(
            { intent: "esci" },
            { method: "post", action: localizedPath(language, accessPath) },
          );
        }}
      >
        {loadingOrders ? <OrdersLoading /> : children}
      </AppShell>
      {install?.kind === "guide" && guideOpen ? (
        <Suspense fallback={null}>
          <InstallGuideDialog
            label={t.shell.install}
            text={t.shell.installGuide[install.guide]}
            close={t.shell.close}
            onClose={() => setGuideOpen(false)}
          />
        </Suspense>
      ) : null}
    </>
  );
}
