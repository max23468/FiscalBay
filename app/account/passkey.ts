import type { PasskeySignals } from "../domain/passkey-user.server";

/**
 * Client delle passkey, caricato soltanto al momento dell'uso per non pesare sulle pagine; null
 * quando il browser non supporta WebAuthn.
 */
export async function loadPasskeyClient() {
  if (!window.PublicKeyCredential) return null;
  const { authClient } = await import("./passkey-client");
  return authClient;
}

type PasskeyClient = NonNullable<Awaited<ReturnType<typeof loadPasskeyClient>>>;

/** Metodi della Signal API di WebAuthn, presenti soltanto nei browser che la supportano. */
type SignalApi = {
  signalUnknownCredential?: (options: { rpId: string; credentialId: string }) => Promise<void>;
  signalAllAcceptedCredentials?: (options: {
    rpId: string;
    userId: string;
    allAcceptedCredentialIds: string[];
  }) => Promise<void>;
  signalCurrentUserDetails?: (options: {
    rpId: string;
    userId: string;
    name: string;
    displayName: string;
  }) => Promise<void>;
};

function signalApi(): SignalApi | null {
  return (window.PublicKeyCredential as unknown as SignalApi | undefined) ?? null;
}

/**
 * RP ID delle cerimonie: il plugin lo fissa all'hostname dell'origine dell'app e accetta soltanto
 * quell'origine, quindi dove una passkey funziona coincide con l'hostname corrente.
 */
const rpId = () => window.location.hostname;

/** I segnali sono un aiuto al gestore delle passkey: un rifiuto del browser non ferma nulla. */
function ignore(signal: Promise<void> | undefined) {
  void signal?.catch(() => {});
}

/**
 * Accesso con passkey, dal pulsante o dal suggerimento del campo email (`autoFill`). Se il server
 * non conosce la passkey usata, il browser lo sa e può toglierla dal gestore.
 */
export async function signInWithPasskey(client: PasskeyClient, autoFill = false) {
  const result = await client.signIn.passkey({ autoFill, returnWebAuthnResponse: true });
  const code = (result.error as { code?: string } | null)?.code;
  if (code === "PASSKEY_NOT_FOUND" && "webauthn" in result) {
    const api = signalApi();
    ignore(
      api?.signalUnknownCredential?.({ rpId: rpId(), credentialId: result.webauthn.response.id }),
    );
  }
  return result;
}

/** Risposta arrivata dal server: l'errore riguarda la verifica, non la cerimonia nel browser. */
export function verifiedByServer(result: Awaited<ReturnType<typeof signInWithPasskey>>) {
  return "webauthn" in result;
}

/**
 * Suggerimento delle passkey nel campo email: disponibile se il browser supporta la richiesta
 * condizionale, da `getClientCapabilities` o dal controllo precedente.
 */
export async function passkeyAutofillAvailable(): Promise<boolean> {
  const credential = window.PublicKeyCredential as
    | (typeof PublicKeyCredential & {
        getClientCapabilities?: () => Promise<Record<string, boolean | undefined>>;
      })
    | undefined;
  if (!credential) return false;
  try {
    if (credential.getClientCapabilities) {
      return (await credential.getClientCapabilities()).conditionalGet === true;
    }
    return (await credential.isConditionalMediationAvailable?.()) === true;
  } catch {
    return false;
  }
}

/**
 * Elenco delle passkey valide e dati dell'account per il gestore delle passkey: toglie quelle
 * rimosse da FiscalBay e aggiorna email e nome mostrati nel selettore.
 */
export function signalPasskeyState(signals: PasskeySignals) {
  const api = signalApi();
  if (!api) return;
  ignore(
    api.signalAllAcceptedCredentials?.({
      rpId: rpId(),
      userId: signals.userId,
      allAcceptedCredentialIds: signals.credentialIds,
    }),
  );
  ignore(
    api.signalCurrentUserDetails?.({
      rpId: rpId(),
      userId: signals.userId,
      name: signals.name,
      displayName: signals.displayName,
    }),
  );
}
