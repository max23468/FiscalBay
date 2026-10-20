/**
 * Testi cifrati con una chiave AES-GCM derivata dal segreto server, una per scopo: non
 * coincidono con le chiavi di Better Auth. Il vincolo entra nei dati autenticati, così un
 * testo copiato in un altro contesto non si apre.
 */

export function base64Url(bytes: Uint8Array): string {
  // Stryker disable Regex: in base64 «=» compare solo come riempimento finale.
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
  // Stryker restore Regex
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function sealingKey(secret: string, purpose: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    "HKDF",
    false,
    ["deriveKey"],
  );
  // Stryker disable BooleanLiteral: la chiave non viene mai esportata, estraibile o no.
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(),
      info: new TextEncoder().encode(purpose),
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  // Stryker restore BooleanLiteral
}

/** Vettore iniziale e testo cifrato, in base64url. */
export async function seal(
  secret: string,
  purpose: string,
  boundTo: string,
  text: string,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(boundTo) },
      await sealingKey(secret, purpose),
      new TextEncoder().encode(text),
    ),
  );
  const bytes = new Uint8Array(iv.byteLength + sealed.byteLength);
  bytes.set(iv);
  bytes.set(sealed, iv.byteLength);
  return base64Url(bytes);
}

/** Decifra un testo di `seal`; fallisce per formato, vincolo, scopo o segreto diversi. */
export async function unseal(
  secret: string,
  purpose: string,
  boundTo: string,
  value: string,
): Promise<string> {
  const bytes = fromBase64Url(value);
  const plain = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: bytes.subarray(0, 12),
      additionalData: new TextEncoder().encode(boundTo),
    },
    await sealingKey(secret, purpose),
    bytes.subarray(12),
  );
  return new TextDecoder().decode(plain);
}
