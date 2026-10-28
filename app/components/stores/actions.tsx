import {
  History,
  Link2,
  Pause,
  Play,
  RefreshCw,
  SlidersHorizontal,
  Trash2,
  Unplug,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { useAction } from "~/components/action";
import { useHydrated } from "~/components/hydrated";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { buttonLink } from "~/components/ui/button-variants";
import { Field, FieldError, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { useCopy, useLinks } from "~/components/copy-context";
import type { AppCopy } from "../../app-copy";
import { appHref, type AppLinks } from "../../app-links";
import type { StoreView } from "../../view-models";
import { StoreSection } from "./store";
import { needsReconnect } from "./state";

/** Ricollegamento dalla schermata preparatoria, nello stesso ambiente eBay del negozio. */
function reconnectHref(connectHref: string, store: StoreView) {
  const environment = store.sandbox ? "sandbox" : "production";
  return `${connectHref}?ricollega=${encodeURIComponent(store.id)}&environment=${environment}&da=negozi`;
}

/** Azioni del negozio: una colonna di pulsanti uguali, poi le due disconnessioni. */
export function StoreActions({
  store,
  ebayDown,
  connectHref,
  renewsAlone = false,
}: {
  store: StoreView;
  ebayDown: boolean;
  connectHref?: string;
  /** Ultimo negozio collegato con un abbonamento che si rinnova: lo scollegamento lo dice. */
  renewsAlone?: boolean;
}) {
  const { links } = useLinks();
  const { t } = useCopy();
  const disconnected = store.connection === "disconnected";
  return (
    <StoreSection id="store-actions" icon={SlidersHorizontal} title={t.stores.sectionActions}>
      {disconnected ? (
        <div className="grid gap-2">
          <ReconnectButton store={store} ebayDown={ebayDown} connectHref={connectHref} />
        </div>
      ) : store.pauseReason === "plan" ? (
        // La causa della pausa è già spiegata in Sincronizzazione.
        <div className="grid justify-items-start">
          <Link
            to={appHref(links, "impostazioni/piano")}
            {...buttonLink({ variant: "outline", size: "sm" })}
          >
            {t.stores.chooseFreeStore}
          </Link>
        </div>
      ) : store.pauseReason === "admin" ? null : (
        <ReadActions store={store} ebayDown={ebayDown} />
      )}
      {store.connection === "active" ? (
        <p className="text-sm text-muted-foreground">{t.stores.pauseHint}</p>
      ) : null}
      <DisconnectActions store={store} renewsAlone={renewsAlone} />
    </StoreSection>
  );
}

/** Letture a richiesta e pausa, nella stessa forma: pulsanti larghi con icona. */
function ReadActions({ store, ebayDown }: { store: StoreView; ebayDown: boolean }) {
  const { t } = useCopy();
  const action = useAction();
  const ready = useHydrated();
  const look = { variant: "outline" as const, className: "justify-start" };
  const run = (intent: string) => action.run(intent, { store: store.id });
  const reconnect = needsReconnect(store);
  return (
    <div className="grid gap-2">
      {reconnect ? null : (
        <Button
          {...look}
          disabled={!ready || ebayDown || store.syncing || store.connection !== "active"}
          onClick={() => run("store-sync")}
        >
          <RefreshCw aria-hidden="true" data-icon="inline-start" />
          {t.stores.syncNow}
        </Button>
      )}
      <Button
        {...look}
        disabled={!ready || ebayDown || store.syncing || reconnect || store.connection !== "active"}
        onClick={() => run("store-reimport")}
      >
        <History aria-hidden="true" data-icon="inline-start" />
        {t.stores.reimport}
      </Button>
      <PauseButton store={store} className={look.className} />
    </div>
  );
}

/**
 * Metti in pausa o riprendi. Anche un negozio da ricollegare può essere in pausa: il pulsante
 * segue la pausa.
 */
export function PauseButton({
  store,
  size,
  className,
}: {
  store: StoreView;
  size?: "sm";
  className?: string;
}) {
  const { t } = useCopy();
  const action = useAction();
  const ready = useHydrated();
  const paused = store.pauseReason !== undefined;
  return (
    <Button
      variant="outline"
      size={size}
      className={className}
      disabled={!ready}
      onClick={() => action.run(paused ? "store-resume" : "store-pause", { store: store.id })}
    >
      {paused ? (
        <Play aria-hidden="true" data-icon="inline-start" />
      ) : (
        <Pause aria-hidden="true" data-icon="inline-start" />
      )}
      {paused ? t.stores.resume : t.stores.pause}
    </Button>
  );
}

/**
 * Scollega ed elimina negozio; un negozio già scollegato offre solo l'eliminazione.
 * Dopo il successo si torna all'elenco.
 */
function useDisconnectDialog(store: StoreView, t: AppCopy, links: AppLinks) {
  const navigate = useNavigate();
  const [open, setOpen] = useState<"disconnect" | "delete" | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const action = useAction((result) => {
    if (!result.ok) return setFailure(result.notice || t.stores.failed);
    if (open === "delete") void navigate(appHref(links, "negozi"), { preventScrollReset: true });
    setOpen(null);
  });
  const changeOpen = (kind: "disconnect" | "delete", next: boolean) => {
    if (action.pending) return;
    setOpen(next ? kind : null);
    setFailure(null);
    setConfirmName("");
  };
  const run = (intent: string, fields: Record<string, string> = {}) =>
    action.run(intent, { store: store.id, ...fields });
  return { action, open, failure, changeOpen, run, confirmName, setConfirmName };
}

function DisconnectActions({ store, renewsAlone }: { store: StoreView; renewsAlone: boolean }) {
  const { links } = useLinks();
  const { t } = useCopy();
  const { action, open, failure, changeOpen, run, confirmName, setConfirmName } =
    useDisconnectDialog(store, t, links);
  const deleteLabel =
    store.connection === "disconnected" ? t.stores.deleteStore : t.stores.disconnectDelete;
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-2 border-t pt-3">
      {store.connection === "disconnected" ? null : (
        <AlertDialog
          open={open === "disconnect"}
          onOpenChange={(next) => changeOpen("disconnect", next)}
        >
          <AlertDialogTrigger
            render={
              <Button
                variant="destructive"
                className="h-auto min-h-9 justify-start py-2 whitespace-normal text-left"
              />
            }
          >
            <Unplug aria-hidden="true" data-icon="inline-start" />
            {t.stores.disconnect}
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t.stores.disconnectTitle(store.name)}</AlertDialogTitle>
              <AlertDialogDescription>{t.stores.disconnectBody}</AlertDialogDescription>
            </AlertDialogHeader>
            {/* Scollegare l'ultimo negozio non disdice Premium: la disdetta resta nel Piano (§6.2). */}
            {renewsAlone ? (
              <p className="text-sm">
                {t.stores.disconnectSubscription}{" "}
                <Link
                  to={appHref(links, "impostazioni/piano")}
                  className="font-medium underline underline-offset-4"
                >
                  {t.stores.disconnectSubscriptionLink}
                </Link>
              </p>
            ) : null}
            <FieldError>{failure}</FieldError>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={action.pending}>{t.common.cancel}</AlertDialogCancel>
              <Button
                variant="destructive-solid"
                pending={action.pending}
                onClick={() => run("store-disconnect")}
              >
                {action.pending ? t.common.saving : t.stores.disconnect}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      <AlertDialog open={open === "delete"} onOpenChange={(next) => changeOpen("delete", next)}>
        <AlertDialogTrigger
          render={
            <Button
              variant="destructive"
              className="h-auto min-h-9 justify-start py-2 whitespace-normal text-left"
            />
          }
        >
          <Trash2 aria-hidden="true" data-icon="inline-start" />
          {deleteLabel}
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-balance">{deleteLabel}</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{store.name}</strong>. {t.stores.deleteBody}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Field>
            <FieldLabel htmlFor="store-delete-confirm">{t.stores.deleteLabel}</FieldLabel>
            <Input
              id="store-delete-confirm"
              autoComplete="off"
              value={confirmName}
              disabled={action.pending}
              onChange={(event) => setConfirmName(event.target.value)}
            />
          </Field>
          <FieldError>{failure}</FieldError>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={action.pending}>{t.common.cancel}</AlertDialogCancel>
            <Button
              disabled={confirmName.trim() !== store.name}
              pending={action.pending}
              variant="destructive-solid"
              onClick={() => run("store-delete", { conferma: confirmName.trim() })}
            >
              {action.pending ? t.common.saving : deleteLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * Ricollega: nell'area reale apre la schermata preparatoria, nell'anteprima simula l'esito.
 * Nell'avviso del problema è il pulsante piccolo dell'avviso, fra le azioni ha la loro forma.
 */
export function ReconnectButton({
  store,
  ebayDown,
  connectHref,
  prominent = false,
}: {
  store: StoreView;
  ebayDown: boolean;
  connectHref?: string;
  /** Pulsante principale piccolo, negli avvisi e nella scheda del negozio. */
  prominent?: boolean;
}) {
  const { t } = useCopy();
  const action = useAction();
  const look = prominent
    ? { size: "sm" as const }
    : { variant: "outline" as const, className: "justify-start" };
  const content = (
    <>
      {prominent ? null : <Link2 aria-hidden="true" data-icon="inline-start" />}
      {t.stores.reconnect}
    </>
  );
  if (connectHref && !ebayDown) {
    return (
      <Link to={reconnectHref(connectHref, store)} {...buttonLink(look)}>
        {content}
      </Link>
    );
  }
  return (
    <Button
      {...look}
      disabled={ebayDown}
      focusableWhenDisabled
      onClick={() => action.run("store-fix", { store: store.id })}
    >
      {content}
    </Button>
  );
}
