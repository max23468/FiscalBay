import { cn } from "cn";
import { Loader2Icon } from "lucide-react";

/**
 * Indicatore decorativo di caricamento: lo stato lo annunciano il testo accanto o il nome del
 * pulsante, quindi resta nascosto ai lettori di schermo. Con «riduci movimento» non gira.
 */
function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2Icon
      data-slot="spinner"
      aria-hidden="true"
      className={cn("size-4 animate-spin motion-reduce:animate-none", className)}
      {...props}
    />
  );
}

export { Spinner };
