import { cn } from "cn";
import {
  Bell,
  CalendarClock,
  CirclePause,
  CloudOff,
  Download,
  FileText,
  FileX,
  Gift,
  Link2Off,
  Megaphone,
  RefreshCwOff,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import { StatusIcon, type StatusIconType } from "~/components/status";
import { Button } from "~/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "~/components/ui/popover";
import { useCopy, useLinks } from "~/components/copy-context";
import { appHref } from "../app-links";
import { formatRelative } from "../format";
import { maxReadNotifications, type NotificationKind, type NotificationView } from "../view-models";

/** Un'icona per origine; il colore resta quello del tono. */
const kindIcons: Record<NotificationKind, StatusIconType> = {
  "store-expired": Link2Off,
  "store-expiring": CalendarClock,
  "ebay-down": CloudOff,
  "store-read-failed": RefreshCwOff,
  inactivity: CirclePause,
  "export-ready": Download,
  "export-failed": FileX,
  service: Megaphone,
  "whats-new": Gift,
  terms: FileText,
};

/** Quanto resta disponibile «Annulla» dopo un'eliminazione. */
const undoMilliseconds = 6000;

type Intent = "read" | "dismiss" | "restore";

export function NotificationsMenu({
  notifications,
  readAction,
  now,
}: {
  notifications: NotificationView[];
  readAction?: string;
  now: string;
}) {
  const { links } = useLinks();
  const { t } = useCopy();
  // Letture ed eliminazioni di questa pagina, in attesa che il server le riporti nelle notifiche.
  const [readIds, setReadIds] = useState<ReadonlySet<string>>(() => new Set());
  const [dismissedIds, setDismissedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [undo, setUndo] = useState<string[] | null>(null);
  const [open, setOpen] = useState(false);
  const undoButton = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [restored, setRestored] = useState<string | null>(null);
  // Ultima eliminazione inviata: «Annulla» parte dopo, così il server la riceve per seconda.
  const lastDismiss = useRef<Promise<unknown> | null>(null);
  const isRead = (item: NotificationView) => item.read || readIds.has(item.id);
  const visible = notifications.filter((item) => !dismissedIds.has(item.id));
  const unread = visible.filter((item) => !isRead(item)).length;

  // «Annulla» resta per qualche secondo e riceve il focus, così anche da tastiera si recupera.
  useEffect(() => {
    if (!undo) return;
    undoButton.current?.focus();
    const timer = setTimeout(() => setUndo(null), undoMilliseconds);
    return () => clearTimeout(timer);
  }, [undo]);

  // Dopo «Annulla» il focus torna sulla prima notifica ripristinata, non su «Elimina tutte».
  useEffect(() => {
    if (!restored) return;
    list.current
      ?.querySelector<HTMLElement>(`[data-notification="${CSS.escape(restored)}"] button`)
      ?.focus();
    setRestored(null);
  }, [restored]);

  const add = (set: ReadonlySet<string>, ids: string[]) => new Set([...set, ...ids]);
  const remove = (set: ReadonlySet<string>, ids: string[]) => {
    const next = new Set(set);
    for (const id of ids) next.delete(id);
    return next;
  };

  /**
   * Invia la modifica a blocchi del limite del server. Nessuna nuova lettura della pagina;
   * `keepalive` regge l'apertura della notifica. Un blocco che il server non registra torna
   * com'era, invece di sembrare riuscito.
   */
  const send = (
    intent: Intent,
    ids: string[],
    revert: (chunk: string[]) => void,
  ): Promise<unknown> => {
    if (!readAction) return Promise.resolve();
    const requests = [];
    for (let start = 0; start < ids.length; start += maxReadNotifications) {
      const chunk = ids.slice(start, start + maxReadNotifications);
      const body = new FormData();
      body.set("ids", chunk.join(","));
      if (intent !== "read") body.set("intent", intent);
      requests.push(
        fetch(readAction, { method: "POST", body, keepalive: true })
          .then((response) => response.ok)
          .catch(() => false)
          .then((saved) => {
            if (!saved) revert(chunk);
          }),
      );
    }
    return Promise.all(requests);
  };

  const markRead = (items: NotificationView[]) => {
    const ids = items.filter((item) => !isRead(item)).map((item) => item.id);
    if (ids.length === 0) return;
    setReadIds((current) => add(current, ids));
    void send("read", ids, (chunk) => setReadIds((current) => remove(current, chunk)));
  };

  // Eliminata, una notifica conta anche come letta: se torna con «Annulla» è già letta.
  const dismiss = (items: NotificationView[]) => {
    const ids = items.map((item) => item.id);
    if (ids.length === 0) return;
    const unreadIds = items.filter((item) => !isRead(item)).map((item) => item.id);
    setDismissedIds((current) => add(current, ids));
    setReadIds((current) => add(current, unreadIds));
    setUndo(ids);
    lastDismiss.current = send("dismiss", ids, (chunk) => {
      const failed = new Set(chunk);
      setDismissedIds((current) => remove(current, chunk));
      setReadIds((current) =>
        remove(
          current,
          unreadIds.filter((id) => failed.has(id)),
        ),
      );
      setUndo(null);
    });
  };

  const restore = (ids: string[]) => {
    setUndo(null);
    setDismissedIds((current) => remove(current, ids));
    setRestored(ids[0] ?? null);
    void (lastDismiss.current ?? Promise.resolve()).then(() =>
      send("restore", ids, (chunk) => setDismissedIds((current) => add(current, chunk))),
    );
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setUndo(null);
      }}
    >
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={t.shell.notificationsUnread(unread)}
          />
        }
      >
        <Bell aria-hidden="true" />
        {unread > 0 ? (
          <span
            aria-hidden="true"
            className="absolute top-0.5 right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[0.625rem] leading-none font-semibold text-primary-foreground tabular-nums ring-2 ring-background"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </PopoverTrigger>
      {/* Su schermi stretti resta dentro i margini della pagina, quindi centrato. */}
      <PopoverContent align="end" collisionPadding={16} className="w-96 gap-0 p-0">
        {/* Intestazione e azioni restano in vista mentre l'elenco scorre. */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-popover px-3 py-2">
          <div className="grid">
            <PopoverTitle>{t.shell.notifications}</PopoverTitle>
            <span className="text-xs text-muted-foreground">{t.shell.notificationsWindow}</span>
          </div>
          {/* Senza notifiche da leggere l'azione non c'è, invece di un pulsante inattivo. */}
          {unread > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => markRead(visible)}>
              {t.shell.markAllRead}
            </Button>
          ) : null}
        </div>
        {visible.length === 0 ? (
          <div className="grid justify-items-center gap-2 px-3 py-6 text-center text-muted-foreground">
            <Bell aria-hidden="true" className="size-6" />
            <p>{t.shell.notificationsEmpty}</p>
          </div>
        ) : (
          <ul ref={list} className="grid divide-y">
            {visible.map((item) => {
              const unreadItem = !isRead(item);
              const body = (
                <>
                  <StatusIcon tone={item.tone} icon={kindIcons[item.kind]} className="mt-0.5" />
                  <span className="grid min-w-0 gap-0.5">
                    <span className={cn("text-pretty", unreadItem && "font-medium")}>
                      {item.title}
                    </span>
                    <span className="text-pretty text-muted-foreground">{item.body}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatRelative(item.at, now, links.language)}
                    </span>
                  </span>
                  {unreadItem ? (
                    <span
                      aria-hidden="true"
                      className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
                    />
                  ) : null}
                </>
              );
              const itemClass =
                "grid min-w-0 flex-1 grid-cols-[1rem_minmax(0,1fr)_0.5rem] gap-3 py-3 pl-3 leading-relaxed";
              return (
                <li
                  key={item.id}
                  data-notification={item.id}
                  className="flex items-start has-[a:hover]:bg-muted"
                >
                  {item.href ? (
                    <Link
                      to={appHref(links, item.href)}
                      onClick={() => {
                        markRead([item]);
                        setOpen(false);
                      }}
                      className={cn(
                        itemClass,
                        "outline-none focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                      )}
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className={itemClass}>{body}</div>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="mx-1.5 mt-2 shrink-0 text-muted-foreground"
                    aria-label={t.shell.dismissNotification(item.title)}
                    onClick={() => dismiss([item])}
                  >
                    <X aria-hidden="true" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        {/* Piede fisso: «Elimina tutte» resta sempre; dopo un'eliminazione «Annulla» le sta accanto. */}
        {undo || visible.length > 0 ? (
          <div className="sticky bottom-0 z-10 flex min-h-11 items-center justify-between gap-3 border-t bg-popover px-3 py-1.5">
            <div className="flex min-w-0 items-center gap-1">
              <span role="status" className="truncate text-muted-foreground">
                {undo ? t.shell.dismissed(undo.length) : ""}
              </span>
              {undo ? (
                <Button ref={undoButton} variant="ghost" size="sm" onClick={() => restore(undo)}>
                  {t.shell.undo}
                </Button>
              ) : null}
            </div>
            {visible.length > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={() => dismiss(visible)}
              >
                {t.shell.dismissAll}
              </Button>
            ) : null}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
