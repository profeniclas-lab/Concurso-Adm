# Fase 4 — Correção do manifesto e da publicação do ESTUDO-CONCURSOS

## Problema identificado no GitHub Pages (24/11/2026)

Foram observadas **duas publicações concorrentes** no repositório `profeniclas-lab/Concurso-Adm`:

1. `Publicar ESTUDO-CONCURSOS` (GitHub Actions), que executa `npm test`, `npm run build` e envia a pasta `dist/` ao Pages;
2. `pages build and deployment` (publicação antiga por branch/Jekyll), que publica arquivos da branch e **não** a pasta `dist/` produzida pelo nosso build.

Na execução identificada, a primeira publicação terminou com sucesso às 11:53:39 UTC, mas a segunda terminou às 11:53:52 UTC. A publicação de branch ocorreu por último, causando a ausência da pasta administrativa gerada. O HTTP 404 do manifesto é compatível com isso.

**Correção necessária, sem editar código:** no GitHub, em `Concurso-Adm → Settings → Pages → Build and deployment`, mude `Source` para **GitHub Actions** (não `Deploy from a branch`). Depois, abra `Actions → Publicar ESTUDO-CONCURSOS → Run workflow`, selecione `main` e execute. Confirme que `build` e `deploy` estão verdes. Recarregue a página após a conclusão.

## Contagem correta do banco administrativo

Análise técnica dos conjuntos de IDs da branch `Dir-Adm/nova-arquitetura` fixada no commit `3790500f772aad3f8c263b68e8e2dfd8bab7c465`:

| Origem | Quantidade |
| --- | ---: |
| `js/data/questions.js` — base | 584 |
| `js/data/questions-f25-lote04.js` | 53 |
| `js/data/questions-f25-lote06.js` | 51 |
| `js/data/questions-f25-lote08.js` | 23 |
| `js/data/questions-f25-lote09.js` | 46 |
| **Total distinto** | **757** |

Os cinco conjuntos possuem 757 IDs distintos e pertencem a 27 módulos. A revisão F23/L02 modifica registros existentes e não acrescenta uma sexta lista de questões.

Os lotes F25 contêm **questões autorais elaboradas com base em temas de provas e listas**. Não se deve atribuir automaticamente a elas a condição de transcrições literais de questões oficiais.

## O que a correção faz

- Divide as **584 questões-base** em 27 arquivos de módulo, exatamente como na primeira entrega da Fase 4.
- Mantém os 173 itens dos quatro lotes F25 separados e carregados pelo mecanismo já existente.
- Executa no build a mesma ordem de carregamento das quatro adições F25 e da revisão F23 usada pelo aplicativo.
- Bloqueia o build se algum lote não trouxer sua quantidade esperada, se houver IDs duplicados ou se o total divergir de 757.
- `manifest.json` passa a registrar `questionCount: 757`, `totalQuestionCount: 757`, `baseQuestionCount: 584`, `additionalQuestionCount: 173` e `moduleCount: 27`.
- Em `modules`, `count` e `baseCount` identificam os itens do arquivo modularizado; `additionalCount` identifica itens dos lotes F25; `totalCount` corresponde à soma por módulo.
- Não altera os textos/gabaritos das questões, o repositório `Dir-Adm`, `localStorage` nem o código de persistência.

**Limite:** os 173 itens adicionais ainda não foram repartidos em arquivos próprios por módulo. A modularização completa e o carregamento sob demanda continuam etapas posteriores.

## Arquivos a substituir no repositório Concurso-Adm

Substituir somente:

1. `scripts/modularize-admin-questions.mjs`
2. `tests/admin-modularization.test.mjs`
3. `docs/FASE04-QUESTOES-POR-MODULO.md`

Não é necessário editar `index.html`, `scripts/build-site.sh`, `.github/workflows/pages.yml`, nem alterar o `Dir-Adm`.

## Como verificar

1. Em `Settings → Pages`, certifique-se de que a origem é **GitHub Actions**.
2. Faça commit dos três arquivos corrigidos.
3. Em `Actions → Publicar ESTUDO-CONCURSOS`, confira que os jobs `build` e `deploy` foram concluídos com sucesso; o build deve registrar 584 questões-base e 757 questões no banco completo.
4. Abra `https://profeniclas-lab.github.io/Concurso-Adm/administracao/js/data/questions-modules/manifest.json`.
5. Procure `baseQuestionCount: 584`, `additionalQuestionCount: 173`, `totalQuestionCount: 757`, `moduleCount: 27`.

Se aparecer 404, verifique a origem do Pages e a última execução de publicação antes de qualquer nova alteração no código.
