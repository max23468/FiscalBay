#!/bin/bash
# Prepara le sessioni Claude Code cloud, che partono con Node 22: Node e pnpm del manifest,
# verificati con i checksum ufficiali, poi le dipendenze del lockfile. In locale non fa nulla.
set -euo pipefail
[ "${CLAUDE_CODE_REMOTE:-}" = true ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-.}"

node_version="$(jq -r .engines.node package.json)"
pnpm_version="$(jq -r '.packageManager | ltrimstr("pnpm@")' package.json)"
case "$(uname -m)" in
  x86_64) arch=x64 ;;
  aarch64 | arm64) arch=arm64 ;;
  *)
    echo "Architettura non supportata: $(uname -m)." >&2
    exit 1
    ;;
esac
name="node-v${node_version}-$(uname -s | tr '[:upper:]' '[:lower:]')-${arch}"
root="${HOME}/.local/${name}"

if [ ! -x "${root}/bin/node" ]; then
  download="$(mktemp -d)"
  trap 'rm -rf "${download}"' EXIT
  base="https://nodejs.org/dist/v${node_version}"
  curl -fsSL "${base}/SHASUMS256.txt" -o "${download}/SHASUMS256.txt"
  curl -fsSL "${base}/${name}.tar.xz" -o "${download}/${name}.tar.xz"
  checksum="sha256sum"
  command -v sha256sum >/dev/null || checksum="shasum -a 256"
  (cd "${download}" && grep "  ${name}.tar.xz\$" SHASUMS256.txt | ${checksum} -c - >&2)
  mkdir -p "${HOME}/.local"
  tar -xJf "${download}/${name}.tar.xz" -C "${HOME}/.local"
fi
export PATH="${root}/bin:${PATH}"
if [ "$("${root}/bin/pnpm" --version 2>/dev/null)" != "${pnpm_version}" ]; then
  npm install --global --prefix "${root}" --silent "pnpm@${pnpm_version}" >&2
fi
# I comandi successivi della sessione leggono questo file prima di partire.
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export PATH=\"${root}/bin:\$PATH\"" >>"${CLAUDE_ENV_FILE}"
fi
pnpm install --frozen-lockfile >&2

echo "Sessione cloud pronta: Node $(node --version), pnpm $(pnpm --version), dipendenze installate."
echo "GitHub risponde soltanto via REST: \`gh pr\` e \`gh issue\` sono rifiutati, \`gh api\` e \`pnpm release:cycle\` funzionano."
