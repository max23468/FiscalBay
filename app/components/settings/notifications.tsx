import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Link, useRevalidator } from "react-router";

import { useAction, useNotice } from "~/components/app-shell";
import { StatusAlert } from "~/components/status";
import { Button } from "~/components/ui/button";
import { buttonLink } from "~/components/ui/button-variants";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "~/components/ui/field";
import { RadioGroup } from "~/components/ui/radio-group";
import { Switch } from "~/components/ui/switch";
import type { AppCopy } from "../../app-copy";
import { appHref, type AppLinks } from "../../app-links";
import { telegramDigestTimes, telegramLinkMinutes, zoneLabel } from "../../preferences";
import type { TelegramView } from "../../view-models";
import {
  AutoRadio,
  AutoSwitch,
  Group,
  RadioOption,
  SaveStatus,
  SimpleSelect,
  useAutoSave,
} from "./controls";

export function NotificationsSection({
  telegram,
  premium,
  preview,
  marketing,
  t,
  links,
}: {
  /** Notifiche Telegram dello spazio; null senza il servizio. */
  telegram: TelegramView | null;
  premium: boolean;
  preview: boolean;
  marketing: boolean;
  t: AppCopy;
  links: AppLinks;
}) {
  return (
    <>
      {telegram ? (
        <TelegramGroup premium={premium} view={telegram} preview={preview} t={t} links={links} />
      ) : null}
      <Group title={t.settings.notifications.marketingTitle}>
        <AutoSwitch
          name="marketing"
          label={t.settings.notifications.marketingConsent}
          description={t.settings.notifications.marketingHint}
          initial={marketing}
          t={t}
        />
      </Group>
    </>
  );
}

/**
 * Attesa del collegamento dopo l'apertura del deep link: la pagina si rilegge finché la chat
 * collegata non cambia o il link non scade, e annuncia la chat nuova.
 */
function useLinkWait(linkedAt: string | null, t: AppCopy) {
  const revalidator = useRevalidator();
  const notify = useNotice();
  const [wait, setWait] = useState<{ from: string | null; until: number } | null>(null);
  const until = wait !== null && wait.from === linkedAt ? wait.until : null;
  const reload = useEffectEvent(() => {
    if (document.visibilityState === "visible" && revalidator.state === "idle")
      void revalidator.revalidate();
  });
  // Un annuncio per attesa: un cambio successivo, da un'altra scheda, non lo ripete.
  const announced = useRef<typeof wait>(null);
  const linked = useEffectEvent(() => {
    if (!wait || wait.from === linkedAt || announced.current === wait) return;
    announced.current = wait;
    notify(t.settings.notifications.telegramLinked);
  });
  useEffect(() => linked(), [linkedAt]);
  useEffect(() => {
    if (until === null) return;
    const timer = setInterval(reload, 4000);
    const expiry = setTimeout(() => setWait(null), until - Date.now());
    document.addEventListener("visibilitychange", reload);
    return () => {
      clearInterval(timer);
      clearTimeout(expiry);
      document.removeEventListener("visibilitychange", reload);
    };
  }, [until]);
  return {
    pending: until !== null,
    begin: () => setWait({ from: linkedAt, until: Date.now() + telegramLinkMinutes * 60_000 }),
  };
}

/**
 * Apre il bot con un nuovo deep link. Il modulo apre una nuova scheda, così la pagina resta qui
 * ad aspettare il collegamento; nell'anteprima l'azione è simulata.
 */
function ConnectButton({
  label,
  variant,
  preview,
  onStart,
}: {
  label: string;
  variant: "default" | "outline";
  preview: boolean;
  onStart: () => void;
}) {
  const action = useAction();
  if (preview)
    return (
      <Button variant={variant} size="sm" onClick={() => action.run("telegram-link")}>
        {label}
      </Button>
    );
  return (
    <form method="post" target="_blank" rel="noopener" onSubmit={onStart}>
      <input type="hidden" name="intent" value="telegram-link" />
      <Button type="submit" variant={variant} size="sm">
        {label}
      </Button>
    </form>
  );
}

