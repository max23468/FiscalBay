import { useCopy } from "~/components/copy-context";
import { useTimeZone } from "~/components/time-zone";
import { Button } from "~/components/ui/button";
import type { ActiveSession } from "../../domain/sessions.server";
import { formatDate, formatRelative } from "../../format";
import { Group } from "./controls";
import { MethodRow } from "./security-rows";

/** Sessioni aperte: si chiudono una alla volta o tutte tranne quella in uso, che esce dal menu. */
export function SessionList({
  sessions,
  now,
  actionPath,
}: {
  sessions: ActiveSession[];
  now: string;
  actionPath: string;
}) {
  const zone = useTimeZone();
  const {
    t: { settings },
    language,
  } = useCopy();
  return (
    <Group id="security-sessions" title={settings.security.sessions}>
      <ul className="grid divide-y border-t">
        {sessions.map((session) => (
          <MethodRow
            key={session.id}
            label={session.device}
            hint={
              session.createdAt
                ? settings.security.sessionOpened(
                    formatDate(session.createdAt, language, "dateTime", zone),
                  )
                : undefined
            }
            status={
              session.current
                ? settings.security.thisDevice
                : settings.security.lastActive(formatRelative(session.lastActiveAt, now, language))
            }
          >
            {session.current ? null : (
              <form method="post" action={actionPath}>
                <input type="hidden" name="id" value={session.id} />
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  name="intent"
                  value="esci-sessione"
                >
                  {settings.security.signOutSession}
                </Button>
              </form>
            )}
          </MethodRow>
        ))}
      </ul>
      {sessions.some((session) => !session.current) ? (
        <form method="post" action={actionPath}>
          <Button type="submit" variant="destructive" name="intent" value="esci-altri">
            {settings.security.signOutAll}
          </Button>
        </form>
      ) : null}
    </Group>
  );
}
