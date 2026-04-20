# FiscalBay

Linee guida leggere per il brand pubblico del prodotto.

## Brand Core

- nome prodotto: `FiscalBay`
- descrizione breve: `Order tax ID assistant for eBay sellers`
- promessa: aiutare i seller eBay a leggere in modo rapido gli identificativi fiscali presenti negli ordini e a monitorare lo stato operativo del collegamento account
- personalita': affidabile, operativa, chiara, professionale
- tono di voce: diretto, rassicurante, orientato all'azione; evitare tecnicismi inutili quando l'utente sta solo cercando di capire il prossimo passo

## Naming Architecture

- brand pubblico: `FiscalBay`
- piattaforma citata nel copy: `eBay`
- nomi tecnici interni: package `fiscalbay`, entrypoint CLI `fiscalbay*`, path deploy `/opt/fiscalbay`, servizi `fiscalbay-*`

## Messaging

- headline primaria: `FiscalBay`
- payoff primario: `Order tax ID assistant for eBay sellers`
- payoff alternativo: `Monitoraggio Tax ID e ordini per seller eBay`
- messaggio chiave: `FiscalBay rende consultabili e notificabili gli identificativi fiscali restituiti dagli ordini eBay, senza inventare dati che eBay non espone.`

## Visual Direction

- direzione: B2B operativo, pulito, affidabile, con accento data-driven
- evitare: look troppo fiscale tradizionale, stile corporate generico, interfacce grigie senza gerarchia
- simboli candidati: baia stilizzata, documento fiscale, badge verifica, onda dati, radar morbido
- approccio logo: wordmark `FiscalBay` con icona semplice e leggibile anche in avatar Telegram

## Palette

- navy: `#16324F`
- bay blue: `#1F6FA8`
- aqua accent: `#38B6B3`
- sand light: `#F3EFE7`
- ink: `#1E2430`
- success: `#1E8E5A`
- warning: `#C58A18`

## Typography

- titolo brand: sans moderna e pulita
- interfacce e documentazione: privilegiare leggibilita' e contrasto
- stile tipografico: forte gerarchia, pochi pesi, niente effetti decorativi

## Telegram Bot Application

- il nome mostrato nei messaggi di benvenuto e help deve essere `FiscalBay`
- i testi del bot devono chiarire sempre il legame con eBay nel sottotitolo o nel corpo
- l'avatar Telegram deve restare leggibile anche a dimensioni molto piccole
- la UI testuale deve privilegiare:
  - stato account
  - prossima azione consigliata
  - contesto operativo minimo

## UX Writing

- preferire `collega account eBay` invece di formule troppo tecniche
- preferire `prossimo passo` quando il bot richiede un'azione
- evitare claim eccessivi: il prodotto mostra solo dati realmente restituiti da eBay

## Rollout

- fase 1: aggiornare testi visibili nel bot e nella documentazione principale
- fase 2: definire avatar Telegram, logo e set icone
- fase 3: armonizzare README, screenshot e materiali commerciali
