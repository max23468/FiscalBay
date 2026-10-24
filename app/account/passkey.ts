/**
 * Client delle passkey, caricato soltanto al momento dell'uso per non pesare sulle pagine;
 * null quando il browser non supporta WebAuthn.
 */
export async function loadPasskeyClient() {
  if (!window.PublicKeyCredential) return null;
  const { authClient } = await import("./passkey-client");
  return authClient;
}
