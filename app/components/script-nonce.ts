import { useContext } from "react";
import { UNSAFE_FrameworkContext } from "react-router";

/**
 * Nonce della risposta per script e precaricamenti di moduli scritti nel documento dal server, gli
 * stessi a cui React Router lo dà in `<Scripts>`: con `'strict-dynamic'` la CSP ignora l'origine e
 * ammette soltanto quelli. Nel browser vale `undefined`, e il browser nasconde comunque l'attributo
 * dopo il caricamento: gli elementi che lo usano evitano l'avviso di idratazione con
 * `suppressHydrationWarning`.
 */
export function useScriptNonce(): string | undefined {
  return useContext(UNSAFE_FrameworkContext)?.nonce;
}
