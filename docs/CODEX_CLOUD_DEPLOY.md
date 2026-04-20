# Deploy Da Codex Cloud

Questa guida serve per usare `chatgpt.com` come postazione di lavoro e deploy senza dipendere dal Mac locale.

## Stato attuale

Il deploy SSH diretto dal runtime Codex cloud verso la VPS non e affidabile, e in piu i secret applicativi non risultano disponibili nei task shell cloud in modo consistente.

Il percorso consigliato quindi e:

1. Codex cloud prepara e pubblica il codice su GitHub.
2. GitHub Actions sincronizza il repository sulla VPS via SSH.
3. La VPS applica installazione o aggiornamento locale senza fare `git pull`.
4. GitHub Actions riavvia i servizi e lancia lo smoke check dalla VPS.

## Flusso consigliato da mobile

Per deploy ordinari:

1. fai lavorare Codex sul branch desiderato
2. porta la modifica su `main`
3. il workflow GitHub `Deploy VPS` parte automaticamente al push su `main`

Per deploy manuali o di una revisione specifica:

- usa il workflow `Deploy VPS` in GitHub Actions con `workflow_dispatch`
- passa `target_ref` se vuoi deployare un commit o ref specifico

Questo flusso non richiede accesso dal runtime Codex cloud alla rete privata della VPS: il ponte lo fa GitHub Actions.

## Secret richiesti in GitHub Actions

Configura questi secret nel repository GitHub:

- `FISCALBAY_VPS_HOST`
- `FISCALBAY_VPS_USER`
- `FISCALBAY_VPS_PORT`
- `FISCALBAY_VPS_SSH_PRIVATE_KEY_B64`
- `FISCALBAY_VPS_SSH_KNOWN_HOSTS`

Note operative:

- `FISCALBAY_VPS_HOST` e obbligatorio
- `FISCALBAY_VPS_SSH_PRIVATE_KEY_B64` deve contenere la chiave privata SSH in Base64
- `FISCALBAY_VPS_USER` puo restare `opc`
- `FISCALBAY_VPS_PORT` puo restare `22`
- `FISCALBAY_VPS_SSH_KNOWN_HOSTS` e fortemente consigliato per mantenere il controllo stretto della host key

I secret applicativi eBay e Telegram continuano invece a vivere sulla VPS nel file `/opt/fiscalbay/.env`.

## Come produrre i secret GitHub

Chiave privata in Base64:

```bash
base64 < ~/.ssh/id_ed25519 | tr -d '\n'
```

Host key:

```bash
ssh-keyscan -H <host-vps>
```

## Cosa fa il workflow

Il workflow GitHub esegue:

- checkout della revisione target
- sincronizzazione del repository verso `/opt/fiscalbay`
- installazione o aggiornamento locale con `deploy/install-vps.sh`
- restart di `fiscalbay-bot`
- restart di `fiscalbay-oauth` se il servizio e gia abilitato
- verifica dei timer `fiscalbay-backup.timer`, `fiscalbay-alertcheck.timer` e `fiscalbay-reconcile.timer`
- smoke test applicativo con `deploy/smoke-check.sh`

## Fallback locale

Restano validi i comandi SSH diretti e gli script locali per amministrazione manuale della VPS.

Su `chatgpt.com`, pero, il percorso da considerare ufficiale e quello via GitHub Actions.
