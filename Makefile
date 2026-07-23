.PHONY: lock lock-check

# Rigenera requirements.lock (dipendenze runtime pinnate + hash) da pyproject.toml.
# Richiede uv. Esegui dopo ogni modifica alle dipendenze runtime e ricommitta il lock.
lock:
	uv pip compile pyproject.toml --universal --generate-hashes --no-header -o requirements.lock

# Verifica che requirements.lock sia allineato a pyproject.toml senza riscriverlo.
lock-check:
	uv pip compile pyproject.toml --universal --generate-hashes --no-header -o - | diff -u requirements.lock -
