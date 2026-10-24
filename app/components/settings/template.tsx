import { cn } from "cn";
import { useEffect } from "react";

import { useHydrated } from "~/components/hydrated";
import { Button } from "~/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Textarea } from "~/components/ui/textarea";
import type { AppCopy } from "../../app-copy";
import { languageNames, languages, type Language } from "../../i18n";
import { maxTemplateLength } from "../../preferences";
import { useDraft, type ReportDraft } from "./unsaved";

/**
 * Modello di messaggio: si salva con Salva. Un salvataggio non riuscito lascia il testo scritto
 * e lo dice; uno riuscito diventa il nuovo riferimento delle modifiche.
 */
export function TemplateSection({
  templates,
  t,
  onDraft,
}: {
  templates: Record<Language, string>;
  t: AppCopy;
  onDraft: ReportDraft;
}) {
  const { draft, setDraft, dirty, state, submit, action } = useDraft(templates, "template");
  useEffect(
    () => onDraft("messaggio", { dirty, pending: action.pending }),
    [onDraft, dirty, action.pending],
  );
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
          <Button
            type="submit"
            disabled={!dirty || empty || action.pending}
            aria-busy={action.pending || undefined}
          >
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
