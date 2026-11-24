# ESTUDO-CONCURSOS — Fase 8B: registro nativo de aulas e diagnóstico

## Resumo

Esta atualização transforma as aulas e diagnósticos nativos introduzidos na Fase 8A em atividades interativas **somente para Administração**, com registro protegido. O motor original continua acessível, com sua chave de progresso preservada.

Arquitetura: **uma fonte pedagógica de base + uma camada de atividades novas**, nunca duas somas acumuladas. Os pesos e a meta são os mesmos da Fase 7E: diagnóstico 20, conclusão das aulas 15, autoavaliação das aulas 15, exercícios 30, banco 20; meta de pelo menos 75 pontos efetivamente conquistados.

## O que o estudante pode fazer

- Abrir `#estudo/administracao/ADM-01/aula/1` e marcar a aula como estudada.
- Avaliar seu entendimento da aula: `sei`, `duvida`, `nao`. É possível atualizar essa avaliação depois.
- Abrir `#estudo/administracao/ADM-01/diagnostico/1`, revelar o verso e registrar a autoavaliação.
- Abrir o índice `#estudo/administracao/ADM-01` para ver o aproveitamento **com os registros nativos**.
- Ir à auditoria `#treino-admin/auditoria` para exportar as **seis chaves** brutas relevantes (incluindo as atividades da 8B).

Apenas abrir uma aula ou revelar a resposta não registra atividade: é necessário acionar o botão correspondente. Os cartões mantêm a resposta oculta até abrir `Revelar resposta`.

## Armazenamento

Nova chave exclusiva:

`estudoConcursos.v1.shared-activities.administracao`

O registro v1 contém `diagnostics`, `lessons`, `metadata` e `baseline`. Nunca grava em:

- `admEstudo.v2.state` (original, v3);
- `estudoConcursos.v1.pedagogy.administracao` (importação F7C);
- `estudoConcursos.v1.training.administracao` (questões e simulados F6).

A base de leitura tem precedência fixa:

1. Se existe cópia F7C válida, ela é a base do módulo;
2. Caso contrário, o histórico original válido, em leitura;
3. Caso não exista nenhum, o aproveitamento começa sem nota, jamais com 0% artificial.

Ao salvar pela primeira vez, a nova chave recebe a identificação da base e o SHA-256 do conteúdo exato. Ao salvar de novo, o algoritmo confirma que a base não mudou. Se mudou, interrompe a gravação e suspende a pontuação combinada, recomendando backup e reconciliação. O motor também compara o valor bruto da chave nova antes do commit, para detectar atualizações em outra aba.

O rollback da F7C e uma importação posterior da F7C são bloqueados se já existirem atividades nativas vinculadas, para não invalidar o contexto da pontuação.

## Como o aproveitamento é atualizado

- **Diagnóstico**: a classificação feita no motor novo substitui apenas a classificação efetiva do mesmo subtópico. Outra resposta herdada do mesmo ID não é somada.
- **Aulas concluídas**: uma conclusão anterior permanece verdadeira; clicar novamente não gera outra aula concluída.
- **Autoavaliação da aula**: o valor do motor novo prevalece sobre a classificação herdada do mesmo subtópico, sem duplicação.
- **Exercícios e Banco**: mantêm exatamente as parcelas da origem (ou ausência delas). O novo treino de questões continua separado, até a Fase 8C.
- Sem nenhuma atividade nova no módulo, exibe-se a pontuação herdada exata, para não recalcular indevidamente históricos antigos.

A soma vem de `calculatePartialAchievement` da F7C, já comparada ao motor original na F7E. A auditoria 8B reconfronta também os registros nativos diretamente com `moduleAchievement` do ADM-ESTUDO.

## Auditorias e testes

- `npm test`: suíte de regressão do portal e novos testes de proteção, duplicação, conflitos, rollback, persistência e interface.
- `node scripts/audit-phase8b-parity.mjs dist/administracao`: após gerar a cópia administrativa, realiza 24 cenários x 27 módulos x 2 estados (sem/com registros novos) = **1296 comparações** com a função original, bloqueando a publicação diante de divergências.
- Relatório gerado no build: `administracao/catalogo-leve/auditoria-fase8b.json` com `comparedModuleScores:1296`, `discrepancies:0`, `moduleCount:27`, `questionCount:757`.
- Para instalação, seguir `INSTALAR-FASE08B.md`.

## Limites e próximos passos

- As novas respostas são mostradas imediatamente **nas telas nativas do módulo**. Os resumos legados das telas da Fase 7D continuam representando a fotografia anterior e serão conectados na Fase 8C.
- Ainda não há importação de backups JSON, sincronização Google Drive, gravação nativa de exercícios, revisão nem simulados no motor único. O treino de questões continua no motor F6 e o ADM-ESTUDO original permanece disponível.
- Os controles de gravação de Português, Matemática, Informática e Constitucional permanecem desabilitados até seus adaptadores de histórico serem verificados, evitando históricos paralelos incoerentes.
- Não remover o ADM-ESTUDO incorporado nem modificar `Dir-Adm/nova-arquitetura` nesta fase.
- Backups são arquivos com dados pessoais de estudo: não publicar no repositório, nem enviar a terceiros.
