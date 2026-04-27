# Deploy Da Codex Cloud Con GitHub Actions

Questa guida serve per usare `chatgpt.com` come postazione di lavoro e, solo su richiesta esplicita del maintainer, come ponte di deploy GitHub Actions senza dipendere dal Mac locale.

## Stato attuale

Il deploy SSH diretto dal runtime Codex cloud verso la VPS non e affidabile, e in piu i secret applicativi non risultano disponibili nei task shell cloud in modo consistente.

Il default operativo resta quindi il deploy manuale sulla VPS tramite SSH e script versionati. Codex non deve avviare GitHub Actions per deploy come conseguenza implicita di commit, push, merge o release.

Quando il maintainer chiede esplicitamente un deploy con GitHub Actions, il percorso e:

1. Codex cloud prepara e pubblica il codice su GitHub.
2. GitHub Actions sincronizza il repository sulla VPS via SSH.
3. La VPS applica installazione o aggiornamento locale senza fare `git pull`.
4. GitHub Actions riavvia i servizi e lancia lo smoke check dalla VPS.

## Flusso consigliato da mobile

Per deploy ordinari:

1. fai lavorare Codex sul branch desiderato
2. porta la modifica su `main`
3. esegui il deploy manuale sulla VPS con il runbook operativo quando decidi di pubblicare

Per deploy via GitHub Actions o di una revisione specifica:

- usa il workflow `Deploy VPS` in GitHub Actions con `workflow_dispatch`
- passa `target_ref` se vuoi deployare un commit o ref specifico
- usalo solo quando chiedi esplicitamente a Codex o al maintainer di fare il deploy con GitHub Actions

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

I comandi SSH diretti e gli script locali sono il percorso standard per amministrazione e deploy manuale della VPS.

Su `chatgpt.com`, il workflow GitHub Actions e' un canale disponibile solo quando viene richiesto esplicitamente.
