# App installabile

## Changelog

### Novità

#### Funzionalità

- **FiscalBay come app.** Da Chrome o Edge puoi installare FiscalBay dal menu del tuo profilo con «Installa l’app»: si apre in una finestra sua, con le scorciatoie per Ordini, Negozi e Impostazioni sull’icona. Su iPhone, iPad e Safari per Mac la stessa voce spiega come aggiungerla alla schermata Home o al Dock.
- **Notifiche sull’icona.** Nell’app installata l’icona mostra quante notifiche hai da leggere, lo stesso numero della campanella; il numero sparisce quando esci dall’account.

### What's new

#### Features

- **FiscalBay as an app.** In Chrome or Edge you can install FiscalBay from your profile menu with «Install the app»: it opens in its own window, with shortcuts to Orders, Stores and Settings on the icon. On iPhone, iPad and Safari for Mac the same item explains how to add it to the Home Screen or the Dock.
- **Notifications on the icon.** In the installed app the icon shows how many notifications you have to read, the same number as the bell; the number goes away when you sign out.

### Altre modifiche

- **App installabile.** Manifest nelle due lingue con icone maskable e schermate, barra del titolo del colore della barra in alto nei due temi, service worker che non conserva pagine né dati e mostra una pagina «Sei offline» quando manca la rete, CSP con service worker e manifest soltanto dall’origine.

## Decisioni

| ID | Ambito | Sintesi della scelta / motivazione | Provenienza | Stato / requisito completo |
|---|---|---|---|---|
| D342 | **App installabile e Microsoft Store** | FiscalBay si installa come web app dal browser e, dopo la sua pubblicazione, dal Microsoft Store come la stessa web app impacchettata: niente app native Windows o macOS, niente offline (§2). Il service worker serve soltanto le navigazioni, senza cache di pagine o dati, con una pagina offline costruita sul momento; la voce «Installa l’app» sta nel menu dell’avatar, senza banner, e dove Safari non propone l’installazione mostra i passi per farla; niente Web Push; le scorciatoie sono Ordini, Negozi e Impostazioni; l’icona maskable è una variante con più margine del simbolo approvato. Il badge dell’icona riporta le notifiche da leggere della campanella e si aggiorna ad app chiusa con l’aggiornamento periodico del browser, con una lettura che non rinnova la sessione e non conta come attività. Scartati Workbox e una cache delle pagine, che simulerebbe disponibilità, e il Window Controls Overlay, che richiede un progetto della barra in alto. | Scelta owner del 2026-11-19 | Confermato · [Requisito](../docs/product/EXPERIENCE.md#s16) |
