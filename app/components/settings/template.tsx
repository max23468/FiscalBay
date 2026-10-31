import { cn } from "cn";

import { useHydrated } from "~/components/hydrated";
import { Button } from "~/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Textarea } from "~/components/ui/textarea";
import { useCopy } from "~/components/copy-context";
import { languageNames, languages, type Language } from "../../i18n";
import { maxTemplateLength } from "../../preferences";
import type { Draft } from "./unsaved";

/**
 * Modello di messaggio: si salva con Salva. Un salvataggio non riuscito lascia il testo scritto
 * e lo dice; uno riuscito diventa il nuovo riferimento delle modifiche. La bozza appartiene
 * alla pagina, che ne tiene l'avviso d'uscita.
 */
export function TemplateSection({ form }: { form: Draft<Record<Language, string>> }) {
  const { t } = useCopy();
  const { draft, setDraft, dirty, state, submit, action } = form;
  const empty = languages.some((code) => !draft[code].trim());
  const ready = useHydrated();
  return (
    <div className="grid gap-4">
      <p className="text-sm leading-relaxed text-muted-foreground">
        {t.settings.template.templateIntro}
      </p>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (dirty && !action.pending) submit();
        }}
      >
        <Tabs defaultValue="it">
          <TabsList variant="line">
            {languages.map((code) => (
              <TabsTrigger key={code} value={code} lang={code}>
                {languageNames[code]}
              </TabsTrigger>
            ))}
          </TabsList>
          {languages.map((code) => (
            <TabsContent key={code} value={code} className="pt-3">
              <Field>
                <FieldLabel htmlFor={`template-${code}`} className="sr-only">
                  {languageNames[code]}
                </FieldLabel>
                <Textarea
                  id={`template-${code}`}
                  name={code}
                  rows={5}
                  required
                  maxLength={maxTemplateLength}
                  value={draft[code]}
                  disabled={!ready || action.pending}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setDraft((current) => ({ ...current, [code]: value }));
                  }}
                  aria-describedby="template-hint"
                />
              </Field>
            </TabsContent>
          ))}
        </Tabs>
        <FieldDescription id="template-hint">{t.settings.template.templateHint}</FieldDescription>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={!dirty || empty} pending={action.pending}>
            {action.pending ? t.common.saving : t.common.save}
          </Button>
          <span
            role={state === "error" ? "alert" : "status"}
            className={cn(
              "text-sm",
              state === "error" ? "basis-full text-danger" : "text-muted-foreground",
            )}
          >
            {state === "saved" ? t.settings.saved : null}
            {state === "error"
              ? (action.result?.notice ?? t.settings.template.templateFailed)
              : null}
          </span>
        </div>
      </form>
    </div>
  );
}
