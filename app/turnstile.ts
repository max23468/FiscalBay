/**
 * Verifica anti-automazione Turnstile (§29) degli invii che mandano un'email o una richiesta al
 * supporto. L'azione distingue il modulo: Siteverify la restituisce e il server la confronta.
 */
export const turnstileActions = {
  signUp: "sign-up",
  passwordReset: "password-reset",
  emailLink: "email-link",
  support: "support",
} as const;

export type TurnstileAction = (typeof turnstileActions)[keyof typeof turnstileActions];

/** Campo del modulo in cui il widget scrive il token. */
export const turnstileField = "cf-turnstile-response";

/** Script del widget, con il rendering esplicito dei soli moduli che lo usano. */
export const turnstileScript =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
