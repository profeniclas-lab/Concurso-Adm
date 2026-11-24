# Fase 6 — Motor de treino com carregamento por módulo

## Objetivo

Adicionar ao portal ESTUDO-CONCURSOS uma **área nova e independente de treino de Administração**, com regras de questão e persistência **parametrizáveis por disciplina**, baseada no catálogo leve publicado na Fase 5 (`administracao/catalogo-leve/`). O banco existente continua com **757 questões distintas em 27 módulos**. Não são criados, editados ou auditados pedagogicamente enunciados, alternativas, gabaritos ou comentários.

**Importante: o ADM-ESTUDO original permanece disponível e inalterado.** O novo motor não substitui suas regras de aproveitamento, diagnóstico, exercícios, revisão espaçada ou seus históricos. Isso evita migrações arriscadas antes de concluirmos a compatibilidade entre modelos de dados.

## Novas telas

- `#treino-admin` — painel do novo treino e links para banco, simulado, revisão e estatísticas.
- `#treino-admin/modulos` — lista de 27 módulos, com contagem de questões.
- `#treino-admin/banco/ADM-01/1` — questões com respostas salvas e correção imediata; cinco por página.
- `#treino-admin/simulado` — simulado de **20 questões**, geral (até 10 módulos carregados) ou por módulo (desde que tenha 20+ questões), com retomada após recarregar e correção no final.
- `#treino-admin/revisao` — revisões vencidas, calculadas com intervalos simples.
- `#treino-admin/revisao/todas` — todas as questões já erradas; cinco por página.
- `#treino-admin/estatisticas` — tentativas, taxa de acerto, resultados de simulados e exportação do histórico.

## Segurança e progresso

A nova área grava **somente** a chave `estudoConcursos.v1.training.administracao` no `localStorage` do navegador. Nunca grava `admEstudo.v2.state` e não modifica os dados do ADM-ESTUDO original.

Consequências: o histórico do treino novo NÃO aparece nas estatísticas do ADM-ESTUDO; o histórico antigo NÃO é automaticamente mesclado ao novo. Ambos coexistem durante a migração. A taxa de acerto exibida nesta fase NÃO equivale ao índice de aproveitamento pedagógico ponderado de 75%.

O núcleo de treino pode ser reutilizado pelas outras disciplinas (`createTrainingStore(subjectId)`), mantendo uma chave distinta para cada uma. Nesta fase, somente Administração recebe a interface interativa. O sistema recusa sobrescrever estados inválidos e compara o valor atual no armazenamento antes de gravar para detectar concorrência entre abas. **Existe exportação JSON, mas ainda não existe importação nem sincronização entre dispositivos.** Não limpe o navegador que contém progresso do novo treino. A integração de históricos, backup/restauração e Google Drive depende de uma fase posterior.

## Instalação no Concurso-Adm

Este pacote é **incremental**. No repositório `profeniclas-lab/Concurso-Adm`, branch `main`:

1. Substituir `site/js/unificado/app.js` pelo arquivo completo entregue.
2. Substituir `site/css/app.css` pelo arquivo completo entregue.
3. Adicionar os arquivos completos `site/js/unificado/training-engine.js`, `training-store.js` e `admin-training-ui.js`.
4. Adicionar `tests/admin-training.test.mjs` e `docs/FASE06-TREINO-INTERATIVO.md`.
5. Criar um commit. O workflow **Publicar ESTUDO-CONCURSOS** (`.github/workflows/pages.yml`) já existente deve rodar `npm test` e `npm run build`.

**Não alterar:** `index.html`, `site/index.html`, `js/data` do ADM-ESTUDO, os arquivos do catálogo de questões, `scripts/build-site.sh`, as branches de `Dir-Adm` ou o armazenamento do navegador.

Não envie o ZIP como um único arquivo: extraia-o e preserve os caminhos de pastas.

## Validação manual na publicação

1. Confirmar que a ação **Publicar ESTUDO-CONCURSOS** terminou com sucesso; a origem de Pages precisa estar em **GitHub Actions**.
2. Abrir `https://profeniclas-lab.github.io/Concurso-Adm/#treino-admin`.
3. Abrir Banco → ADM-01. Conferir que cinco itens são renderizados por página e que ao responder há correção e histórico após recarregar.
4. Abrir Revisão → Todos os erros. Conferir que aparece a questão errada e que uma nova tentativa funciona.
5. Abrir Simulados; selecionar Geral; responder às 20 questões, finalizar e verificar a nota em Estatísticas. Alternativamente, testar retomada recarregando a página no meio do simulado.
6. Confirmar que o ADM-ESTUDO original abre, e que seu histórico e estatísticas não foram modificados por respostas feitas no novo treino.
7. Em Estatísticas do novo treino, exportar uma cópia JSON. Essa função **não** importa o arquivo de volta nesta fase.

## Limitações deliberadas

- A nova área salva em um histórico separado (compatibilidade com o original ainda pendente).
- O simulado geral importa somente até dez módulos, não o banco completo, e não pretende reproduzir integralmente a distribuição de uma banca.
- A revisão nova utiliza intervalos básicos (erro: 1 dia; acerto subsequente: 3, 7, 15 e 30 dias). A revisão adaptativa detalhada do ADM-ESTUDO continua no motor antigo.
- O índice pedagógico com pesos Diagnóstico 20%, Aula 30%, Exercícios 30%, Banco 20% continua no ADM-ESTUDO original.
- Sem importação/restauração/sincronização do histórico do novo treino nesta fase.
- Os testes automatizados executados localmente são técnicos e usam questões de teste sintéticas; a publicação real e o funcionamento visual no GitHub Pages precisam de conferência após o envio.

## Próxima etapa

Criar um adaptador de migração reversível para a leitura dos históricos dos dois motores e harmonizar o estado por disciplina antes de desativar a integração do ADM-ESTUDO original. Nenhuma migração automática será ativada sem testes de preservação de dados, IDs e tentativas.
