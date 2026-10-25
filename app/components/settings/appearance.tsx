import { Moon, Sun, SunMoon } from "lucide-react";
import { useEffect } from "react";
import { Form, useLocation } from "react-router";

import { useHydrated } from "~/components/hydrated";
import { LanguageSwitch } from "~/components/language-switch";
import { RadioGroup } from "~/components/ui/radio-group";
import type { AppCopy } from "../../app-copy";
import { languagePath, type AppLinks } from "../../app-links";
import { languageNames, languages, localizedPath } from "../../i18n";
import { timeZones, zoneLabel, type Theme, type TimeZoneChoice } from "../../preferences";
import { Group, RadioOption, SaveStatus, SimpleSelect, useAutoSave } from "./controls";

/** Tema sul documento: `data-theme` impone chiaro o scuro, senza attributo segue il sistema. */
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
}

/**
 * Lingua dell'account: nell'area reale la scelta si salva e riapre la pagina nella nuova
 * lingua, nell'anteprima cambia soltanto l'indirizzo.
 */
function LanguageChoice({ t, links, preview }: { t: AppCopy; links: AppLinks; preview: boolean }) {
  const location = useLocation();
  const barePath = location.pathname.replace(/^\/en(?=\/|$)/u, "") || "/";
  if (preview) {
    return (
      <LanguageSwitch
        label={t.settings.appearance.language}
        current={links.language}
        hrefFor={(code) => localizedPath(code, barePath)}
      />
    );
  }
  return (
    <Form method="post" action={languagePath} className="flex gap-1 text-sm">
      <input type="hidden" name="returnTo" value={`${location.pathname}${location.search}`} />
      {languages.map((code) => (
        <button
          key={code}
          type="submit"
          name="language"
          value={code}
          lang={code}
          aria-pressed={links.language === code}
          className="inline-flex items-center rounded-md px-2.5 py-1.5 text-muted-foreground outline-none transition-colors duration-(--duration-quick) hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring aria-pressed:bg-secondary aria-pressed:font-medium aria-pressed:text-foreground pointer-coarse:min-h-11"
        >
          {languageNames[code]}
        </button>
      ))}
    </Form>
  );
}

export function AppearanceSection({
  theme: savedTheme,
  timeZone: savedTimeZone,
  detectedTimeZone,
  preview,
  t,
  links,
}: {
  theme: Theme;
  timeZone: TimeZoneChoice;
  /** Fuso del dispositivo, se il browser l'ha già comunicato. */
  detectedTimeZone: string | null;
  preview: boolean;
  t: AppCopy;
  links: AppLinks;
}) {
  // L'anteprima non conserva il tema: la scelta resta sul documento fino alla ricarica.
  const [theme, setTheme, themeState] = useAutoSave<Theme>(
    "theme",
    preview && typeof document !== "undefined"
      ? ((document.documentElement.dataset.theme as Theme | undefined) ?? "system")
      : savedTheme,
  );
  const [timeZone, setTimeZone, zoneState] = useAutoSave<string>("time-zone", savedTimeZone);
  const ready = useHydrated();
  // Anche il ripristino dopo un salvataggio non riuscito torna sul documento.
  useEffect(() => applyTheme(theme), [theme]);
  return (
    <>
      <Group title={t.settings.appearance.theme}>
        <div className="grid gap-2">
          <RadioGroup
            value={theme}
            disabled={!ready || themeState === "saving"}
            onValueChange={(value) => setTheme(value as Theme)}
            className="flex flex-wrap gap-5"
            aria-label={t.settings.appearance.theme}
          >
            {(
              [
                ["system", t.settings.appearance.themeSystem, SunMoon],
                ["light", t.settings.appearance.themeLight, Sun],
                ["dark", t.settings.appearance.themeDark, Moon],
              ] as const
            ).map(([value, label, Icon]) => (
              <RadioOption key={value} value={value}>
                <Icon aria-hidden="true" className="size-4" />
                {label}
              </RadioOption>
            ))}
          </RadioGroup>
          <SaveStatus state={themeState} t={t} />
        </div>
        {preview ? (
          <p className="text-sm text-muted-foreground">{t.settings.appearance.themeNote}</p>
        ) : null}
      </Group>
      <Group title={t.settings.appearance.language}>
        <LanguageChoice t={t} links={links} preview={preview} />
      </Group>
      <Group>
        <div className="grid gap-2">
          <SimpleSelect
            label={t.settings.appearance.timeZone}
            disabled={!ready || zoneState === "saving"}
            items={[
              {
                value: "auto",
                label: t.settings.appearance.timeZoneAuto(zoneLabel(detectedTimeZone, t)),
              },
              ...timeZones.map((zone) => ({
                value: zone,
                label: t.settings.appearance.timeZones[zone],
              })),
            ]}
            value={timeZone}
            onChange={setTimeZone}
          />
          <SaveStatus state={zoneState} t={t} />
        </div>
      </Group>
    </>
  );
}
