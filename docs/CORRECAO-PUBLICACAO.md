# Correção de publicação — Fase 2.1

## O que aconteceu

O pacote anterior deixava o novo `index.html` exclusivamente em `site/index.html`, enquanto o `Concurso-Adm` continuava com o `index.html` antigo na raiz. A publicação por GitHub Actions só funcionaria após criar `.github/workflows/pages.yml` e configurar Settings → Pages → GitHub Actions. No repositório verificado, a pasta `.github/` não estava presente; por isso a página continuou antiga.

## Correção imediata, sem apagar arquivos

1. Extraia o pacote corrigido no computador. Nele existe `index.html` **na raiz**, além de `site/index.html`.
2. No GitHub abra `profeniclas-lab/Concurso-Adm/index.html` (na branch `main`). Clique em editar (ícone de lápis).
3. **Substitua todo o conteúdo** do `index.html` existente pelo conteúdo do `index.html` que está na raiz do pacote corrigido. Confirme o commit em `main`.
4. Os arquivos `site/css/app.css` e `site/js/unificado/` já estavam presentes no repositório quando foi feita esta verificação. Se os remover, reenvie-os mantendo os caminhos.
5. Abra `Settings → Pages`. Para a publicação sem GitHub Actions escolha `Source: Deploy from a branch`, `Branch: main`, `Folder: /(root)` e salve.
6. Confira o endereço `https://profeniclas-lab.github.io/Concurso-Adm/`. Se o navegador ainda apresentar uma página antiga, faça uma atualização forçada (`Ctrl+F5`) após a publicação da nova versão.

Nesta modalidade simples, a interface nova funcionará, mas Administração abrirá a página original pelo link disponível na disciplina. A incorporação local do app administrativo, na rota `administracao/`, exige a etapa de publicação completa abaixo.

## Publicação avançada (opcional, integração local do ADM-ESTUDO)

Se quiser incorporar uma cópia do ADM-ESTUDO dentro do portal, habilite GitHub Actions:

1. Pelo GitHub, clique em `Add file → Create new file` e digite o caminho completo **`.github/workflows/pages.yml`**.
2. Copie e cole o conteúdo do arquivo correspondente no pacote corrigido e confirme o commit.
3. Em `Settings → Pages → Source` escolha `GitHub Actions`.
4. Acesse a aba `Actions`, abra `Publicar ESTUDO-CONCURSOS` e use `Run workflow` (ou publique um novo commit).
5. Somente após uma execução bem-sucedida o portal passará a utilizar `dist/administracao/` com uma cópia fixada da branch `nova-arquitetura`.

Não é necessário apagar `app.js`, `content/` e `style.css` antigos da raiz para que o portal abra. O novo `index.html` da raiz não usa esses arquivos.

## Segurança e limites

- Nada é apagado no `Dir-Adm`, e este pacote não modifica seu banco de dados nem seu histórico.
- A interface do portal não grava na chave administrativa `admEstudo.v2.state`.
- Se usar a publicação simples, o link de Administração abre o aplicativo original; é uma integração temporária, **não** o motor unificado completo.
- Verifique se GitHub Pages está apontando para a fonte escolhida; subir arquivos não garante que a publicação terminou.
