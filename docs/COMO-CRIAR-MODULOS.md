# Como gerar lotes pequenos sem criar arquivos gigantes

**Regra:** um módulo = uma pasta, com arquivos pequenos por tipo de atividade.

Ao produzir o primeiro módulo de Português:
1. Copiar `templates/modulo/` para `site/js/unificado/content/portugues/POR-01/`.
2. Substituir `MODULE_ID` por `POR-01` no `index.js`.
3. Registrar o módulo no array `MODULES` de `site/js/unificado/content/portugues/modules.js` (com `id`, `title`, `priority` e `subtopics: [{id,title}]`).
4. Preencher `lessons.js`, `diagnostic.js`, `exercises.js`, `questions-authorial.js`, `questions-real.js` e `flashcards.js` com arquivos independentes.
5. Rodar `npm test` e abrir a disciplina no site de teste.

Não é necessário modificar o motor `site/js/unificado/app.js` quando forem adicionados módulos. Durante a construção dos primeiros módulos, o motor inicial será expandido com funcionalidades pedagógicas de paridade com Administração, e só depois do teste integral será substituído o adaptador temporário.

**Atenção**: o formato inicial de questões usa `answer` como índice numérico baseado em zero (A=0, B=1...). **Não** converter automaticamente os formatos legados de Administração; os seus dados não são processados por esse formato neste lote.

Quando acrescentarmos novas questões, os testes de validação por módulo deverão checar IDs repetidos, integridade de alternativas, gabarito e referências a subtópicos. Esses testes técnicos não substituem conferência editorial de novas questões.
