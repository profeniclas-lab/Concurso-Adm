# Fase 7D — O aproveitamento herdado dentro das telas de módulos

## Objetivo

Conectar a **cópia pedagógica opcional da Fase 7C** à navegação de módulos
administrativos do **novo motor**, sem transferir nem somar tentativas mais
recentes às notas herdadas. A publicação continua incluindo o ADM-ESTUDO
original, preservado em `administracao/`.

## Endereços

- `#treino-admin/modulos` — 27 módulos, aproveitamento da Fase 7C e atividade
  própria do motor novo, apresentados **separadamente**.
- `#treino-admin/modulo/ADM-01` — exemplo de detalhe: composição da nota,
  situação de diagnóstico e aulas por subtópico, exercícios registrados e
  estatísticas de treino do módulo.
- `#treino-admin/banco/ADM-01/1` — banco interativo que já existia. O link para
  o progresso aparece nesse banco; responder uma questão **não muda** o
  aproveitamento da cópia pedagógica.
- `#treino-admin/pedagogia` — prévia/importação e recuperação da Fase 7C.

## Dados usados

**Prioridade da fonte da pontuação:**

1. Se existir cópia pedagógica compatível na chave
   `estudoConcursos.v1.pedagogy.administracao`, mostrar **somente essa
   fotografia** e sua data de importação.
2. Caso não exista cópia e o estado `admEstudo.v2.state` seja válido, calcular
   **somente em leitura** os pontos do histórico original, com as regras da
   Fase 7C.
3. Sem nenhuma das duas fontes, mostrar *sem pontuação registrada*, em vez de
   inventar uma nota de zero.

Dados mais novos em `estudoConcursos.v1.training.administracao` são exibidos
num quadro **independente**: questões distintas, tentativas, taxa de acerto e
revisões vencidas. Não existe soma de pontos, mesclagem de agendamentos ou
reescrita de registros antigos.

A cópia F7C é validada contra o hash do catálogo de 757 questões. Se a cópia
não for compatível, o aplicativo apresenta erro para evitar mostrar uma nota
de outro catálogo. O usuário deve conservar o backup e consultar a Fase 7C.

## Aproveitamento

A lógica da Fase 7C permanece, como cálculo derivado e sem gravação:

| Evidência | Peso máximo |
| --- | ---: |
| Diagnóstico | 20 |
| Aulas concluídas | 15 |
| Autoavaliação das aulas | 15 |
| Exercícios de aprendizagem | 30 |
| Banco original | 20 |
| **Total** | **100** |

A meta é **pelo menos 75 pontos conquistados**. Não confundir o inteiro
`percentage`, exibido como nota parcial, com a soma decimal efetiva de pontos.
A resposta de uma questão no novo motor não altera a fotografia pedagógica.

## Dados de catálogo e títulos de subtópicos

O gerador `scripts/build-admin-pedagogy-index.mjs` passa a copiar também
**IDs e títulos de subtópicos** do catálogo original para o índice leve
`catalogo-leve/pedagogia-index.json`. Nenhum conteúdo de aula ou questão é
reescrito, e a validação de 27 módulos/757 questões continua obrigatória.
A cópia importada da Fase 7C preserva a compatibilidade, pois a verificação
de correspondência usa o mesmo `catalogSha256` do banco original.

## O que esta fase NÃO faz

- Não atualiza automaticamente uma fotografia F7C quando você estuda mais no
  ADM-ESTUDO original; nesse caso, apresenta aviso de possível desatualização.
- Não transforma avaliações novas em pontuação pedagógica herdada.
- Não apaga, migra ou escreve em `admEstudo.v2.state`.
- Não oculta automaticamente módulos ao alcançar 75 pontos — essa mudança
  precisa ser testada separadamente no dashboard global.
- Não substitui o motor administrativo incorporado nem sincroniza Google Drive.

## Instalação e aceite

1. Substitua os arquivos conforme `INSTALAR-FASE07D.md` na raiz do ZIP.
2. Faça commit na branch `main` do `Concurso-Adm` e confirme **build + deploy**
   concluídos no GitHub Actions.
3. Visite `#treino-admin/modulos` e `#treino-admin/modulo/ADM-01`.
4. Confira dois módulos com atividade (se houver): a nota e os componentes
   devem corresponder à **fotografia importada** ou, sem importação,
   ao ADM-ESTUDO original.
5. Confira um módulo sem atividade (mostra *sem pontuação registrada*).
6. Responda uma questão no novo Banco; a contagem do treino deve mudar,
   **mas a nota herdada não**.
7. Verifique que a aplicação administrativa antiga ainda abre e que o
   histórico continua intacto.

Se o deploy falhar por erro 500 no serviço GitHub Pages com build verde,
reexecute apenas os jobs que falharam; não modifique as questões.

**Próxima subfase: 7E** — reconciliação e auditoria técnica da migração.
