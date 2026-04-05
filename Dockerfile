FROM python:3.12-slim

# Imposta la directory di lavoro
WORKDIR /app

# Non copiamo tutto subito per sfruttare la cache sui layer delle dipendenze, 
# se in futuro ci sarà un file requirements.txt
# COPY requirements.txt .
# RUN pip install --no-cache-dir -r requirements.txt

# Copiamo il file pyproject.toml e setup.py per l'installazione locale
COPY pyproject.toml setup.py README.md ./
COPY src/ ./src/
COPY tests/ ./tests/

# Installiamo il pacchetto localmente per le dipendenze standard
RUN pip install --no-cache-dir .

# Assicuriamoci che la cartella data esista (dove andrà il DB SQLite)
RUN mkdir -p data

# Variabili d'ambiente di base
ENV PYTHONUNBUFFERED=1

# Lancia il bot
CMD ["python", "src/telegram_bot.py"]
