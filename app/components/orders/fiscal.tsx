import { Mail, MessageSquareText } from "lucide-react";
import { useId, useRef, useState } from "react";

import { useAction } from "~/components/app-shell";
import { UnlockIcon } from "~/components/icons";
import { StatusAlert, StatusBadge, StatusIcon } from "~/components/status";
import { TaxCode } from "~/components/tax-code";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { buttonLink } from "~/components/ui/button-variants";
import { Checkbox } from "~/components/ui/checkbox";
import { Field, FieldLabel } from "~/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Spinner } from "~/components/ui/spinner";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "cn";
import type { AppCopy } from "../../app-copy";
import { mailtoHref } from "../../contact";
import { languages, languageNames, type Language } from "../../i18n";
import { defaultTemplate, requestEmailSubject } from "../../preferences";
import { displayTaxValue } from "../../tax-quality";
import {
  countryName,
  formatDate,
  type FiscalNotice,
  type FiscalView,
  type OrderView,
  type SuggestionView,
  type TaxIdentifierView,
} from "../../view-models";

import { identifierLabel, remainingUnlocks, taxCodeLabels, type OrdersAccount } from "./labels";
import { useTimeZone } from "~/components/time-zone";

export type { OrdersAccount } from "./labels";

const cardRow = "flex flex-wrap items-center gap-x-3 gap-y-2";

export function CardLabel({ children }: { children: string }) {
  return <p className="text-xs font-medium text-muted-foreground">{children}</p>;
}

/**
 * Spiegazione del dato fiscale. Nella scheda occupa tutta la larghezza sotto
 * acquirente e codice, così non allunga la colonna del codice.
 */
export function CardNote({
  tone,
  children,
}: {
  tone?: "info" | "warning";
  children: React.ReactNode;
}) {
  return (
    <p className="flex gap-1.5 text-sm leading-relaxed text-pretty text-muted-foreground sm:col-span-2">
      {tone ? <StatusIcon tone={tone} className="mt-1 size-3.5" /> : null}
      <span>{children}</span>
    </p>
  );
}

function UnlockButton({
  order,
  t,
  unlocking,
  onUnlock,
  remaining,
  confirmUnlock = true,
}: {
  order: Pick<OrderView, "id" | "ebayOrderId">;
  t: AppCopy;
  unlocking: boolean;
  onUnlock: (ids: string[], skipConfirmation?: boolean) => void;
  remaining: number | null;
  confirmUnlock?: boolean;
}) {
  const [dontAsk, setDontAsk] = useState(false);
  const cancel = useRef<HTMLButtonElement>(null);
  if (!confirmUnlock)
    return (
      <Button
        size="sm"
        className="w-fit"
        disabled={unlocking}
        focusableWhenDisabled
        aria-busy={unlocking || undefined}
        onClick={() => onUnlock([order.id])}
      >
        <UnlockIcon aria-hidden="true" data-icon="inline-start" />
        {t.orders.unlock}
      </Button>
    );
  return (
    <AlertDialog
      onOpenChange={(open) => {
        if (!open) setDontAsk(false);
      }}
    >
      <AlertDialogTrigger
        render={
          <Button
            size="sm"
            className="w-fit"
            disabled={unlocking}
            focusableWhenDisabled
            aria-busy={unlocking || undefined}
          />
        }
      >
        {unlocking ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <UnlockIcon aria-hidden="true" data-icon="inline-start" />
        )}
        {t.orders.unlock}
      </AlertDialogTrigger>
      <AlertDialogContent initialFocus={cancel}>
        <AlertDialogHeader>
          <AlertDialogTitle>{t.orders.unlockTitle(1)}</AlertDialogTitle>
          <AlertDialogDescription>
            {t.orders.orderLabel(order.ebayOrderId)}
            {remaining === null ? null : ` · ${t.orders.unlockConfirmText(1, remaining)}`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            aria-label={t.orders.dontAskUnlock}
            checked={dontAsk}
            onCheckedChange={(checked) => setDontAsk(checked === true)}
          />
          {t.orders.dontAskUnlock}
        </label>
        <AlertDialogFooter>
          <AlertDialogCancel ref={cancel}>{t.common.cancel}</AlertDialogCancel>
          <AlertDialogClose render={<Button />} onClick={() => onUnlock([order.id], dontAsk)}>
            {t.orders.unlockConfirm}
          </AlertDialogClose>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Riquadro della misura del Codice Fiscale per gli stati senza valore. */
function FiscalSlot({ tone, children }: { tone: "neutral" | "info" | "danger"; children: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-10 w-56 max-w-full min-w-fit items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1 text-sm whitespace-nowrap",
        tone === "danger" ? "text-danger" : "text-muted-foreground",
      )}
    >
      <StatusIcon tone={tone} className="size-3.5" />
      {children}
    </span>
  );
}

