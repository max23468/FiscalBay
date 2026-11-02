/** Ambiente, API e chiamata, o ambiente, regione e categoria di dati, separati da punti. */
export const subjectLabel = (subject: string) =>
  subject.replace("production", "Production").replace("sandbox", "Sandbox").replaceAll(":", " · ");
