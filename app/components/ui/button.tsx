import { Button as ButtonPrimitive } from "@base-ui/react/button";
import type { VariantProps } from "class-variance-authority";
import { cn } from "cn";

import { useCopy } from "~/components/copy-context";
import { buttonVariants } from "~/components/ui/button-variants";
import { Spinner } from "~/components/ui/spinner";

/**
 * `pending` segna la richiesta partita dal pulsante: resta raggiungibile ma non si ripete,
 * mostra lo spinner al posto dell'icona iniziale e aggiunge l'attesa al nome accessibile,
 * perché `aria-busy` da solo non viene letto da tutti i lettori di schermo.
 */
function Button({
  className,
  variant = "default",
  size = "default",
  pending = false,
  disabled,
  focusableWhenDisabled,
  children,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants> & { pending?: boolean }) {
  const { t } = useCopy();
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(
        buttonVariants({ variant, size, className }),
        pending && "*:data-[icon=inline-start]:not-data-[slot=spinner]:hidden",
      )}
      disabled={disabled || pending}
      focusableWhenDisabled={focusableWhenDisabled || pending}
      aria-busy={pending || undefined}
      {...props}
    >
      {pending ? <Spinner data-icon="inline-start" /> : null}
      {children}
      {pending ? <span className="sr-only">, {t.shell.pending}</span> : null}
    </ButtonPrimitive>
  );
}

export { Button };
