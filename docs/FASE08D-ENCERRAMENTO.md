# ESTUDO-CONCURSOS — Fase 8D: reconciliação e transição gradual

## Estado da entrega

O acesso principal `#materia/administracao` usa o **motor compartilhado**. O aplicativo antigo permanece no `#materia/administracao/legado`, com o iframe original e seu armazenamento protegido. Não removemos `Dir-Adm`, nem o bundle administrativo do `dist`.

A Fase 8 está **tecnicamente entregue**, condicionada à confirmação de `build` e `deploy` no repositório do usuário e às verificações do histórico pessoal.

## Rotas

- `#materia/administracao` — entrada nativa, 27 módulos e 757 questões.
- `#materia/administracao/legado` — aplicativo ADM-ESTUDO original como alternativa.
- `#treino-admin/visao-unificada/1` — aproveitamento **efetivo** dos módulos 1–9; páginas 2 e 3 completam os 27 módulos, sem carregar todos de uma vez.
- `#estudo/administracao/ADM-01` — módulo nativo com aula, diagnóstico e exercícios.
- `#treino-admin/banco/ADM-01/1` — Banco novo, com tentativas e correção.
- `#treino-admin/auditoria` — backup JSON dos registros, sem restauração automática.

## Regra do Banco de Questões

A nota do Banco vale no máximo 20 pontos e é calculada **por questão distinta**, usando a última resposta de Banco elegível em cada ID:

1. **Sem Banco antigo pontuado:** a evidência do Banco novo é utilizada.
2. **Origem = ADM-ESTUDO original e respostas individuais disponíveis:** o sistema confere a contagem e a pontuação original, encontra sobreposições por ID e compara as datas. Uma resposta nova só substitui a anterior se for comprovadamente mais recente; respostas sem sobreposição são acrescentadas uma única vez. Se o total reconstituído divergir do antigo, a nota fica preservada.
3. **Origem = cópia F7C com nota apenas agregada:** não é possível recuperar os IDs originais, portanto a nota herdada é mantida, e o Banco novo é exibido separadamente. **Não se mistura um percentual congelado com outro percentual.**
4. **Datas faltantes, empate, gabarito incompatível ou questão ausente do catálogo:** a conciliação é bloqueada quando houver risco; não inventamos histórico.
5. Tentativas com proveniência `legado-banco` (F7B), exercícios, revisões e simulados **não** são confundidos com novas respostas de Banco.

As aulas, diagnósticos e exercícios seguem os pesos 20/15/15/30 e o Banco 20, mantendo **75 pontos** como meta. Os indicadores são derivados; o motor não grava uma nota pedagógica artificial.

## Dados e recuperação

- `admEstudo.v2.state`: **jamais gravado pelo motor compartilhado**.
- `estudoConcursos.v1.pedagogy.administracao`: fotografia F7C, protegida por verificação de origem.
- `estudoConcursos.v1.shared-activities.administracao`: aulas e diagnósticos nativos.
- `estudoConcursos.v1.training.administracao`: questões, exercícios, revisão e simulados.
- Recuperações F7B/F7C mantidas. O painel e a conciliação não possuem `setItem` nem `removeItem`.
- Backup manual em `#treino-admin/auditoria`; o JSON **não** é automaticamente restaurável nem sincronizado no Google Drive.

**Se a origem mudar após iniciar atividade nativa, a atualização combinada permanece bloqueada até uma reconciliação segura.** A Fase 8D não apaga dados, nem força a migração.

## Auditoria automatizada

Executar `npm test` antes do build. A publicação do GitHub Actions executa, em ordem, as auditorias 7E, 8B, 8C e 8D. A 8D lê o catálogo real do ADM-ESTUDO fixado em `3790500f772aad3f8c263b68e8e2dfd8bab7c465`, compara diretamente com `moduleAchievement()` e publica:

`/Concurso-Adm/administracao/catalogo-leve/auditoria-fase8d.json`

Os dados esperados do relatório são `moduleCount=27`, `questionCount=757`, `comparedBankScores=324`, `overlapChecks=162`, `discrepancies=0`.

Verificação local desta entrega: **231 testes**, **648** comparações 7E, **1296** 8B, **243** 8C, **324** 8D; zero divergências, com dados sintéticos e conteúdos reais do catálogo. Não equivalem à verificação do progresso pessoal.

## Critérios para encerrar a Fase 8 na instalação

1. `build` e `deploy` verdes; abrir o JSON da Fase 8D e verificar os totais.
2. `#materia/administracao` exibe os 27 módulos **sem iframe**.
3. `#materia/administracao/legado` ainda abre o iframe sem alterar seu histórico.
4. Painel efetivo e aulas/exercícios da Fase 8C continuam funcionando; um módulo com dados herdados apresenta a origem correta.
5. Com origens incompatíveis, a nota fica bloqueada/congelada, não recalculada arbitrariamente.
6. Fazer backup manual e conferir em 2–3 módulos que as atividades do ADM-ESTUDO original permanecem intactas.

## Limites conhecidos

- Banco importado F7C sem dados individuais permanece **não conciliado**, propositalmente.
- Revisão e simulado novos são independentes dos históricos anteriores; não se sincronizam entre dispositivos.
- O antigo ADM-ESTUDO permanece como fallback; não é excluído na 8D.
- As demais disciplinas estão com esqueleto técnico, sem material publicado e sem motor de gravação validado para elas. Sua construção pedagógica começa na Fase 9.
- Limpeza de arquivos legados e sincronização por Google Drive **não** fazem parte deste lote.
