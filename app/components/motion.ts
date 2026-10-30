import type { Transition } from "motion/react";

/**
 * Transizione di Motion con gli stessi valori dei token `--duration-fast` e `--ease-smooth-out`
 * di `app.css`: Motion vuole numeri, non variabili CSS.
 */
export const smoothTransition: Transition = { duration: 0.25, ease: [0.22, 1, 0.36, 1] };
