# FiscalBay

Linee guida operative per il brand pubblico del prodotto e per la sua applicazione nel bot Telegram.

## Brand Core

- nome prodotto: `FiscalBay`
- descrizione breve: `Assistente fiscale ordini per venditori eBay`
- promessa: aiutare i seller eBay a leggere rapidamente identificativi fiscali, stato account e segnali operativi
- personalita': affidabile, operativa, chiara, professionale
- tono di voce: diretto, rassicurante, orientato al prossimo passo

## Posizionamento

- categoria: assistente operativo B2B per seller eBay
- percezione desiderata: strumento serio, utile ogni giorno, non "botino tecnico"
- vantaggio chiave: rende consultabili e notificabili i dati fiscali presenti negli ordini eBay in un flusso Telegram semplice
- messaggio chiave: `FiscalBay rende piu' rapido il controllo operativo di identificativi fiscali, account e ordini eBay in Telegram.`

## Naming Architecture

- brand pubblico: `FiscalBay`
- piattaforma citata nel copy: `eBay`
- nomi tecnici interni: package `fiscalbay`, entrypoint CLI `fiscalbay*`, path deploy `/opt/fiscalbay`, servizi `fiscalbay-*`

## Voice And Copy

- apri i messaggi spiegando cosa succede e cosa fare dopo
- preferisci `collega account eBay` invece di formule piu' tecniche
- preferisci `prossimo passo` quando il bot richiede un'azione
- evita claim eccessivi o promesse di dati non disponibili
- quando possibile, separa stato, contesto e azione in tre righe chiare

### Esempi di tono

- bene: `Il tuo accesso e' attivo e l'account eBay risulta collegato.`
- bene: `Prossimo passo: usa /account collega per completare il reconnect.`
- da evitare: `Sistema correttamente inizializzato.`
- da evitare: `L'utente non possiede capability sufficienti.`

## Visual Direction

- direzione: B2B operativo, pulito, affidabile, con accento data-driven
- concept approvato: `Seller Card`
- simboli guida: tessera/documento fiscale, accenti marketplace, wordmark sobrio, avatar circolare
- evitare: estetica notarile, icone troppo complesse, look fintech generico, grigi piatti senza gerarchia
- approccio logo: wordmark `FiscalBay` con tessera inclinata, leggibile e compatta

## Palette

- navy: `#16324F`
- bay blue: `#1F6FA8`
- aqua accent: `#38B6B3`
- sand light: `#F3EFE7`
- ink: `#1E2430`
- success: `#1E8E5A`
- warning: `#C58A18`

### Uso consigliato palette

- `navy` per sfondi principali, avatar, base del mark e header forti
- `bay blue` per accenti prodotto, titoli secondari e primo livello informativo
- `aqua accent` per dettagli freschi e supporto visivo, non come colore dominante
- `sand light` per sfondi chiari, preview logo e materiali editoriali
- `success` e `warning` solo per stati funzionali, non come colori di brand primari

## Typography

- stile: sans moderna, chiara, leggibile
- priorita': gerarchia netta, pochi pesi, alto contrasto
- uso consigliato nei materiali: titoli compatti, corpo testo sobrio, nessun effetto decorativo

## Asset Repository

Asset sorgente pronti all'uso:

- logo orizzontale: `assets/branding/fiscalbay-logo.svg`
- mark/icona: `assets/branding/fiscalbay-mark.svg`
- avatar Telegram: `assets/branding/fiscalbay-avatar.svg`
- variante logo scuro: `assets/branding/fiscalbay-logo-dark.svg`
- export PNG: `assets/branding/exports/*`

Il set finale unisce tre segnali:

- una tessera bianca inclinata come richiamo ai dati fiscali ordine
- piccoli accenti colore che evocano il mondo eBay senza imitarne il logo
- una base navy molto solida, per dare affidabilita' e leggibilita' in piccolo

## Telegram Application

Superfici gestite automaticamente dal runtime:

- nome visualizzato bot: `FiscalBay`
- descrizione breve del profilo
- descrizione estesa del profilo
- menu comandi Telegram

Configurazione:

- env opzionale: `TELEGRAM_SYNC_BRANDING=1`
- default: branding sync attivo con controllo idempotente; riallinea Telegram solo quando il profilo cambia
- in caso di `429 Too Many Requests`, il bot salva un backoff temporaneo per evitare retry inutili ai riavvii successivi
- se vuoi disattivarlo temporaneamente: `TELEGRAM_SYNC_BRANDING=0`

Superfici non aggiornabili via Telegram Bot API e quindi manuali:

- avatar del bot
- username `@...`

Per queste due superfici usare BotFather e gli asset in `assets/branding/`.

## Telegram UX Rules

- il nome mostrato nei messaggi di benvenuto e help deve essere sempre `FiscalBay`
- i testi devono chiarire sempre il legame con eBay nel sottotitolo o nel corpo
- il menu rapido deve privilegiare account, ordini e stato
- l'avatar deve restare leggibile a dimensioni molto piccole

### Microcopy approvato

- tagline: `Assistente fiscale ordini per venditori eBay`
- sottotitolo operativo: `Controlla identificativi fiscali, stato account e ordini eBay da un'unica chat.`
- promessa corta: `FiscalBay ti aiuta a controllare account e ordini eBay piu' rapidamente.`
- CTA primaria sito: `Apri Telegram`
- CTA secondaria sito: `Come funziona`

### Pulsanti e label

- `Ordini fiscali`
- `Tutti ordini`
- `Stato bot`
- `Account eBay`
- `Apri Telegram`
- `Scollega`
- `Preferenze`
- `Guida`

## Asset Operativi

Export pronti all'uso da mantenere allineati al set finale:

- `assets/branding/exports/fiscalbay-avatar-telegram-512.png`
- `assets/branding/exports/fiscalbay-mark-512.png`
- `assets/branding/exports/fiscalbay-logo-light-2048.png`
- `assets/branding/exports/fiscalbay-logo-dark-2048.png`

Uso consigliato:

- `avatar-telegram-512.png` per BotFather e profilo bot
- `mark-512.png` per favicon, icona compatta o preview piccole
- `logo-light-2048.png` per README, documentazione e sfondi chiari
- `logo-dark-2048.png` per presentazioni o sfondi scuri

## Rollout

- fase 1: aggiornare testi visibili nel bot e profilo Telegram
- fase 2: impostare avatar e username definitivi via BotFather
- fase 3: armonizzare README, screenshot e materiali commerciali
