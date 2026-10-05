export type EbayEnvironment = "production" | "sandbox";

type EbayBindings = {
  APP_ORIGIN: string;
  EBAY_CLIENT_ID: string;
  EBAY_CLIENT_SECRET: string;
  EBAY_RUNAME: string;
  EBAY_SANDBOX_ENABLED?: string;
  EBAY_SANDBOX_CLIENT_ID?: string;
  EBAY_SANDBOX_CLIENT_SECRET?: string;
  EBAY_SANDBOX_RUNAME?: string;
};

export function sandboxAvailable(env: EbayBindings): boolean {
  return (
    ["test.fiscalbay.it", "localhost", "127.0.0.1", "[::1]"].includes(
      new URL(env.APP_ORIGIN).hostname,
    ) &&
    env.EBAY_SANDBOX_ENABLED === "true" &&
    Boolean(env.EBAY_SANDBOX_CLIENT_ID && env.EBAY_SANDBOX_CLIENT_SECRET && env.EBAY_SANDBOX_RUNAME)
  );
}

export function ebayConfiguration(env: EbayBindings, environment: EbayEnvironment) {
  if (environment === "sandbox" && !sandboxAvailable(env))
    throw new Error("ebay_sandbox_unavailable");
  const sandbox = environment === "sandbox";
  const api = sandbox ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
  return {
    clientId: sandbox ? env.EBAY_SANDBOX_CLIENT_ID! : env.EBAY_CLIENT_ID,
    clientSecret: sandbox ? env.EBAY_SANDBOX_CLIENT_SECRET! : env.EBAY_CLIENT_SECRET,
    runame: sandbox ? env.EBAY_SANDBOX_RUNAME! : env.EBAY_RUNAME,
    authorizationUrl: sandbox
      ? "https://auth.sandbox.ebay.com/oauth2/authorize"
      : "https://auth.ebay.com/oauth2/authorize",
    tokenUrl: `${api}/identity/v1/oauth2/token`,
    identityUrl: sandbox
      ? "https://apiz.sandbox.ebay.com/commerce/identity/v1/user/"
      : "https://apiz.ebay.com/commerce/identity/v1/user/",
    ordersUrl: `${api}/sell/fulfillment/v1/order?limit=1`,
    tradingUrl: `${api}/ws/api.dll`,
  };
}
