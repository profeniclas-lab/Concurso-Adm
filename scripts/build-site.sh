#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
rm -rf dist
mkdir -p dist
cp -a site/. dist/
printf '\n' > dist/.nojekyll
if ! grep -q 'ESTUDO-CONCURSOS' dist/index.html; then
  echo 'ERRO: a entrada do portal unificado não foi encontrada.' >&2
  exit 1
fi

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
unzip -tqq "$TMPDIR_BUILD/admin.zip"
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
if ! diff -qr "$SOURCE_DIR" dist/administracao >/dev/null; then
  echo 'ERRO: a cópia administrativa não corresponde exatamente à origem.' >&2
  exit 1
fi
# Fase 4: o arquivo original já foi comparado com a origem; a divisão
# acontece SOMENTE em dist/ e é verificada antes da publicação.
node scripts/modularize-admin-questions.mjs dist/administracao
node scripts/build-admin-lazy-catalog.mjs dist/administracao
node scripts/build-admin-pedagogy-index.mjs dist/administracao
# Fase 8A: adaptador nativo de aulas e diagnóstico por módulo.
node scripts/build-admin-shared-bundles.mjs dist/administracao
# Fase 7E: confronta 24 cenários x 27 módulos com a função original.
node scripts/audit-phase7e-parity.mjs dist/administracao
# Fase 8B: confere o novo aproveitamento com o motor original, inclusive registros nativos.
node scripts/audit-phase8b-parity.mjs dist/administracao
# Fase 8C: exercícios, banco, revisões e simulados no mesmo histórico de IDs.
node scripts/audit-phase8c-integration.mjs dist/administracao
# Fase 8D: Banco conciliado por ID e transição nativa sem remover o legado.
node scripts/audit-phase8d-transition.mjs dist/administracao
if [[ ! -s dist/administracao/catalogo-leve/auditoria-fase8d.json ]]; then
  echo 'ERRO: auditoria da Fase 8D ausente.' >&2
  exit 1
fi
if [[ ! -s dist/administracao/catalogo-leve/auditoria-fase8c.json ]]; then
  echo 'ERRO: auditoria da Fase 8C ausente.' >&2
  exit 1
fi
if [[ ! -s dist/administracao/catalogo-leve/auditoria-fase8b.json ]]; then
  echo 'ERRO: relatório de paridade Fase 8B ausente.' >&2
  exit 1
fi
if [[ ! -s dist/administracao/catalogo-leve/auditoria-fase7e.json ]]; then
  echo "ERRO: relatório de paridade da Fase 7E ausente." >&2
  exit 1
fi
if [[ ! -s dist/administracao/catalogo-leve/motor-unificado/manifest.json ]]; then
  echo 'ERRO: módulos nativos não foram gerados.' >&2
  exit 1
fi
if [[ ! -s dist/administracao/catalogo-leve/pedagogia-index.json ]]; then
  echo 'ERRO: índice pedagógico ausente.' >&2
  exit 1
fi
if [[ ! -s dist/administracao/catalogo-leve/manifest.json ]]; then
  echo 'ERRO: catálogo modular de consulta não gerado.' >&2
  exit 1
fi
if [[ ! -s dist/administracao/js/data/questions-modules/manifest.json ]]; then
  echo 'ERRO: manifesto de modularização ausente.' >&2
  exit 1
fi
printf 'fonte=profeniclas-lab/Dir-Adm\nbranch=nova-arquitetura\ncommit=%s\n' "$ADMIN_SHA" > dist/administracao/FONTE-INTEGRACAO.txt
echo "Build completo (Administração incorporada no commit ${ADMIN_SHA})."
