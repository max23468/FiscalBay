/** Marchio dal kit ufficiale dei pulsanti di accesso eBay, con proporzioni conservate. */
export function EbayMark() {
  return (
    <img
      src="/ebay-logo.svg"
      alt=""
      aria-hidden="true"
      width="32"
      height="13"
      className="h-auto w-8 shrink-0"
    />
  );
}

/** Marchio Google nei colori ufficiali, come richiesto dalle linee guida del pulsante. */
export function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" data-icon="inline-start" className="size-4">
      <path
        fill="#4285F4"
        d="m23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.8Z"
      />
      <path
        fill="#34A853"
        d="m12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1 .7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="m5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6H1.4a12 12 0 0 0 0 10.9l4-3.1Z" />
      <path
        fill="#EA4335"
        d="m12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z"
      />
    </svg>
  );
}
