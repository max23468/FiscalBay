import { cn } from "cn";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { useCopy } from "~/components/copy-context";
import { useFieldErrors } from "~/components/form-validation";
import { useHydrated } from "~/components/hydrated";
import { Button } from "~/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Textarea } from "~/components/ui/textarea";

import { languageNames, languages, type Language } from "../../i18n";
import { maxTemplateLength } from "../../preferences";
import type { Draft } from "./unsaved";

/**
 * Modello di messaggio: si salva con Salva. Un salvataggio non riuscito lascia il testo scritto e
 * lo dice; uno riuscito diventa il nuovo riferimento delle modifiche. La bozza appartiene alla
 * pagina, che ne tiene l'avviso d'uscita. Salva si attiva con una modifica, come nel profilo; un
 * testo vuoto porta alla sua lingua con il messaggio accanto al campo.
 */
export function TemplateSection({ form }: { form: Draft<Record<Language, string>> }) {
  const { t } = useCopy();
  const { draft, setDraft, dirty, state, submit, action } = form;
  const ready = useHydrated();
  const v = useFieldErrors(t.access.validation);
  const [tab, setTab] = useState<Language>("it");
  // Lingua con il testo vuoto: la sua scheda si apre, poi il campo riceve errore e focus.
  const [emptyTab, setEmptyTab] = useState<Language | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const rejectEmpty = useEffectEvent((code: Language) => {
    const control = formRef.current?.elements.namedItem(code);
    if (control instanceof HTMLTextAreaElement) v.reject(control, t.access.validation.required);
  });
  useEffect(() => {
    if (!emptyTab || tab !== emptyTab) return;
    rejectEmpty(emptyTab);
    setEmptyTab(null);
  }, [emptyTab, tab]);
  const status =
    state === "error"
      ? (action.result?.notice ?? t.settings.template.templateFailed)
      : state === "saved"
        ? t.settings.saved
        : null;
  return (
    <div className="grid gap-4">
      <p className="text-sm leading-relaxed text-muted-foreground">
        {t.settings.template.templateIntro}
      </p>
      <form
        ref={formRef}
        className="grid gap-4"
        {...v.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (action.pending || !dirty) return;
          const missing = languages.find((code) => !draft[code].trim());
          if (missing) {
            setTab(missing);
            setEmptyTab(missing);
            return;
          }
          submit();
        }}
      >
        <Tabs value={tab} onValueChange={(next) => setTab(next as Language)}>
          <TabsList variant="line" aria-label={t.settings.template.templateLanguage}>
            {languages.map((code) => (
              <TabsTrigger key={code} value={code} lang={code}>
                {languageNames[code]}
              </TabsTrigger>
            ))}
          </TabsList>
          {languages.map((code) => (
            <TabsContent key={code} value={code} keepMounted className="pt-3">
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
                  {...v.control(code, "template-hint")}
                />
                {v.error(code)}
              </Field>
            </TabsContent>
          ))}
        </Tabs>
        <FieldDescription id="template-hint">{t.settings.template.templateHint}</FieldDescription>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={!dirty} pending={action.pending}>
            {action.pending ? t.common.saving : t.common.save}
          </Button>
          <span
            role={state === "error" ? "alert" : "status"}
            className={cn(
              "text-sm",
              state === "error" ? "basis-full text-danger" : "text-muted-foreground",
            )}
          >
            {status}
          </span>
        </div>
      </form>
    </div>
  );
}
