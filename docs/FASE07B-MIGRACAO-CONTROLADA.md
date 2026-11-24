# Fase 7B — Migração controlada do histórico do ADM-ESTUDO

## Objetivo

Importar, **somente mediante solicitação explícita**, uma parte verificável das tentativas de questões do ADM-ESTUDO (schema 3) para o histórico do motor novo (schema 1). A versão pedagógica da Administração, as 757 questões, o motor original e as configurações de domínio/performance não são modificados.

O ADM-ESTUDO continua sendo a fonte original dos registros antigos. O portal cria **cópias seletivas**, identificadas pela origem, em uma chave de armazenamento separada.

## O que é importado

- Apenas questões cuja entrada em `progress.questionHistory[id].attempts` contém registros de respostas completos.
- Apenas tentativas originadas de `banco`, `revisao` ou `simulado`, com data, alternativa numérica e correção coerente com a **questão atual** de mesmo ID.
- Apenas IDs que ainda não existem em `estudoConcursos.v1.training.administracao`.
- A origem das tentativas é mantida em `history[].source` (`legado-banco`, `legado-revisao`, `legado-simulado`) e em `provenance`.
- Nenhuma revisão antiga é convertida para a agenda nova: `dueAt` começa como `null` nas questões importadas, e só será recalculado após uma nova resposta no motor novo.

## O que NÃO é importado

- `lastAnswer` ou `bankAttempt.lastAnswer` sem tentativas detalhadas. Isso seria inventar um histórico de tentativas.
- Tentativas provenientes apenas de `exercicios`: os exercícios de aprendizagem têm finalidade diferente do Banco de Questões.
- Questões cujos registros discordam do gabarito atual, que não existem no catálogo de 757 questões, ou que foram marcadas como revisadas editorialmente (`pedagogicalRevision`). Mesmo respostas com o mesmo índice podem ter correspondido a alternativas diferentes antes da revisão.
- Diagnósticos, aulas, avaliações, notas de aproveitamento (20% diagnóstico, 30% aulas, 30% exercícios, 20% banco), flashcards e estatísticas pedagógicas específicas.
- Simulados **históricos** como sessões ou resultados separados, embora tentativas detalhadas originadas de simulados possam ser copiadas como tentativas de questões.
- Revisões e horários de agendamento do algoritmo antigo.

Não há sincronização de Google Drive nem mesclagem bidirecional de dados nesta fase.

## Fluxo seguro da interface

1. Abra `#treino-admin/compatibilidade` no mesmo navegador em que o progresso antigo está armazenado.
2. Clique **Preparar prévia sem gravar**. Na primeira vez, essa verificação carregará os 27 módulos para relacionar IDs dos lotes às questões atuais.
3. Confira a quantidade importável e os motivos pelos quais alguns itens são ignorados.
4. Clique **Exportar cópia dos dois históricos** e **confirme que o arquivo JSON realmente foi salvo e pode ser aberto**. Essa cópia é bruta e não é restaurada automaticamente pelos aplicativos.
5. Só então clique **Confirmar importação** e aceite as duas confirmações. A operação grava somente o histórico novo; o ADM-ESTUDO original permanece intocado.
6. A tela exibirá os resultados conjuntos e uma opção de desfazer a importação, **apenas se não houve nenhuma atividade nova desde a conclusão**.

## Proteção técnica

Chaves usadas:

- Original, **somente leitura**: `admEstudo.v2.state`
- Novo treino: `estudoConcursos.v1.training.administracao`
- Recuperação automática: `estudoConcursos.v1.migration-recovery.administracao`

O código verifica que os dois valores brutos de armazenamento são os mesmos da prévia (proteção contra alteração por outra aba). Em seguida, grava **primeiro uma cópia de recuperação do histórico novo** e só depois a versão importada. Se a cópia não puder ser gravada por falta de espaço, a importação é interrompida.

A restauração da cópia automática exige que o texto completo do histórico novo seja **idêntico** ao que foi gravado pela migração; assim, não apaga respostas feitas depois. O backup bruto exportado manualmente também deve ser conservado.

Uma operação interrompida antes da importação pode deixar apenas uma cópia técnica; ela poderá ser liberada pela interface se o novo histórico ainda estiver exatamente igual ao anterior.

## Limitações e decisões futuras

Esta fase NÃO gera um histórico pedagógico único. Uma taxa de acerto do motor novo que inclua tentativas importadas não é equivalente à nota de aproveitamento calculada no ADM-ESTUDO original. Aulas, diagnósticos, exercícios e revisões precisam de uma etapa posterior de migração por regras, evitando perda de contexto.

Dados armazenados em **outro navegador ou dispositivo** não estão acessíveis automaticamente. É necessário exportar/transferir os arquivos separadamente; isso será objeto de uma fase posterior.

## Testes

Na raiz do projeto, use `npm test` e confira a execução do workflow **Publicar ESTUDO-CONCURSOS**. O arquivo `tests/legacy-migration.test.mjs` cobre prévia, tentativas verificáveis, duplicações, conflito entre abas, proteção do legado, recuperação, quota e renderização.
