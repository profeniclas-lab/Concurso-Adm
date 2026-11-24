# Fase 8C — Exercícios, Banco, revisão, simulados e estatísticas em um motor compartilhado

## Escopo e arquitetura

Este lote não substitui o ADM-ESTUDO incorporado. Ele ativa **Exercícios de aprendizagem** em `#estudo/administracao/MODULO/exercicios` e conecta os dados de treino às telas nativas da Fase 8B.

- O motor de exercícios e os motores já existentes do Banco, revisão e simulado compartilham a chave **`estudoConcursos.v1.training.administracao`** e o objeto `questions`, indexado por ID. Uma questão respondida em exercícios e no Banco continua sendo **uma questão distinta com duas tentativas**.
- A sessão de exercícios fica em `training.exerciseSessions[moduloId]`. O campo é opcional para históricos gerados antes da 8C; não houve reset nem troca de chave ou de versão do schema v1.
- O campo opcional `training.exerciseBaseline` fixa a origem pedagógica (fonte e hash SHA-256 da string bruta), evitando novas gravações se a referência do progresso herdado mudar. O registro original `admEstudo.v2.state`, a importação 7C e o progresso das aulas 8B são **somente leitura** nesta etapa.
- O motor administrativo antigo permanece acessível. Nenhum ID, texto ou gabarito do banco de 757 questões é alterado.

## Nova sessão de exercícios

A mesma escolha de conteúdo do ADM-ESTUDO: **todas as questões de dificuldade `media` e seis de `dificil`**, diversificadas por subtópico quando possível. Os 27 módulos do catálogo aprovado possuem essas questões. A sessão é sorteada sem IDs repetidos e mantida no localStorage, mesmo quando o navegador é fechado.

Cada resposta:

1. é validada pelo módulo e pelo índice da alternativa **original**;
2. gera **uma tentativa**, identificada como `source: 'exercise'` no histórico comum;
3. exibe correção, fundamento e comentários já cadastrados;
4. exige autoavaliação antes de permitir avançar;
5. agenda revisão com os intervalos existentes: `seguro=7`, `duvida=3`, `chute=1`, `desconhecimento=1`, `pegadinha=2`, `interpretacao=2`, `desatencao=3` dias.

Questões acertadas mas marcadas para revisão ficam na fila sem virar falsos erros. A avaliação permanece vinculada à tentativa de exercício mesmo se houver outra tentativa intermediária no Banco.

## Aproveitamento parcial

Os pesos permanecem: diagnóstico 20; aulas concluídas 15; autoavaliação das aulas 15; exercícios 30; Banco 20. **Meta de 75 pontos**.

- Antes de responder a uma nova sessão de exercícios, o componente herdado é conservado.
- Após a primeira resposta, o componente Exercícios usa **taxa de acertos × cobertura da sessão**. Isso **substitui** a contribuição anterior de Exercícios; não se somam os dois componentes.
- Se o histórico herdado não possui componente Banco, as tentativas de `source: 'bank'` do novo motor podem compor seus 20 pontos. A correspondência é confirmada pelo catálogo atual e o gabarito original.
- Se já existe componente Banco herdado, o sistema **não consegue conciliar com segurança a média antiga por ID usando apenas o resumo F7C**: mantém a pontuação herdada e mostra a prática recente do Banco separadamente. A reconciliação completa e a aposentadoria do subaplicativo ficam para a **Fase 8D**.
- Revisões e simulados entram nas estatísticas de tentativas, mas não criam um segundo componente de pontuação. Também não contam como respostas no Banco.

A lista de módulos herdada da F7D continua uma **fotografia histórica**. Use a rota nativa `#estudo/administracao/MODULO` para consultar a nota parcial com as atualizações 8B/8C.

## Segurança

- Leitura e validação da origem antes de cada operação; checksum de origem vinculado a sessões nativas.
- Controle otimista de concorrência (CAS) na chave de treino; guarda imediatamente antes de gravar.
- Impossível continuar uma sessão com ID não encontrado no catálogo ou resposta fora das alternativas.
- Proteção contra nova importação/desfazimento 7C quando houver sessão de exercícios da 8C.
- A auditoria 7E continua exportando a chave de treino inteira, inclusive sessões de exercícios, e o estado de aulas 8B. **Esse backup não é restaurado automaticamente**. Guarde cópia local e não publique arquivos pessoais no GitHub.

## Testes e validação

- `npm test`: suíte integrada (210 testes locais nesta versão).
- `npm run build:quick`: montagem do portal sem copiar Administração.
- GitHub Actions executa `scripts/audit-phase8b-parity.mjs` (1.296 comparações) e `scripts/audit-phase8c-integration.mjs` (243 cenários de exercícios + 243 verificações de duplicação por ID), com **27 módulos e 757 questões reais**. Falha de integridade impede publicar.
- Relatório publicado em `/administracao/catalogo-leve/auditoria-fase8c.json`, com `discrepancies: 0`.

A auditoria usa dados sintéticos sobre o catálogo real, **não** os registros do navegador do usuário. Foi tentada a abertura automatizada no Chromium deste ambiente, mas ele não concluiu; a verificação visual e funcional no GitHub Pages é necessária.

### Checklist de aceitação no navegador

1. Entrar em `#estudo/administracao/ADM-01/exercicios` e iniciar atividade.
2. Responder, ver a correção e marcar o motivo da revisão.
3. Atualizar a página: sessão e correção devem permanecer.
4. Voltar ao módulo: os pontos de Exercícios refletem as respostas parciais sem duplicar a nota herdada.
5. Revisão e Estatísticas: tentativas de Exercícios aparecem no histórico comum.
6. Banco: uma questão que só foi respondida no exercício continua permitindo a primeira resposta **no Banco**.
7. Simulado: continua funcionando e compartilhando IDs, mas não conta automaticamente como atividade do Banco.
8. Conferir o ADM-ESTUDO original e a Fase 8B. Não apagar localStorage nem realizar migrações novas sem backups.

## Próxima fase

**8D — Reconciliação integral e transição**: testar interações reais, unificar os componentes pedagógicos remanescentes de Banco sem fabricar tentativas, estabilizar o fluxo de módulos, comparar funções antigas e novas, manter fallback e planejar a retirada segura do iframe administrativo.
