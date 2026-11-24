# Fase 5 — Consulta modular sob demanda (migração segura)

## O que é entregue

Esta fase adiciona ao ESTUDO-CONCURSOS uma **consulta de questões de Administração por módulo**. O manifesto é carregado uma vez; as questões de determinado módulo só são baixadas quando ele é aberto.

O gerador percorre **o banco consolidado com 757 questões** na ordem de inicialização do ADM-ESTUDO: 584 questões-base + lotes F25 (53, 51, 23 e 46) + aplicação das revisões F23. A comparação é feita com o hash final já validado na Fase 4. São gerados 27 módulos em `dist/administracao/catalogo-leve/questoes/` e um manifesto na pasta `catalogo-leve/`.

**Importante:** o gerador não muda `js/data/questions.js`, os lotes F25, as revisões F23, `app.js`, `localStorage` ou qualquer arquivo no repositório `Dir-Adm`. A consulta não guarda respostas, notas ou progresso; abre gabaritos e explicações em `<details>`. O aplicativo administrativo completo continua no painel incorporado, com seus próprios simulados, estatísticas, histórico e revisões. Essa consulta não substitui o banco de questões interativo.

A própria interface do ADM-ESTUDO ainda importa o banco inteiro quando é aberta; só a nova consulta do portal é realmente sob demanda nesta fase. A conversão interna do ADM-ESTUDO para carregamento sob demanda exige adaptar dashboard, revisão, simulados e indicadores e será uma etapa separada.

## Instalação no Concurso-Adm

Atualizar **apenas** os seguintes arquivos da branch `main` mantendo os caminhos:

1. `scripts/build-site.sh` (substituir)
2. `scripts/build-admin-lazy-catalog.mjs` (novo)
3. `site/js/unificado/admin-catalog.js` (novo)
4. `site/js/unificado/app.js` (substituir)
5. `site/css/app.css` (substituir)
6. `tests/admin-lazy-catalog.test.mjs` (novo)
7. `docs/FASE05-CONSULTA-SOB-DEMANDA.md` (novo)

**Não apagar** os arquivos da Fase 4, nem trocar `index.html`, `.github/workflows/pages.yml` ou os arquivos administrativos.

O workflow existente executa `npm test` e `npm run build`, que passam a incluir a Fase 5. A publicação falhará (antes de implantar) se faltar qualquer questão, houver IDs repetidos ou se o hash do banco consolidado for diferente do esperado.

## Verificação no GitHub Pages

Depois do workflow **Publicar ESTUDO-CONCURSOS** finalizar com sucesso:

1. Abra `https://profeniclas-lab.github.io/Concurso-Adm/administracao/catalogo-leve/manifest.json`. Deve exibir `questionCount: 757` e `moduleCount: 27`.
2. Abra `https://profeniclas-lab.github.io/Concurso-Adm/#admin-modulos`: a lista de 27 módulos deverá ser exibida sem baixar todos os arquivos de questões.
3. Clique em um módulo, por exemplo `ADM-01`, para consultar só as questões desse módulo. Abra os gabaritos individualmente e percorra as páginas.
4. Entre no ADM-ESTUDO completo: simulados, banco interativo, revisão e progresso devem continuar como antes.

## Por que um segundo formato?

A implementação original utiliza `QUESTIONS` como array síncrono e compartilha o banco entre simulados, estatísticas, revisão e outras telas. Alterá-lo para lazy loading sem modificar esses consumidores poderia mostrar contagens incorretas ou quebrar sessões. O novo catálogo leve é uma **camada de leitura temporária**. Nada é gravado no progresso administrativo enquanto a migração do motor não for concluída e testada.

## Limites dos testes

Os testes locais validam contratos, arquivos gerados com dados sintéticos, segurança de rota e cache de importação. O GitHub Actions executará a geração sobre o snapshot real das 757 questões e validará contra o hash da Fase 4. A geração real no GitHub deve ser conferida no log do workflow antes de considerar a publicação finalizada.
