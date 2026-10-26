import { cn } from "cn";
import { Bell } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { StatusIcon } from "~/components/status";
import { Button } from "~/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "~/components/ui/popover";
import { useCopy, useLinks } from "~/components/copy-context";
import { appHref } from "../app-links";
import { formatRelative } from "../format";
import { maxReadNotifications, type NotificationView } from "../view-models";

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
  // Letture di questa pagina, in attesa che il server le riporti nelle notifiche.
  const [readIds, setReadIds] = useState<ReadonlySet<string>>(() => new Set());
  const [open, setOpen] = useState(false);
  const isRead = (item: NotificationView) => item.read || readIds.has(item.id);
  const unread = notifications.filter((item) => !isRead(item)).length;
  const markRead = (items: NotificationView[]) => {
    const ids = items.filter((item) => !isRead(item)).map((item) => item.id);
    if (ids.length === 0) return;
    setReadIds((current) => new Set([...current, ...ids]));
    if (!readAction) return;
    // Nessuna nuova lettura della pagina; `keepalive` regge l'apertura della notifica. Una
    // lettura che il server non registra torna da leggere, invece di sembrare riuscita.
    for (let start = 0; start < ids.length; start += maxReadNotifications) {
      const chunk = ids.slice(start, start + maxReadNotifications);
      const body = new FormData();
      body.set("ids", chunk.join(","));
      void fetch(readAction, { method: "POST", body, keepalive: true })
        .then((response) => response.ok)
        .catch(() => false)
        .then((saved) => {
          if (saved) return;
          setReadIds((current) => {
            const next = new Set(current);
            for (const id of chunk) next.delete(id);
            return next;
          });
        });
    }
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
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
            className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary ring-2 ring-background"
          />
        ) : null}
      </PopoverTrigger>
      {/* Su schermi stretti resta dentro i margini della pagina, quindi centrato. */}
      <PopoverContent align="end" collisionPadding={16} className="w-96 gap-0 p-0">
        <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
          <div className="grid">
            <PopoverTitle>{t.shell.notifications}</PopoverTitle>
            <span className="text-xs text-muted-foreground">{t.shell.notificationsWindow}</span>
          </div>
          {/* Senza notifiche da leggere l'azione non c'è, invece di un pulsante inattivo. */}
          {unread > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => markRead(notifications)}>
              {t.shell.markAllRead}
            </Button>
          ) : null}
        </div>
        {notifications.length === 0 ? (
          <p className="px-3 py-6 text-center text-muted-foreground">
            {t.shell.notificationsEmpty}
          </p>
        ) : (
          <ul className="grid divide-y">
            {notifications.map((item) => {
              const unreadItem = !isRead(item);
              const body = (
                <>
                  <StatusIcon tone={item.tone} className="mt-0.5" />
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
                "grid grid-cols-[1rem_minmax(0,1fr)_0.5rem] gap-3 px-3 py-3 leading-relaxed";
              return (
                <li key={item.id}>
                  {item.href ? (
                    <Link
                      to={appHref(links, item.href)}
                      onClick={() => {
                        markRead([item]);
                        setOpen(false);
                      }}
                      className={cn(
                        itemClass,
                        "outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                      )}
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className={itemClass}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