function TelegramGroup({
  premium,
  view,
  preview,
  t,
  links,
}: {
  premium: boolean;
  view: TelegramView;
  preview: boolean;
  t: AppCopy;
  links: AppLinks;
}) {
  const copy = t.settings.notifications;
  const wait = useLinkWait(view.chat?.linkedAt ?? null, t);
  return (
    <Group title={copy.telegramTitle}>
      {!premium ? (
        <StatusAlert tone="premium" title={copy.telegramPremium}>
          <Link
            to={appHref(links, "impostazioni/piano")}
            {...buttonLink({ variant: "outline", size: "sm", className: "mt-2" })}
          >
            {t.settings.plan.buyTitle}
          </Link>
        </StatusAlert>
      ) : !view.chat ? (
        <div className="grid justify-items-start gap-2">
          <ConnectButton
            label={copy.telegramConnect}
            variant="default"
            preview={preview}
            onStart={wait.begin}
          />
          <p role="status" className="text-sm text-muted-foreground empty:hidden">
            {wait.pending ? copy.telegramPending : ""}
          </p>
        </div>
      ) : (
        <TelegramPreferences
          key={view.chat.linkedAt}
          view={view}
          preview={preview}
          pending={wait.pending}
          onStart={wait.begin}
          t={t}
        />
      )}
    </Group>
  );
}

function TelegramPreferences({
  view,
  preview,
  pending,
  onStart,
  t,
}: {
  view: TelegramView;
  preview: boolean;
  pending: boolean;
  onStart: () => void;
  t: AppCopy;
}) {
  const copy = t.settings.notifications;
  const [mode, setMode, modeState] = useAutoSave<string>("telegram-mode", view.mode);
  const [digestTime, setDigestTime, timeState] = useAutoSave<string>(
    "telegram-digest-time",
    view.digestTime,
  );
  const [enabled, setEnabled, enabledState] = useAutoSave<boolean>("telegram", view.enabled);
  return (
    <FieldGroup>
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm">
          <span className="grid">
            <span className="text-muted-foreground">{copy.telegramChat}</span>
            <span className="font-medium">{view.chat?.label ?? copy.telegramChatUnnamed}</span>
          </span>
          <ConnectButton
            label={copy.telegramChange}
            variant="outline"
            preview={preview}
            onStart={onStart}
          />
        </div>
        <p role="status" className="text-sm text-muted-foreground empty:hidden">
          {pending ? copy.telegramChangePending : ""}
        </p>
      </div>
      <Field orientation="horizontal" className="items-start">
        <Switch
          id="telegram-enabled"
          checked={enabled}
          onCheckedChange={setEnabled}
          disabled={enabledState === "saving"}
          aria-labelledby="telegram-enabled-label"
        />
        <div className="grid min-w-0 flex-1 gap-1">
          <FieldLabel
            id="telegram-enabled-label"
            htmlFor="telegram-enabled"
            className="font-normal"
          >
            {copy.telegramEnabled}
          </FieldLabel>
          <SaveStatus state={enabledState} t={t} />
        </div>
      </Field>
      <fieldset disabled={!enabled} className="grid gap-5 disabled:opacity-60">
        <AutoRadio
          name="telegram-filter"
          legend={copy.telegramFilter}
          disabled={!enabled}
          initial={view.filter}
          t={t}
          options={[
            { value: "fiscal", label: copy.telegramFilterFiscal },
            { value: "all", label: copy.telegramFilterAll },
          ]}
        />
        <FieldSet>
          <FieldLegend variant="label">{copy.telegramMode}</FieldLegend>
          <RadioGroup
            value={mode}
            disabled={!enabled || modeState === "saving"}
            onValueChange={(next) => setMode(String(next))}
            className="gap-3"
          >
            <RadioOption value="each">{copy.telegramModeEach}</RadioOption>
            <RadioOption value="digest">{copy.telegramModeDigest}</RadioOption>
          </RadioGroup>
          <SaveStatus state={modeState} t={t} />
        </FieldSet>
        {mode === "digest" ? (
          <div className="grid gap-2">
            <SimpleSelect
              label={copy.telegramDigestTime}
              hint={copy.telegramDigestZone(zoneLabel(view.timeZone, t) ?? view.timeZone)}
              disabled={!enabled || timeState === "saving"}
              items={telegramDigestTimes.map((time) => ({ value: time, label: time }))}
              value={digestTime}
              onChange={setDigestTime}
            />
            <SaveStatus state={timeState} t={t} />
          </div>
        ) : null}
        {view.stores.length > 0 ? (
          <FieldSet>
            <FieldLegend variant="label">{copy.telegramStores}</FieldLegend>
            {view.stores.map((store) => (
              <AutoSwitch
                key={store.id}
                name={`store-notifications:${store.id}`}
                label={store.name}
                initial={store.enabled}
                t={t}
                disabled={!enabled || store.paused}
              />
            ))}
          </FieldSet>
        ) : null}
      </fieldset>
    </FieldGroup>
  );
}
