/** Forme comuni ai testi di entrambe le lingue. */

export const plural = (count: number, one: string, other: string) => (count === 1 ? one : other);

/** Data estesa di un documento legale, in UTC come la versione da cui deriva. */
export const legalDate = (locale: string, value: string) =>
  new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
