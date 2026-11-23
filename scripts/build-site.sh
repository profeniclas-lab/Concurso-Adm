#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
rm -rf dist
mkdir -p dist
cp -a site/. dist/
printf '\n' > dist/.nojekyll

# O pacote estático de Administração é cópia EXATA do repositório-fonte.
# A cópia é montada APENAS no dist/ do CI, nunca sobre os arquivos de origem.
if [[ "${ESTUDO_SKIP_ADMIN:-0}" == "1" ]]; then
  echo 'Build local sem Administração (ESTUDO_SKIP_ADMIN=1).'
  exit 0
fi

ADMIN_SHA='3790500f772aad3f8c263b68e8e2dfd8bab7c465'
TMPDIR_BUILD=$(mktemp -d)
trap 'rm -rf "$TMPDIR_BUILD"' EXIT
if [[ -n "${ESTUDO_ADMIN_ARCHIVE:-}" ]]; then
  cp "$ESTUDO_ADMIN_ARCHIVE" "$TMPDIR_BUILD/admin.zip"
else
  curl --fail --location --silent --show-error --retry 3 \
    --connect-timeout 20 --max-time 180 \
    "https://codeload.github.com/profeniclas-lab/Dir-Adm/zip/${ADMIN_SHA}" \
    --output "$TMPDIR_BUILD/admin.zip"
fi
unzip -q "$TMPDIR_BUILD/admin.zip" -d "$TMPDIR_BUILD/source"
SOURCE_DIR=$(find "$TMPDIR_BUILD/source" -mindepth 1 -maxdepth 1 -type d -print -quit)
if [[ -z "$SOURCE_DIR" ]]; then echo 'ERRO: zip de Administração sem arquivos.' >&2; exit 1; fi
mkdir -p dist/administracao
cp -a "$SOURCE_DIR"/. dist/administracao/
for file in index.html js/app.js js/start-f25-lote04.js js/data/questions.js js/data/modules.js js/core/storage.js; do
  if [[ ! -s "dist/administracao/$file" ]]; then
    echo "ERRO: componente da fonte ausente: $file" >&2
    exit 1
  fi
done
printf 'fonte=profeniclas-lab/Dir-Adm\nbranch=nova-arquitetura\ncommit=%s\n' "$ADMIN_SHA" > dist/administracao/FONTE-INTEGRACAO.txt
echo "Build completo (Administração incorporada no commit ${ADMIN_SHA})."