function IdentifierNote({
  identifier,
  t,
  prefix,
}: {
  identifier: TaxIdentifierView;
  t: AppCopy;
  prefix: string;
}) {
  const { quality } = identifier;
  if (quality !== "valid" && quality !== "unchecked") {
    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-relaxed text-pretty sm:col-span-2">
        <StatusBadge tone="warning">{t.orders.codeToCheck}</StatusBadge>
        <span className="text-muted-foreground">
          {prefix}
          {t.orders.quality[quality]}
        </span>
      </div>
    );
  }
  if (quality === "unchecked") {
    return (
      <CardNote>
        {prefix}
        {t.orders.quality.unchecked}
      </CardNote>
    );
  }
  if (!identifier.updated) return null;
  return (
    <CardNote tone="info">
      {prefix}
      {t.orders.updated}. {t.orders.updatedHint}
    </CardNote>
  );
}

/** Condizione dell'ultima lettura accanto a un valore letto in precedenza. */
function FiscalNoticeNote({ notice, t }: { notice: FiscalNotice; t: AppCopy }) {
  return (
    <CardNote tone={notice === "lastKnown" ? "warning" : "info"}>
      {t.orders.fiscalNotice[notice]}
    </CardNote>
  );
}

/** Note di un dato disponibile: anomalie e modifiche per identificativo, poi l'ultima lettura. */
function AvailableNotes({
  fiscal,
  t,
}: {
  fiscal: Extract<FiscalView, { state: "available" }>;
  t: AppCopy;
}) {
  const several = fiscal.identifiers.length > 1;
  return (
    <>
      {fiscal.identifiers.map((identifier) => (
        <IdentifierNote
          key={`note:${identifier.type}:${identifier.value}`}
          identifier={identifier}
          t={t}
          prefix={several ? `${identifierLabel(identifier, t)}: ` : ""}
        />
      ))}
      {fiscal.notice ? <FiscalNoticeNote notice={fiscal.notice} t={t} /> : null}
    </>
  );
}

/** Contesto comune al dato fiscale di una scheda o del dettaglio. */
export interface FiscalProps {
  order: OrderView;
  t: AppCopy;
  language: Language;
  account: OrdersAccount;
  /** eBay non risponde: le azioni che lo richiedono restano sospese. */
  ebayDown: boolean;
  revealed: boolean;
  unlocking: boolean;
  onUnlock: (ids: string[], skipConfirmation?: boolean) => void;
  confirmUnlock?: boolean;
}

function unavailableTone(state: "missing" | "checking" | "error") {
  return state === "missing" ? "neutral" : state === "checking" ? "info" : "danger";
}

/**
 * Riquadro del dato fiscale con la sua azione: stessa forma per ogni stato,
 * nella scheda accanto all'acquirente e nel dettaglio in cima al pannello.
 * Il valore si mostra e si copia nella forma normalizzata dei tipi italiani.
 */
