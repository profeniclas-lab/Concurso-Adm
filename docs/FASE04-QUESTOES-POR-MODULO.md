# Fase 4 — Modularização técnica do Banco de Questões de Administração

## Escopo fechado

- Nenhuma revisão pedagógica de enunciados, respostas, comentários ou fundamentos.
- Nenhuma alteração no repositório `profeniclas-lab/Dir-Adm`.
- Nenhum acesso ou escrita no `localStorage`, backups ou dados de estudo.
- A origem segue **fixada** no commit `3790500f772aad3f8c263b68e8e2dfd8bab7c465` da branch `nova-arquitetura` do `Dir-Adm`.
- O arquivo de questões original está fixado pelo SHA Git `b772363d33f069024bd06b1956e703124992cd87`.

## O que muda no GitHub Pages

Após o `npm run build`, a pasta publicada `dist/administracao/js/data/` terá:

```
questions.js                   # fachada ES modules, preserva QUESTIONS e questionsForModule()
questions-modules/
  ADM-01.js
  ADM-02.js
  ...
  AP-13.js
  AP-14.js
  DA-15.js
  ...
  DA-27.js
  manifest.json               # contagem, módulo, hashes de identificação e dados
```

O banco-base original possui **584 questões em 27 módulos**, confirmado no arquivo fixado. Essas quantidades são conferidas antes de disponibilizar a versão transformada; os lotes posteriores da Fase 23/25 são mantidos intactos.

## Segurança da transformação

1. O CI baixa a versão fixada de Administração e copia exatamente seus arquivos para `dist/administracao`.
2. Confere a cópia integral com `diff -qr` **antes** de transformar o banco.
3. A divisão se recusa a prosseguir se o SHA do arquivo de questões divergir, se IDs estiverem duplicados, se a lista não for um array JSON ou se a API pública tiver mudado.
4. Separa os registros por `moduleId`, mantendo ordem e conteúdo de todos os campos.
5. O `questions.js` passa a importar os arquivos de cada módulo e a exportar a **mesma** variável `QUESTIONS` e a **mesma** função `questionsForModule`.
6. Carrega o JavaScript gerado em Node e faz uma comparação profunda com os objetos da origem; qualquer divergência falha o build e impede a publicação.
7. Grava `manifest.json` com quantidades por módulo e SHA-256 do conteúdo total.

## Limites desta fase

Esta fase modulariza **os arquivos publicados**, ainda não os arquivos mantidos no repositório-fonte `Dir-Adm`. A origem continua preservada, evitando uma migração destrutiva antes da validação. O motor administrativo ainda importa os 27 arquivos de uma vez: carregamento verdadeiramente sob demanda e migração para um motor compartilhado ficam para etapas posteriores. Os lotes extras seguem intactos.

## Como instalar

No repositório `Concurso-Adm`, substitua `scripts/build-site.sh` e adicione `scripts/modularize-admin-questions.mjs`, `tests/admin-modularization.test.mjs` e este documento. `package.json` e o workflow já existentes servem sem alterações: `npm test` inclui o novo teste e `npm run build` executa a transformação.

## Como verificar

Depois que o workflow **Publicar ESTUDO-CONCURSOS** terminar em verde:

- A interface deve abrir normalmente.
- Administração deve continuar abrindo dentro do portal.
- Acesse `https://profeniclas-lab.github.io/Concurso-Adm/administracao/js/data/questions-modules/manifest.json` e confira `questionCount: 584` e `moduleCount: 27`.
- Abra algumas questões do banco e confirme que seu progresso preexistente continua disponível (os IDs não foram alterados).

Caso a publicação falhe, consulte o erro em **GitHub → Actions → Publicar ESTUDO-CONCURSOS**. O site anteriormente publicado não deve ser substituído por um build que falhou.
