import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

type Cost = { N: number; r: number };

// scrypt con blocco da 1 KiB (r=8) invece dei 2 KiB predefiniti di Better Auth: dimezza la CPU
// di accesso, registrazione e reset (D167). Il prefisso distingue questi hash da quelli già
// salvati nel formato di Better Auth, `sale:chiave`, che si verificano con il costo originario.
const current = { version: "v2", N: 16_384, r: 8 } as const;
const original: Cost = { N: 16_384, r: 16 };
const keyLength = 64;

function derive(password: string, salt: string, { N, r }: Cost): Promise<Buffer> {
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
  const key = await derive(password, salt, current);
  return `${current.version}:${salt}:${key.toString("hex")}`;
}

export async function verifyPassword({
  hash,
  password,
}: {
  hash: string;
  password: string;
}): Promise<boolean> {
  const parts = hash.split(":");
  const [salt, key, cost] =
    parts.length === 3 && parts[0] === current.version
      ? [parts[1], parts[2], current]
      : parts.length === 2
        ? [parts[0], parts[1], original]
        : [];
  if (!salt || !key || !cost) return false;
  const expected = Buffer.from(key, "hex");
  const actual = await derive(password, salt, cost);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
