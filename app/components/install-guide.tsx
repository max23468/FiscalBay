import { useEffect, useRef } from "react";

import { buttonVariants } from "~/components/ui/button-variants";

/**
 * Istruzioni per installare l'app dove Safari non propone l'installazione, caricate al primo clic.
 * Il `<dialog>` nativo tiene il focus e si chiude con Esc o con il pulsante; chiuso, sparisce.
 * Riceve i testi già pronti, così il modulo non importa altri componenti condivisi.
 */
export function InstallGuideDialog({
  label,
  text,
  close,
  onClose,
}: {
  label: string;
  text: string;
  close: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => dialog.current?.showModal(), []);
  return (
    <dialog
      ref={dialog}
      aria-label={label}
      onClose={onClose}
      className="m-auto grid w-[min(28rem,calc(100%-2rem))] gap-4 rounded-xl bg-popover p-6 text-popover-foreground shadow-lg backdrop:bg-black/40"
    >
      <p className="leading-relaxed text-pretty">{text}</p>
      <form method="dialog" className="flex justify-end">
        <button type="submit" className={buttonVariants({ variant: "outline" })}>
          {close}
        </button>
      </form>
    </dialog>
  );
}
