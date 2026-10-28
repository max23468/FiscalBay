import { Button as ButtonPrimitive } from "@base-ui/react/button";
import type { VariantProps } from "class-variance-authority";
import { cn } from "cn";

import { buttonVariants } from "~/components/ui/button-variants";
import { Spinner } from "~/components/ui/spinner";

/**
 * `pending` segna la richiesta partita dal pulsante: resta raggiungibile ma non si ripete,
 * annuncia l'attesa con `aria-busy` e mostra lo spinner al posto dell'icona iniziale.
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
    </ButtonPrimitive>
  );
}

export { Button };
