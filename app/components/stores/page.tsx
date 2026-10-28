import { Play, Plus, Store } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { useAction } from "~/components/action";
import { useConfirmed } from "~/components/confirmation";
import { EmptyState } from "~/components/empty-state";
import { PageTitle } from "~/components/icon-tile";
import { StatusAlert } from "~/components/status";
import { Button } from "~/components/ui/button";
import { buttonLink } from "~/components/ui/button-variants";
import { useCopy } from "~/components/copy-context";
import { supportEmail } from "../../app-copy";
import { usePageTiming } from "../../page-timing";
import type { StoreView } from "../../view-models";
import { StoreSheet } from "./detail";
import { StoreList, StoreTable } from "./list";
import { StoreOverview } from "./overview";
import { ebayDownText, type StoresPageData } from "./state";

/** La schermata preparatoria riporta ai negozi con «Annulla». */
function connectFromStores(connectHref: string) {
  return `${connectHref}?da=negozi`;
}

/** Negozi eBay: lista leggera, dettaglio e azioni nel pannello con URL proprio. */
export function StoresPage({
  data: saved,
  notice,
  confirmation,
  timing,
}: {
  data: StoresPageData;
  /** Biglietto del report delle misure, soltanto nell'area reale. */
  timing?: string;
  /** Esito del collegamento eBay appena concluso, sotto il titolo. */
  notice?: React.ReactNode;
  /**
   * Stato confermato dei negozi in lettura, nella stessa risposta: fino ad allora restano
   * l'ultimo stato salvato e le letture a richiesta sospese.
   */
  confirmation?: Promise<StoreView[]>;
}) {
  const { t } = useCopy();
  const stores = useConfirmed(saved.stores, confirmation);
  const [detail] = useConfirmed(saved.detail ? [saved.detail] : [], confirmation);
  const data = { ...saved, stores, detail: detail ?? null };
  usePageTiming("stores", timing);
  // «Già collegato a un altro account» è l'esito di un tentativo, non uno stato della pagina.
  const [attempted, setAttempted] = useState(false);
  const premium = data.account.plan === "premium";
  const connect = <ConnectButton data={data} onElsewhere={() => setAttempted(true)} />;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle icon={Store} tone="teal">
          {t.stores.title}
        </PageTitle>
        {data.stores.length > 0 ? connect : null}
      </header>
      {notice}
      {data.elsewhere && attempted ? (
        <StatusAlert tone="warning" title={t.stores.elsewhereTitle}>
          {t.stores.elsewhereBody}
          <a href={`mailto:${supportEmail}`} className="block underline underline-offset-4">
            {t.common.contactSupport}: {supportEmail}
          </a>
        </StatusAlert>
      ) : null}
      {data.ebayDown.length > 0 ? (
        <StatusAlert tone="warning" title={ebayDownText(data, t)} />
      ) : null}
      {data.stores.length === 0 ? (
        <EmptyState
          title={t.orders.firstUseTitle}
          description={t.orders.firstUseBody}
          action={connect}
        />
      ) : (
        <>
          {premium ? null : <FreeNotes stores={data.stores} />}
          <InactivityNotice stores={data.stores} />
          {data.stores.length === 1 ? (
            <StoreOverview store={data.stores[0]!} data={data} />
          ) : (
            <>
              <StoreTable stores={data.stores} premium={premium} now={data.now} />
              <StoreList stores={data.stores} premium={premium} now={data.now} />
            </>
          )}
        </>
      )}
      <StoreSheet data={data} />
    </div>
  );
}

/** Limiti del Free validi per tutto lo spazio, sopra l'elenco. */
function FreeNotes({ stores }: { stores: StoreView[] }) {
  const { t } = useCopy();
  if (!stores.some((store) => store.pauseReason === "plan")) return null;
  return (
    <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
      {t.stores.freeLimit}
    </p>
  );
}

/**
 * Letture del Free in pausa per inattività: la ripresa di un negozio è la conferma dell'utente
 * e riprende tutti quelli dello spazio.
 */
function InactivityNotice({ stores }: { stores: StoreView[] }) {
  const { t } = useCopy();
  const action = useAction();
  const store = stores.find((candidate) => candidate.pauseReason === "inactivity");
  if (!store) return null;
  return (
    <StatusAlert tone="warning" title={t.stores.inactivityTitle}>
      <span className="grid justify-items-start gap-3">
        {t.stores.inactivityBody}
        <Button
          size="sm"
          pending={action.pending}
          onClick={() => action.run("store-resume", { store: store.id })}
        >
          <Play aria-hidden="true" data-icon="inline-start" />
          {t.stores.inactivityResume}
        </Button>
      </span>
    </StatusAlert>
  );
}

/** Collega: nell'area reale apre la schermata preparatoria, nell'anteprima simula l'esito. */
function ConnectButton({ data, onElsewhere }: { data: StoresPageData; onElsewhere: () => void }) {
  const { t } = useCopy();
  const action = useAction();
  if (data.connectHref && !data.ebayDown.includes("production")) {
    return (
      <Link to={connectFromStores(data.connectHref)} {...buttonLink()}>
        <Plus aria-hidden="true" data-icon="inline-start" />
        {t.stores.connect}
      </Link>
    );
  }
  return (
    <Button
      disabled={data.ebayDown.includes("production")}
      onClick={() => (data.elsewhere ? onElsewhere() : action.run("store-connect"))}
    >
      <Plus aria-hidden="true" data-icon="inline-start" />
      {t.stores.connect}
    </Button>
  );
}
