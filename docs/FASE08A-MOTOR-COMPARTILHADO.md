# Fase 8A — Motor pedagógico compartilhado: leitura nativa por módulo

## Escopo desta entrega

Esta entrega é o primeiro lote da Fase 8, não a substituição definitiva do motor legado.
Ela acrescenta um contrato único de módulo e um leitor nativo para aulas e diagnósticos,
sem escrever no progresso do usuário.

- `scripts/build-admin-shared-bundles.mjs`: durante a publicação, lê as aulas,
  diagnósticos e catálogo da cópia já validada de Administração e produz 27 arquivos
  ES independentes: `dist/administracao/catalogo-leve/motor-unificado/modulos/ADM-01.js` etc.
- `site/js/unificado/shared-module-loader.js`: carrega sob demanda o manifesto e
  apenas o módulo aberto. Aceita adaptadores de outras disciplinas que seguem
  o mesmo contrato `estudo-concursos/shared-module/v1`.
- `site/js/unificado/shared-module-ui.js`: telas nativas de índice, aulas paginadas
  e cartões diagnósticos com resposta oculta até o clique. Nenhuma conclusão é
  registrada a partir da leitura.
- `site/js/unificado/app.js`: rota `#estudo/administracao/ADM-01` e afins.
- `site/js/unificado/admin-training-ui.js`: atalhos para o novo leitor nas telas
  de progresso por módulo da Fase 7D.

## Conteúdo e progresso preservados

A origem permanece `profeniclas-lab/Dir-Adm`, branch `nova-arquitetura`, commit
`3790500f772aad3f8c263b68e8e2dfd8bab7c465` fixado no build atual.
O gerador verifica, por módulo, que as aulas, diagnósticos e metadados são
iguais aos objetos originais. Não reescreve enunciados, gabaritos ou comentários.
As 757 questões continuam no catálogo da Fase 5, sem criar uma segunda cópia.
O progresso legado, o histórico do treino novo e as importações das Fases 7B/7C
não são gravados, migrados ou combinados nesta etapa.

## Testes

- `npm test` (Node 22): testes do projeto e os testes do adaptador compartilhado.
- `npm run build` (no Actions): mantém todas as verificações das Fases 4–7E e,
  depois, exige gerar `motor-unificado/manifest.json`.
- Verificação direta sobre o artefato administrativo já publicado:
  `node scripts/build-admin-shared-bundles.mjs dist/administracao`.

## URLs de teste após publicar

- `https://profeniclas-lab.github.io/Concurso-Adm/#treino-admin/modulos`
- `https://profeniclas-lab.github.io/Concurso-Adm/#estudo/administracao/ADM-01`
- `https://profeniclas-lab.github.io/Concurso-Adm/#estudo/administracao/ADM-01/aula/1`
- `https://profeniclas-lab.github.io/Concurso-Adm/#estudo/administracao/ADM-01/diagnostico/1`
- `https://profeniclas-lab.github.io/Concurso-Adm/administracao/catalogo-leve/motor-unificado/manifest.json`

## Planejamento dos lotes restantes da Fase 8 (proposta)

- **8B — Atividades nativas com registro próprio seguro:** diagnósticos,
  conclusão de aulas e autoavaliação, sem sobrescrever o histórico legado.
- **8C — Exercícios, Banco, revisão e simulados no motor compartilhado:**
  reutilizar o núcleo validado da Fase 6 com os contratos das outras matérias;
  comparar critérios pedagógicos e resolver a reconciliação de resultados.
- **8D — Substituição gradual do subaplicativo e auditoria final:**
  comparação das telas, sessões ativas, backups, restauração, erros, estatísticas,
  desempenho e dispositivos; manter fallback até aprovação.

Não retirar o iframe de Administração nesta fase. Não apagar os repositórios
antigos, não alterar chaves de localStorage, nem iniciar migração silenciosa.
