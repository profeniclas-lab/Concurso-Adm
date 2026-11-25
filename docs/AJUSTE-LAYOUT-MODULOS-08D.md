# Ajuste de navegação dos módulos — após Fase 8D

## Motivação

O usuário apontou que `#estudo/administracao/ADM-01` repetia dois botões por subtópico: **Ler aula** e **Diagnóstico**. O diagnóstico avalia o módulo como percurso único, enquanto cada subtópico é uma aula individual. A repetição prejudicava a leitura da página.

Comparamos `Dir-Adm/nova-arquitetura/js/features/module-detail.js` com `Concurso-Adm/main/site/js/unificado/shared-module-ui.js` (antes do ajuste, blob SHA `3c9c41143aa47aab2143c01a0fe5418d3851444e`). A página original tinha uma seção única **Diagnóstico**, outra para **Aulas por subtópico** e outra para **Exercícios**. O ajuste resgata essa hierarquia sem substituir o motor compartilhado, sem retirar Banco de Questões e sem replicar o HTML legado literalmente.

## Nova organização da tela de índice

1. Identificação do módulo + retorno para todos os módulos.
2. **Aproveitamento do módulo**, derivado pelo motor atual sem alterar suas regras.
3. **Atividades do módulo** com exatamente um acesso para cada um: Diagnóstico, Exercícios de aprendizagem e Banco de Questões.
4. **Aulas por subtópico** em uma lista compacta. O nome inteiro é o link que abre a aula (sem botões separados); cada linha mostra status da aula, não um botão de diagnóstico.
5. **Outras ferramentas e informações**, em `details` recolhido (revisão, simulados, estatísticas, histórico anterior e acesso ao ADM-ESTUDO original).

### Comportamento do diagnóstico

- O botão geral localiza o **primeiro cartão ainda não avaliado** e leva à rota já existente `#estudo/administracao/<modulo>/diagnostico/<posição>`.
- Se todos já foram avaliados, oferece rever desde o primeiro cartão.
- As perguntas continuam organizadas internamente por subtópico; isso NÃO significa botões separados no índice.
- Os registros pedagógicos continuam em suas chaves atuais, sem migração ou gravação pelo índice.

### O que não muda

- Os dados de `Dir-Adm` e o snapshot administrativo dos 27 módulos/757 questões;
- As chaves `admEstudo.v2.state`, `estudoConcursos.v1.pedagogy.administracao`, `estudoConcursos.v1.shared-activities.administracao` e `estudoConcursos.v1.training.administracao`;
- A função de cálculo dos 75 pontos, notas herdadas, conciliação do Banco, exercícios, revisão e simulados;
- A página das aulas, a sequência de diagnóstico e seus botões de avaliação;
- Os links externos dos catálogos e o `#materia/administracao/legado`.

## Arquivos do pacote

- **Substituir** `site/js/unificado/shared-module-ui.js` — reestrutura apenas o índice e remove a barra excessiva de ações das páginas internas.
- **Substituir** `site/css/app.css` — estilos dos cartões de atividade, linhas clicáveis e responsividade.
- **Substituir** `tests/shared-module.test.mjs` — atualiza as expectativas de interface antiga para as novas.
- **Adicionar** `tests/module-index-layout.test.mjs` — dez novos testes da navegação e proteção de dados.
- **Adicionar** `docs/AJUSTE-LAYOUT-MODULOS-08D.md` — esta documentação.

O arquivo `INSTRUCOES-DE-INSTALACAO.txt` é guia local; não precisa ser carregado no GitHub.

## Testes locais

- `node --test tests/*.test.mjs` — **241/241** testes aprovados (231 anteriores e 10 novos).
- `npm run build:quick` — concluído (sem Administração, modo local de build).
- Os três arquivos existentes antes do ajuste foram extraídos de ZIPs incrementais e conferidos pelos SHAs atuais da branch `main`.

## Verificação pós-publicação

1. GitHub Actions: `build` e `deploy` verdes.
2. `https://profeniclas-lab.github.io/Concurso-Adm/#estudo/administracao/ADM-01` mostra um único Diagnóstico, Exercícios e Banco na seção comum, seguidos de aulas com links no título.
3. Se houver um cartão diagnóstico já avaliado, o único acesso a Diagnóstico deve iniciar no primeiro pendente; se todos estiverem avaliados, abre o primeiro.
4. Abrir aula, retornar ao índice, verificar status de aula e continuar exercícios existentes.
5. Testar um módulo ainda sem progresso, um parcialmente estudado e um concluído; verificar que nenhum registro nem aproveitamento muda somente ao navegar.
6. Reabrir a versão original via ferramenta recolhível, sem perder o progresso original.

> Este ajuste é **somente de navegação/apresentação**. Não é uma nova migração de histórico, não altera esquema de armazenamento e não revisa conteúdo ou gabaritos.
