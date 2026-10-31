import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// scrypt con blocco da 1 KiB (r=8) invece dei 2 KiB predefiniti di Better Auth: dimezza la CPU
// di accesso, registrazione e reset (D167). Il prefisso di versione identifica il costo; un hash
// in un altro formato non apre l'accesso e la password si reimposta con il recupero.
const current = { version: "v2", N: 16_384, r: 8 } as const;
const keyLength = 64;

function derive(password: string, salt: string): Promise<Buffer> {
  const { N, r } = current;
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize("NFKC"),
      salt,
      keyLength,
      { N, r, p: 1, maxmem: 256 * N * r },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = await derive(password, salt);
  return `${current.version}:${salt}:${key.toString("hex")}`;
}

export async function verifyPassword({
  hash,
  password,
}: {
  hash: string;
  password: string;
}): Promise<boolean> {
  const [version, salt, key, ...rest] = hash.split(":");
  if (version !== current.version || !salt || !key || rest.length) return false;
  const expected = Buffer.from(key, "hex");
  const actual = await derive(password, salt);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
