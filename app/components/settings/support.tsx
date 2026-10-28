import { ChevronDown, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import { Link } from "react-router";

import { useAction } from "~/components/action";
import { useFieldErrors } from "~/components/form-validation";
import { StatusAlert } from "~/components/status";
import { Button } from "~/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "~/components/ui/field";
import { Textarea } from "~/components/ui/textarea";
import { useCopy } from "~/components/copy-context";
import { supportEmail } from "../../app-copy";
import { maxSupportMessage, supportFields, supportTopics } from "../../support";
import type { DiagnosticsView } from "../../view-models";
import { CheckboxOption, Group, SimpleSelect } from "./controls";

export function SupportSection({
  support,
  diagnostics,
  email,
  whatsNew,
}: {
  /** Modulo di assistenza disponibile. */
  support: boolean;
  /** Dati tecnici allegabili alla richiesta; null se non è stato possibile leggerli. */
  diagnostics: DiagnosticsView | null;
  email: string;
  /** Pagina Novità, presente soltanto quando ha voci (D203). */
  whatsNew?: string;
}) {
  const { t } = useCopy();
  return (
    <>
      {whatsNew ? (
        <Link
          to={whatsNew}
          className="flex items-center justify-between gap-3 rounded-sm border-y py-3 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring"
        >
          {t.settings.support.whatsNew}
          <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
        </Link>
      ) : null}
      <Group title={t.settings.support.faq}>
        {/* Elenco chiuso da una linea anche in fondo, come in Dati e privacy. */}
        <div className="grid divide-y border-y">
          {t.settings.support.faqItems.map((item) => (
            <details key={item.q} className="group py-1 text-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-sm py-2 font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                {item.q}
                <ChevronDown
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground transition-[rotate] duration-(--duration-quick) group-open:rotate-180"
                />
              </summary>
              <p className="pr-7 pb-2 leading-relaxed text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </Group>
      {support ? (
        <SupportForm email={email} diagnostics={diagnostics} />
      ) : (
        <Group title={t.settings.support.contact} separated={false}>
          <p className="text-sm text-muted-foreground">
            {t.settings.support.supportWrite}{" "}
            <a href={`mailto:${supportEmail}`} className="underline underline-offset-4">
              {supportEmail}
            </a>
            .
          </p>
        </Group>
      )}
    </>
  );
}

function SupportForm({
  email,
  diagnostics,
}: {
  email: string;
  diagnostics: DiagnosticsView | null;
}) {
  const { t } = useCopy();
  const form = useRef<HTMLFormElement>(null);
  // Dopo l'invio riuscito il messaggio si svuota; un rifiuto lo conserva per riprovare.
  const action = useAction((result) => {
    if (result.ok) form.current?.reset();
  });
  const [topic, setTopic] = useState("orders");
  const [error, setError] = useState(false);
  const sent = !error && action.result?.ok === true;
  // Il messaggio è l'unico campo obbligatorio: il suo errore dice cosa manca.
  const v = useFieldErrors({
    ...t.access.validation,
    required: t.settings.support.messageRequired,
  });
  const message = v.control("message");
  const diag = t.settings.support.diag;
  const rows = diagnostics
    ? ([
        [diag.version, diagnostics.version],
        [diag.store, diagnostics.storeRef ?? diag.none],
        [diag.sync, diagnostics.syncPhase],
        [diag.error, diagnostics.errorCode ?? diag.none],
        [diag.rights, diagnostics.rights],
        [diag.reference, diagnostics.correlationId],
      ] as const)
    : null;
  return (
    <>
      <Group title={t.settings.support.contact} className="scroll-mt-20" separated={false}>
        <form
          ref={form}
          className="grid gap-5"
          {...v.form}
          onSubmit={(event) => {
            const area = event.currentTarget.elements.namedItem("message") as HTMLTextAreaElement;
            // Soli spazi valgono come messaggio vuoto.
            if (!area.value.trim()) area.value = "";
            const valid = v.check(event);
            setError(!valid);
            if (!valid) {
              // Il riepilogo degli errori sta in cima al modulo.
              event.currentTarget.parentElement?.scrollIntoView({ block: "start" });
              return;
            }
            event.preventDefault();
            action.run(
              "support",
              supportFields(new FormData(event.currentTarget), {
                topic,
                message: area.value.trim(),
                reference: diagnostics?.correlationId ?? null,
              }),
            );
          }}
        >
          <p className="text-sm text-muted-foreground">{t.access.requiredFields}</p>
          {error ? <StatusAlert tone="danger" title={t.settings.support.formErrors} /> : null}
          {sent ? <StatusAlert tone="success" title={t.settings.support.sent(email)} /> : null}
          <FieldGroup>
            <SimpleSelect
              label={t.settings.support.topic}
              items={supportTopics.map((value) => ({
                value,
                label: t.settings.support.topics[value],
              }))}
              value={topic}
              onChange={setTopic}
            />
            <Field data-invalid={message["aria-invalid"]}>
              <FieldLabel htmlFor="support-message" required>
                {t.settings.support.message}
              </FieldLabel>
              <Textarea
                id="support-message"
                name="message"
                required
                rows={5}
                maxLength={maxSupportMessage}
                placeholder={t.settings.support.messagePlaceholder}
                {...message}
              />
              {v.error("message")}
            </Field>
            <FieldSet>
              <FieldLegend variant="label">{t.settings.support.diagnostics}</FieldLegend>
              {rows ? (
                <>
                  <FieldDescription>{t.settings.support.diagnosticsHint}</FieldDescription>
                  <dl className="grid gap-x-6 gap-y-2 rounded-lg border bg-muted/40 p-3 text-sm sm:grid-cols-[auto_1fr]">
                    {rows.map(([label, value]) => (
                      <div key={label} className="contents">
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="font-code min-w-0 break-words">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <CheckboxOption name="diagnostics" defaultChecked>
                    {t.settings.support.includeDiagnostics}
                  </CheckboxOption>
                </>
              ) : (
                <FieldDescription>{diag.unavailable}</FieldDescription>
              )}
            </FieldSet>
          </FieldGroup>
          <Button type="submit" className="w-fit" disabled={action.pending}>
            {t.settings.support.send}
          </Button>
          <p className="text-sm text-muted-foreground">
            {t.settings.support.supportEmail}{" "}
            <a href={`mailto:${supportEmail}`} className="underline underline-offset-4">
              {supportEmail}
            </a>
            .
          </p>
        </form>
      </Group>
    </>
  );
}
