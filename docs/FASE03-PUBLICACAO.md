# Fase 3 — Publicar o portal com Administração incorporada

## Objetivo e escopo

Este pacote **não** contém as questões e aulas administrativas. O GitHub Actions copia, no momento da publicação, o commit fixado da branch `nova-arquitetura` do `profeniclas-lab/Dir-Adm` para `dist/administracao/`. Não modifica o repositório original nem revisa os conteúdos.

Arquivos entregues:
- `.github/workflows/pages.yml`: ação para montar e publicar o site.
- `scripts/build-site.sh`: monta `dist/` e verifica arquivos essenciais da cópia administrativa.
- `site/js/unificado/app.js`: melhora o acesso à Administração (modo incorporado e tela cheia), sem alterar o salvamento.
- `tests/deployment.test.mjs`: testes de montagem com um arquivo ZIP simulado (sem revisão pedagógica).

## Como instalar a partir do GitHub

1. Faça backup e preserve o `Dir-Adm`. No `Concurso-Adm`, permaneça na branch `main`.
2. No pacote, abra `.github/workflows/pages.yml`. No GitHub use **Add file → Create new file**, digite o caminho **`.github/workflows/pages.yml`**, cole o conteúdo e faça commit. Isso é importante porque a pasta oculta `.github` pode não ser incluída pelo envio de arquivos via navegador.
3. Atualize `scripts/build-site.sh` e `site/js/unificado/app.js` com os arquivos completos deste pacote, mantendo os caminhos. Adicione `tests/deployment.test.mjs` (pasta `tests` já existe).
4. Em **Settings → Pages → Build and deployment → Source**, selecione **GitHub Actions**.
5. Em **Actions → Publicar ESTUDO-CONCURSOS → Run workflow**, execute a publicação na branch `main`. O workflow também será acionado por commits posteriores.
6. Na execução, confirme que as etapas **Executar testes**, **Gerar site**, **Enviar artefato** e **Publicar site** terminaram sem erro.
7. Abra `https://profeniclas-lab.github.io/Concurso-Adm/` e clique em **Administração e Direito Administrativo**. A página incorporada deverá carregar; use **Abrir Administração em tela cheia** se preferir.

## O que esta etapa ainda não faz

- **Não** cria um motor pedagógico compartilhado para Administração; ela roda como subaplicativo dentro do portal.
- **Não** redivide o grande arquivo legado `js/data/questions.js` (será a próxima fase técnica).
- **Não** sincroniza progresso automaticamente entre aparelhos.
- **Não** substitui/transforma arquivos de Administração ou gabaritos.

## Segurança do progresso

- O portal não grava na chave `admEstudo.v2.state`, usada pela branch administrativa atual.
- O aplicativo administrativo incorporado pode acessar essa mesma chave porque roda no domínio `profeniclas-lab.github.io`.
- Faça um backup pelo próprio aplicativo administrativo antes de usar a cópia incorporada. Se houver progresso feito usando versões antigas, use a ferramenta de backup/restauração, nunca sobrescrita manual.
- O aplicativo do portal só usa namespaces próprios para Português, Matemática, Informática e Constitucional.

## Atualização do conteúdo administrativo

A publicação usa o commit fixo `3790500f772aad3f8c263b68e8e2dfd8bab7c465`, examinado para esta integração. Novos commits no `Dir-Adm` **não entram automaticamente**. Para atualizar a cópia, será necessário validar e trocar `ADMIN_SHA` em `scripts/build-site.sh` e publicar outra vez.

## Resolução de problemas

- Se a tela continuar antiga, verifique **Settings → Pages → Source = GitHub Actions** e a execução mais recente em **Actions**. Aguarde a implantação terminar; depois atualize a página forçadamente.
- Se Administração mostrar apenas um link externo, abra a execução do workflow, veja a etapa **Gerar site** e confirme `dist/administracao/index.html`.
- Se o workflow falhar ao baixar `codeload.github.com`, não substitua o conteúdo por arquivos parciais. Tente nova execução e confira a mensagem de erro.
- Se a publicação falhar por permissão, confira se GitHub Pages e Actions estão habilitados para o repositório. O workflow declara `pages: write` e `id-token: write`.
