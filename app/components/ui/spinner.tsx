import { cn } from "cn";
import { Loader2Icon } from "lucide-react";

/**
 * Indicatore decorativo di caricamento: lo stato lo annunciano il testo accanto o `aria-busy`
 * del pulsante, quindi resta nascosto ai lettori di schermo.
 */
function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2Icon
      data-slot="spinner"
      aria-hidden="true"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
}

export { Spinner };
