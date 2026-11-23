# ESTUDO-CONCURSOS — Fase 2: base executável

**Destino:** `https://github.com/profeniclas-lab/Concurso-Adm`  
**Site esperado:** `https://profeniclas-lab.github.io/Concurso-Adm/`

## O que esta entrega faz

- Página inicial executável com cinco disciplinas e tema claro/escuro.
- Administração incorporada na publicação através de cópia **inalterada** do commit fixado da branch `nova-arquitetura` do `Dir-Adm`.
- Demais disciplinas possuem catálogo independente, carregador sob demanda e um motor *inicial* de aula, diagnóstico, exercício, banco de questões e flashcards.
- Novos dados são separados por disciplina. A chave existente `admEstudo.v2.state` é somente lida pelo portal; o ADM-ESTUDO incorporado mantém seu mecanismo original.
- Aulas/questões de Administração NÃO foram modificadas, revisadas, renumeradas ou divididas nesta fase.
- A integração via subaplicativo incorporado é **temporária**; a unificação do motor pedagógico inteiro é uma etapa posterior.

## Implantação segura no repositório Concurso-Adm

1. Faça um backup do conteúdo antigo do `Concurso-Adm` (Code → Download ZIP). Não apague o `Dir-Adm`.
2. Extraia o ZIP desta entrega no computador.
3. Envie os **arquivos e pastas extraídos** para a branch `main` do `Concurso-Adm`, mantendo `.github/workflows/pages.yml`, `site/`, `scripts/`, `tests/`, `package.json` e `README.md` (não envie apenas o ZIP sem extrair).
4. Arquivos antigos do `Concurso-Adm` podem permanecer temporariamente: o workflow publica **somente** `dist/`, que é gerado a partir de `site/`, portanto não publica o `app.js` antigo na raiz. Não delete arquivos antigos antes de confirmar o novo site.
5. No repositório, acesse **Settings → Pages → Build and deployment → Source: GitHub Actions**.
6. Verifique em **Actions** se o workflow **Publicar ESTUDO-CONCURSOS** terminou com sucesso. Abra o endereço do site.
7. Entre em **Administração** e verifique o conteúdo e o histórico no próprio navegador usado anteriormente. Faça backup do progresso antes de qualquer restauração.

> Se o GitHub impedir a publicação por configurações de Actions/Pages, nenhuma alteração automática será realizada no `Dir-Adm`. Ajuste as permissões do Pages ou execute o build localmente e publique `dist/` por outro método.

### Por que não preciso excluir os 18 arquivos antigos agora?

O site publicado é montado exclusivamente com `site/` + cópia do `Dir-Adm`. Arquivos antigos na raiz da branch não são inseridos automaticamente em `dist/`. Assim evitamos exclusões prematuras. Depois que a página nova estiver validada, poderemos limpar os arquivos antigos, com outro commit.

## Testar localmente

É necessário Node.js 18+ e, para o teste visual local, Python 3 ou outro servidor HTTP:

```bash
npm test
npm run build:quick
python -m http.server 8000 -d dist
```

Acesse `http://localhost:8000/`. Neste teste rápido, Administração oferece link para o aplicativo original. No **deploy real** (com `npm run build`), o workflow baixa e incorpora os arquivos da versão administrativa fixada.

> Não abra `index.html` via `file://`, pois a importação de módulos ES depende de um servidor HTTP.

## Importação de Administração

O shell do novo app contém `site/index.html`. A ação de build coloca uma cópia **inalterada** do código de `Dir-Adm` em `dist/administracao/`. O aplicativo administrativo roda numa janela integrada, ainda com seu motor completo e seus scripts originais.

A fonte fica fixada em:

```
profeniclas-lab/Dir-Adm
branch: nova-arquitetura
commit: 3790500f772aad3f8c263b68e8e2dfd8bab7c465
```

Essa referência evita que novas mudanças no `Dir-Adm` alterem o novo site de surpresa. A atualização dessa referência será um lote de trabalho separado.

## Como acrescentar módulos futuramente

Para um módulo `POR-01`, adicionar:

```
site/js/unificado/content/portugues/modules.js     ← registro leve do módulo
site/js/unificado/content/portugues/POR-01/index.js
site/js/unificado/content/portugues/POR-01/lessons.js
site/js/unificado/content/portugues/POR-01/diagnostic.js
site/js/unificado/content/portugues/POR-01/exercises.js
site/js/unificado/content/portugues/POR-01/questions-authorial.js
site/js/unificado/content/portugues/POR-01/questions-real.js
site/js/unificado/content/portugues/POR-01/flashcards.js
```

`index.js` agrega os dados por `makeModuleBundle`, sem carregar arquivos dos demais módulos. O contrato utiliza `id`, `moduleId`, `stem`, `options` (array), `answer` (índice inteiro) e `explanation` (texto) para questões.

## Escopo e limites (importante)

- **Não é ainda uma substituição total do ADM-ESTUDO**: suas funcionalidades continuam hospedadas sob `administracao/` dentro do portal.
- O motor das novas disciplinas é uma base inicial. Revisão espaçada, simulados e métricas avançadas do ADM serão adaptados para todas as disciplinas em lotes posteriores.
- Não incluímos questões falsas nem conteúdos pedagógicos incompletos apenas para preencher páginas.
- A exportação manual de JSON dos progressos novos está presente; a **restauração importável** deles ainda não está implementada. A restauração de Administração continua disponível no sistema original incorporado.
- O GitHub Pages é hospedagem estática, não um mecanismo de sincronização de progresso entre dispositivos.
- `localStorage` é isolado por origem, não por caminho. O estado do ADMIN incorporado pode ser compartilhado com `https://profeniclas-lab.github.io/Dir-Adm/`, pois ambos estão sob a mesma origem GitHub Pages. O shell não altera essa chave.
- Integração futura deverá validar e migrar o armazenamento com backup, sem reset e sem importação automática de estados legados.

## CORREÇÃO FASE 2.1 — Um index.html também na raiz

Se você estiver vendo o aplicativo antigo, leia primeiro [docs/CORRECAO-PUBLICACAO.md](docs/CORRECAO-PUBLICACAO.md). O `index.html` do diretório **raiz** agora abre o portal diretamente, mesmo quando o Pages está configurado para publicar a branch `main` sem GitHub Actions. A implantação via Actions continua funcionando com `site/index.html` e cópia do ADM-ESTUDO.