export function FiscalCodes({
  order,
  t,
  account,
  ebayDown,
  revealed,
  unlocking,
  onUnlock,
  confirmUnlock,
}: FiscalProps) {
  const action = useAction();
  const { fiscal } = order;
  if (fiscal.state === "available") {
    return (
      <div className="grid content-start gap-3">
        {fiscal.identifiers.map((identifier) => {
          const name = identifierLabel(identifier, t);
          return (
            <div key={`${identifier.type}:${identifier.value}`} className="grid gap-1.5">
              <CardLabel>{name}</CardLabel>
              <TaxCode
                value={displayTaxValue(identifier)}
                labels={taxCodeLabels(name, order.ebayOrderId, t)}
                warning={identifier.quality !== "valid" && identifier.quality !== "unchecked"}
                reveal={revealed}
              />
            </div>
          );
        })}
      </div>
    );
  }
  const remaining = remainingUnlocks(account);
  // Senza sblocchi, durante una nuova verifica o prima dell'ordine definitivo non si sblocca.
  const unlockable = fiscal.state === "locked" && remaining !== 0 && !fiscal.hold;
  // Prima dello sblocco il nome è Codice Fiscale, o Partita IVA se l'ordine ha solo quella.
  const label = t.orders.identifier[fiscal.state === "locked" ? fiscal.shownAs : "CF"];
  return (
    <div className="grid content-start gap-1.5">
      <CardLabel>{label}</CardLabel>
      <div className={cardRow}>
        {fiscal.state === "locked" ? (
          <>
            <TaxCode value={null} labels={taxCodeLabels(label, order.ebayOrderId, t)} />
            {unlockable ? (
              <UnlockButton
                order={order}
                t={t}
                unlocking={unlocking}
                onUnlock={onUnlock}
                remaining={remaining}
                confirmUnlock={confirmUnlock}
              />
            ) : null}
          </>
        ) : (
          <>
            <FiscalSlot tone={action.pending ? "info" : unavailableTone(fiscal.state)}>
              {t.orders.fiscal[action.pending ? "checking" : fiscal.state]}
            </FiscalSlot>
            {fiscal.state === "error" ? (
              <Button
                variant="outline"
                size="sm"
                disabled={ebayDown || action.pending}
                focusableWhenDisabled
                onClick={() => action.run("retry", { order: order.id })}
              >
                {t.orders.retry}
              </Button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function unavailableHint(
  fiscal: Extract<FiscalView, { state: "missing" | "checking" | "error" }>,
  ebayDown: boolean,
  t: AppCopy,
  language: Language,
) {
  const { state } = fiscal;
  if (state === "missing") {
    if (fiscal.reason === "foreign")
      return t.orders.missingReason.foreign(countryName(fiscal.country, language));
    return fiscal.reason ? t.orders.missingReason[fiscal.reason] : t.orders.missingHint;
  }
  if (state === "checking") return t.orders.checkingHint;
  return ebayDown ? t.orders.errorHintEbayDown : t.orders.errorHint;
}

/** Ordini rimasti prima dello sblocco; a sblocchi esauriti, quando riprendono. */
function LockedNote({
  fiscal,
  t,
  language,
  account,
  compact,
}: Pick<FiscalProps, "t" | "language" | "account"> & {
  fiscal: Extract<FiscalView, { state: "locked" }>;
  compact: boolean;
}) {
  const zone = useTimeZone();
  if (fiscal.hold) return <CardNote tone="info">{t.orders.lockedHold[fiscal.hold]}</CardNote>;
  const remaining = remainingUnlocks(account);
  if (remaining === null || !account.quota) return null;
  if (remaining > 0) return compact ? null : <CardNote>{t.orders.lockedHint(remaining)}</CardNote>;
  const { cycleEndsAt } = account.quota;
  if (!cycleEndsAt) return null;
  const cycleEnd = formatDate(cycleEndsAt, language, "date", zone);
  return (
    <CardNote>
      {compact ? t.orders.lockedUntil(cycleEnd) : t.orders.lockedExhausted(cycleEnd)}
    </CardNote>
  );
}

function SuggestionSummary({ suggestions, t }: { suggestions: SuggestionView[]; t: AppCopy }) {
  return (
    <>
      {suggestions.map((suggestion) => (
        <CardNote
          key={`${suggestion.sourceOrder}:${suggestion.identifier?.typeLabel}:${suggestion.issuingCountry}:${suggestion.value}`}
          tone={suggestion.conflict ? "warning" : "info"}
        >
          {t.orders.suggestionFrom}{" "}
          {suggestions.length > 1 && suggestion.identifier
            ? `${identifierLabel(suggestion.identifier, t)}: `
            : ""}
          <span className="font-code text-foreground">{suggestionValue(suggestion)}</span>.{" "}
          {suggestion.conflict ? t.orders.suggestionConflict : t.orders.suggestionCheck}
        </CardNote>
      ))}
    </>
  );
}

/** Identificativo suggerito; senza tipo noto è un Codice Fiscale. */
function suggestedIdentifier(suggestion: SuggestionView): TaxIdentifierView {
  return (
    suggestion.identifier ?? { type: "CF", value: suggestion.value, quality: "unchecked" as const }
  );
}

function suggestionValue(suggestion: SuggestionView) {
  return displayTaxValue(suggestedIdentifier(suggestion));
}

/**
 * Spiegazioni del dato fiscale. Nella scheda restano brevi, perché l'avviso
 * in cima alla pagina spiega già le condizioni comuni; nel dettaglio sono complete.
 */
export function FiscalNotes({
  order,
  t,
  language,
  account,
  ebayDown,
  compact,
}: Pick<FiscalProps, "order" | "t" | "language" | "account" | "ebayDown"> & {
  compact: boolean;
}) {
  const { fiscal } = order;
  if (fiscal.state === "available") return <AvailableNotes fiscal={fiscal} t={t} />;
  if (fiscal.state === "locked") {
    return (
      <LockedNote fiscal={fiscal} t={t} language={language} account={account} compact={compact} />
    );
  }
  // Lo stato è già nel riquadro: nella scheda aggiungi solo cause o attese specifiche.
  const showHint =
    !compact ||
    (fiscal.state === "missing" && Boolean(fiscal.reason)) ||
    (fiscal.state === "error" && ebayDown);
  return (
    <>
      {showHint ? <CardNote>{unavailableHint(fiscal, ebayDown, t, language)}</CardNote> : null}
      {compact && fiscal.state === "missing" && order.suggestions.length > 0 ? (
        <SuggestionSummary suggestions={order.suggestions} t={t} />
      ) : null}
    </>
  );
}

const messageLanguages = languages.map((value) => ({ value, label: languageNames[value] }));

/** Solo testo locale e copia esplicita: nessuna modifica all'ordine o messaggistica integrata. */
export function MissingOrderHelp({
  order,
  t,
  language,
  templates,
}: {
  order: Pick<OrderView, "ebayOrderId" | "contacts" | "suggestions" | "suggestionStatus">;
  t: AppCopy;
  language: Language;
  /** Modello di messaggio per lingua; senza, i testi predefiniti. */
  templates?: Record<Language, string>;
}) {
  const zone = useTimeZone();
  // La lingua della pagina inizializza il messaggio; poi decide il merchant.
  const [messageLanguage, setMessageLanguage] = useState<Language>(() => language);
  const defaultMessage = (code: Language) =>
    (templates?.[code] ?? defaultTemplate(code)).replaceAll("{ordine}", order.ebayOrderId);
  const [message, setMessage] = useState(() => defaultMessage(language));
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");
  const fieldId = useId();
  // Un alias eBay passa dalla messaggistica eBay, dove non si chiedono dati personali.
  const { email } = order.contacts;
  // L'oggetto segue la lingua del messaggio.
  const subject = requestEmailSubject(messageLanguage, order.ebayOrderId);
  return (
    <div className="grid min-w-0 grid-cols-1 gap-3">
      {order.suggestions.map((suggestion) => {
        const identifier = suggestedIdentifier(suggestion);
        const label = identifierLabel(identifier, t);
        return (
          <div
            key={`${identifier.type}:${suggestion.issuingCountry}:${suggestion.value}`}
            className="grid gap-2 rounded-lg border bg-card p-3"
          >
            <p className="text-sm font-medium">{t.orders.suggestion}</p>
            <CardLabel>
              {`${label}${suggestion.issuingCountry ? ` (${suggestion.issuingCountry})` : ""}`}
            </CardLabel>
            <TaxCode
              value={displayTaxValue(identifier)}
              labels={taxCodeLabels(label, order.ebayOrderId, t)}
            />
            <p className="text-sm text-muted-foreground">
              {t.orders.suggestionHint(
                suggestion.sourceOrder,
                formatDate(suggestion.sourceDate, language, "date", zone),
              )}
            </p>
            {suggestion.sourceStore ? (
              <p className="text-sm break-words">
                {t.orders.store}: {suggestion.sourceStore}
              </p>
            ) : null}
            {suggestion.source ? (
              <p className="text-xs text-muted-foreground">
                eBay {suggestion.source === "ebay_fulfillment" ? "Fulfillment" : "Trading"}
              </p>
            ) : null}
            {suggestion.conflict ? (
              <StatusAlert tone="warning" title={t.orders.differentCodes}>
                {t.orders.suggestionConflict}
              </StatusAlert>
            ) : null}
            <p className="text-sm text-muted-foreground">{t.orders.suggestionCheck}</p>
          </div>
        );
      })}
      {order.suggestionStatus ? (
        <p className="text-sm text-muted-foreground" role="status">
          {t.orders.suggestionStatus[order.suggestionStatus]}
        </p>
      ) : null}
      <Field>
        <FieldLabel htmlFor={`${fieldId}-language`}>{t.orders.messageLanguage}</FieldLabel>
        <Select
          items={messageLanguages}
          value={messageLanguage}
          onValueChange={(code) => {
            if (code !== "it" && code !== "en") return;
            setMessageLanguage(code);
            setMessage(defaultMessage(code));
            setCopied("idle");
          }}
        >
          <SelectTrigger id={`${fieldId}-language`} className="w-full min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {messageLanguages.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor={fieldId}>{t.orders.messageText}</FieldLabel>
        <Textarea
          id={fieldId}
          rows={6}
          value={message}
          lang={messageLanguage}
          onChange={(event) => {
            setMessage(event.target.value);
            setCopied("idle");
          }}
        />
      </Field>
      <Button
        variant="outline"
        className="h-auto min-h-9 w-fit max-w-full whitespace-normal"
        disabled={!message.trim()}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(message);
            setCopied("copied");
          } catch {
            setCopied("failed");
          }
        }}
      >
        <MessageSquareText aria-hidden="true" data-icon="inline-start" />
        {t.orders.requestMessage}
      </Button>
      {email && !email.relay && message.trim() ? (
        <a
          href={mailtoHref(email.address, { subject, body: message })}
          {...buttonLink({
            variant: "outline",
            className: "h-auto min-h-9 w-fit max-w-full whitespace-normal",
          })}
        >
          <Mail aria-hidden="true" data-icon="inline-start" />
          {t.orders.requestEmail}
        </a>
      ) : null}
      <p role="status" className="text-sm">
        {copied === "copied"
          ? t.orders.requestCopied
          : copied === "failed"
            ? t.orders.messageCopyFailed
            : ""}
      </p>
    </div>
  );
}
