import { useLocation, useNavigation, useSubmit } from "react-router";

import { AppShell } from "~/components/app-shell";
import { useDeviceTimeZone } from "~/components/device-time-zone";
import { OrdersLoading } from "~/components/orders/loading";
import { shellDestinations, shellMenu } from "~/components/shell-links";
import { useCopy } from "~/components/copy-context";
import { appCopy } from "../app-copy";
import {
  accessPath,
  appBase,
  appHref,
  languagePath,
  notificationsPath,
  orderSearchPath,
} from "../app-links";
import { localizedPath } from "../i18n";
import type { ShellData } from "../preferences";

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
  // La ricerca resta nell'ambiente eBay mostrato, che sul test può essere la Sandbox.
  const sandbox = new URLSearchParams(search).get("environment") === "sandbox";
  const links = { language, base: appBase };
  // Verso gli Ordini da un'altra sezione la pagina precedente lascia subito il posto allo
  // scheletro dell'elenco; dentro gli Ordini i dati mostrati restano durante la lettura.
  const navigation = useNavigation();
  const ordersList = appHref(links, "ordini");
  const loadingOrders =
    navigation.state === "loading" &&
    navigation.location.pathname === ordersList &&
    !pathname.startsWith(ordersList);
  return (
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
              action: `${orderSearchPath}${sandbox ? "?environment=sandbox" : ""}`,
              query: searchQuery,
            }
          : undefined
      }
      menu={shellMenu(links, t, {
        verified: security,
        whatsNew: shell?.whatsNew,
        language: {
          href: languagePath,
          onSelect: (chosen) =>
            void submit(
              { language: chosen, returnTo: `${pathname}${search}` },
              { method: "post", action: languagePath },
            ),
        },
      })}
      onSignOut={() =>
        void submit(
          { intent: "esci" },
          { method: "post", action: localizedPath(language, accessPath) },
        )
      }
    >
      {loadingOrders ? <OrdersLoading /> : children}
    </AppShell>
  );
}
