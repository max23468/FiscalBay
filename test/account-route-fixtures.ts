import { loader as loadHome } from "../app/routes/home";
import { action as signIn } from "../app/routes/sign-in";
import { action as securityAction } from "../app/routes/security";

export function accessForm(path: string, fields: Record<string, string>, cookie?: string) {
  return signIn({
    request: new Request(`http://localhost:5173${path}`, {
      method: "POST",
      headers: { origin: "http://localhost:5173", ...(cookie ? { cookie } : {}) },
      body: new URLSearchParams(fields),
    }),
  } as Parameters<typeof signIn>[0]) as Promise<Response>;
}

/** Azione della pagina Sicurezza; chi non può vederla riceve il redirect lanciato. */
export function securityForm(path: string, fields: Record<string, string>, cookie?: string) {
  return (
    securityAction({
      request: new Request(`http://localhost:5173${path}`, {
        method: "POST",
        headers: { origin: "http://localhost:5173", ...(cookie ? { cookie } : {}) },
        body: new URLSearchParams(fields),
      }),
    } as Parameters<typeof securityAction>[0]) as Promise<Response>
  ).catch((thrown: unknown) => {
    if (thrown instanceof Response) return thrown;
    throw thrown;
  });
}

export async function homeFor(cookie: string) {
  return loadHome({
    request: new Request("http://localhost:5173/app/ordini", { headers: { cookie } }),
  } as Parameters<typeof loadHome>[0]);
}
