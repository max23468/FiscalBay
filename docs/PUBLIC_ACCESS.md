# Accesso pubblico con Duck DNS e HTTPS

Questa guida descrive il setup consigliato per non esporre il flusso OAuth tramite
indirizzo IP della VPS.

Obiettivo operativo:

- URL pubblico leggibile, per esempio `https://connect.fiscalbay.it`
- HTTPS gestito da nginx e Certbot
- callback OAuth FiscalBay esposto solo sui percorsi necessari
- IP della VPS usato solo per SSH, deploy e diagnostica infrastrutturale

FiscalBay resta `Telegram first`: il dominio pubblico serve `/` come mini sito
vetrina, `/oauth/*`, `/privacy`, `/about`, `/healthz` e gli asset favicon,
senza trasformare il web nel punto di ingresso operativo principale.

## Scelta DNS

Duck DNS puo' essere usato in due modi:

- dominio Duck DNS diretto: `https://nome.duckdns.org`
- dominio personalizzato: `https://connect.tuodominio.it` con record `CNAME`
  verso `nome.duckdns.org`

Per un dominio personalizzato e' consigliato usare un sottodominio, per esempio
`connect.tuodominio.it`. Il dominio root `tuodominio.it` spesso non puo' essere
un `CNAME`; in quel caso usa un record `A` verso l'IP della VPS, oppure una
funzione `ALIAS` / `ANAME` se il provider DNS la supporta.

## Aggiornamento Duck DNS

Crea il sottodominio su Duck DNS e salva il token solo sulla VPS:

```bash
sudo mkdir -p /etc/fiscalbay
sudo tee /etc/fiscalbay/duckdns.env >/dev/null <<'EOF'
DUCKDNS_DOMAIN=nome
DUCKDNS_TOKEN=token-duckdns
EOF
sudo chmod 600 /etc/fiscalbay/duckdns.env
```

Installa il timer se vuoi aggiornare periodicamente il record Duck DNS:

```bash
cd /opt/fiscalbay
chmod +x deploy/duckdns-update.sh
sudo cp deploy/fiscalbay-duckdns.service /etc/systemd/system/fiscalbay-duckdns.service
sudo cp deploy/fiscalbay-duckdns.timer /etc/systemd/system/fiscalbay-duckdns.timer
sudo systemctl daemon-reload
sudo systemctl enable --now fiscalbay-duckdns.timer
sudo systemctl start fiscalbay-duckdns.service
```

Verifica:

```bash
sudo systemctl status fiscalbay-duckdns.timer
sudo journalctl -u fiscalbay-duckdns.service -n 50 --no-pager
dig +short nome.duckdns.org
```

Se la VPS ha IP statico, Duck DNS resta comunque utile come alias tecnico. In quel
caso puoi anche aggiornarlo manualmente e non abilitare il timer.

## Dominio personalizzato

Nel DNS del dominio personalizzato crea un record:

```text
connect.tuodominio.it.  CNAME  nome.duckdns.org.
```

Attendi la propagazione e verifica:

```bash
dig +short connect.tuodominio.it
```

Il certificato HTTPS va emesso per il dominio che useranno gli utenti, quindi per
`connect.tuodominio.it`, non necessariamente per `nome.duckdns.org`.

## nginx e HTTPS

Installa nginx, Certbot, il plugin nginx e gli strumenti di verifica DNS/HTTP:

```bash
sudo dnf install -y nginx certbot python3-certbot-nginx curl bind-utils
sudo systemctl enable --now nginx
```

Su sistemi Debian/Ubuntu il comando equivalente e':

```bash
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx curl dnsutils
sudo systemctl enable --now nginx
```

Se sulla distribuzione della VPS `certbot` non e' disponibile dai repository
standard, abilita il repository consigliato dal provider della distribuzione e
ripeti l'installazione.

Copia la configurazione di riferimento e sostituisci `fiscalbay.example.com` con
il dominio reale:

```bash
sudo cp /opt/fiscalbay/deploy/nginx-fiscalbay-oauth-site.conf \
  /etc/nginx/conf.d/fiscalbay-oauth.conf
sudo sed -i 's/fiscalbay.example.com/connect.tuodominio.it/g' \
  /etc/nginx/conf.d/fiscalbay-oauth.conf
sudo nginx -t
sudo systemctl reload nginx
```

Apri sul firewall della VPS le porte `80/tcp` e `443/tcp`. Su Oracle Cloud va
verificata anche la security list o network security group.

Emetti il certificato:

```bash
sudo certbot --nginx -d connect.tuodominio.it
```

Verifica il rinnovo automatico:

```bash
sudo certbot renew --dry-run
```

## Variabili FiscalBay

Nel file `/opt/fiscalbay/.env` usa il dominio HTTPS pubblico:

```env
EBAY_OAUTH_CONNECT_BASE_URL=https://connect.tuodominio.it/oauth/start
EBAY_OAUTH_CALLBACK_URL=https://connect.tuodominio.it/oauth/callback
EBAY_OAUTH_SERVER_HOST=127.0.0.1
EBAY_OAUTH_SERVER_PORT=8787
```

Lascia il server OAuth in bind locale (`127.0.0.1`): l'esposizione pubblica deve
passare da nginx.

Riavvia il servizio OAuth:

```bash
sudo systemctl restart fiscalbay-oauth
sudo systemctl status fiscalbay-oauth
```

## eBay Developer Portal

Nel RuName eBay usato da `EBAY_OAUTH_RUNAME` configura:

- Homepage / landing pubblica: `https://connect.tuodominio.it/`
- Accept URL: `https://connect.tuodominio.it/oauth/callback`
- Privacy Policy URL: `https://connect.tuodominio.it/privacy`
- Auth Accepted URL / About URL, se richiesto dal portale: `https://connect.tuodominio.it/about`

Nota importante: verso eBay FiscalBay invia il `RuName`, non la URL libera. La URL
pubblica resta comunque necessaria per ricevere il callback e deve coincidere con
la Accept URL configurata nel portale eBay.

## Verifica end-to-end

Controlli rapidi dalla tua macchina:

```bash
curl -I https://connect.tuodominio.it/healthz
curl -I https://connect.tuodominio.it/privacy
curl -I https://connect.tuodominio.it/about
```

Poi da Telegram esegui `/connect` e verifica che il link inizi con:

```text
https://connect.tuodominio.it/oauth/start
```

Se il link apre eBay e il consenso torna alla pagina di conferma FiscalBay, il
dominio pubblico HTTPS e' correttamente collegato al flusso OAuth.
