import { useState } from "react";
import { Link } from "react-router";

import { useAction } from "~/components/app-shell";
import { StatusAlert } from "~/components/status";
import { Button } from "~/components/ui/button";
import { buttonLink } from "~/components/ui/button-variants";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "~/components/ui/field";
import { RadioGroup } from "~/components/ui/radio-group";
import { Switch } from "~/components/ui/switch";
import type { AppCopy } from "../../app-copy";
import { appHref, type AppLinks } from "../../app-links";
import type { StoreView } from "../../view-models";
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
  telegramChat,
  stores,
  marketing,
  t,
  links,
}: {
  /** Servizio Telegram disponibile. */
  telegram: boolean;
  premium: boolean;
  telegramChat: string | null;
  stores: StoreView[];
  marketing: boolean;
  t: AppCopy;
  links: AppLinks;
}) {
  return (
    <>
      {telegram ? (
        <TelegramGroup premium={premium} chat={telegramChat} stores={stores} t={t} links={links} />
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

function TelegramGroup({
  premium,
  chat,
  stores,
  t,
  links,
}: {
  premium: boolean;
  chat: string | null;
  stores: StoreView[];
  t: AppCopy;
  links: AppLinks;
}) {
  const action = useAction();
  const [mode, setMode, modeState] = useAutoSave<string>("telegram-mode", "each");
  const [digestTime, setDigestTime] = useState("18:00");
  const [enabled, setEnabled, enabledState] = useAutoSave<boolean>("telegram", true);
  return (
    <>
      <Group title={t.settings.notifications.telegramTitle}>
        {!premium ? (
          <StatusAlert tone="premium" title={t.settings.notifications.telegramPremium}>
            <Link
              to={appHref(links, "impostazioni/piano")}
              {...buttonLink({ variant: "outline", size: "sm", className: "mt-2" })}
            >
              {t.settings.plan.buyTitle}
            </Link>
          </StatusAlert>
        ) : (
          <FieldGroup>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm">
              <span className="grid">
                <span className="text-muted-foreground">
                  {t.settings.notifications.telegramChat}
                </span>
                <span className="font-medium">{chat}</span>
              </span>
              <Button variant="outline" size="sm" onClick={() => action.run("telegram-change")}>
                {t.settings.notifications.telegramChange}
              </Button>
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
                  {t.settings.notifications.telegramEnabled}
                </FieldLabel>
                <SaveStatus state={enabledState} t={t} />
              </div>
            </Field>
            <fieldset disabled={!enabled} className="grid gap-5 disabled:opacity-60">
              <AutoRadio
                name="telegram-filter"
                legend={t.settings.notifications.telegramFilter}
                disabled={!enabled}
                initial="fiscal"
                t={t}
                options={[
                  { value: "fiscal", label: t.settings.notifications.telegramFilterFiscal },
                  { value: "all", label: t.settings.notifications.telegramFilterAll },
                ]}
              />
              <FieldSet>
                <FieldLegend variant="label">{t.settings.notifications.telegramMode}</FieldLegend>
                <RadioGroup
                  value={mode}
                  disabled={!enabled || modeState === "saving"}
                  onValueChange={(next) => setMode(String(next))}
                  className="gap-3"
                >
                  <RadioOption value="each">
                    {t.settings.notifications.telegramModeEach}
                  </RadioOption>
                  <RadioOption value="digest">
                    {t.settings.notifications.telegramModeDigest}
                  </RadioOption>
                </RadioGroup>
                <SaveStatus state={modeState} t={t} />
              </FieldSet>
              {mode === "digest" ? (
                <SimpleSelect
                  label={t.settings.notifications.telegramDigestTime}
                  disabled={!enabled}
                  items={["08:00", "12:00", "18:00", "21:00"].map((time) => ({
                    value: time,
                    label: time,
                  }))}
                  value={digestTime}
                  onChange={setDigestTime}
                />
              ) : null}
              <FieldSet>
                <FieldLegend variant="label">{t.settings.notifications.telegramStores}</FieldLegend>
                {stores.map((store) => (
                  <AutoSwitch
                    key={store.id}
                    name={`store-notifications:${store.id}`}
                    label={store.name}
                    initial={store.notifications === true}
                    t={t}
                    disabled={!enabled || store.pauseReason === "plan"}
                  />
                ))}
              </FieldSet>
            </fieldset>
          </FieldGroup>
        )}
      </Group>
    </>
  );
}
