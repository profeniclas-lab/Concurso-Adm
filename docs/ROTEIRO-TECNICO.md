# Roteiro técnico — ESTUDO-CONCURSOS

## F2 — Entrega atual
- Site unificado navegável, cinco disciplinas cadastradas, tema claro/escuro.
- Administração disponível via cópia integral *inalterada* do commit de `nova-arquitetura` no diretório publicado `administracao/`.
- Engine inicial para novas disciplinas, sem dados pedagógicos fictícios.
- Namespace exclusivo de armazenamento e testes.

## F3 — Adaptador de conteúdo administrativo (SEM revisão editorial)
- Extrair os catálogos de Administração para um registro técnico sem modificar os textos, IDs, gabaritos, nem avaliações.
- Dividir o arquivo grande de questões em pacotes técnicos, mantendo ordem e conteúdo textual.
- Comparar automaticamente contagens, hashes por ID, gabarito, alternativas e metadados antes/depois.
- Manter o subaplicativo como fallback durante migração; só trocar após testes funcionais equivalentes.

## F4 — Motor pedagógico compartilhado
- Diagnóstico, aula paginada, exercícios, banco, revisão e simulados usando mesma infraestrutura, a partir de adaptadores da disciplina.
- Progresso separadamente por disciplina com agregação somente-leitura para Dashboard.
- Proteção contra conflitos, backup/restauração e migração explícita, com testes.
- Tratamento de questão de texto base, fórmula matemática e imagens com validação.

## F5 — Português (módulos por pequenos lotes)
- Iniciar `POR-01`, testes pedagógicos específicos de Português apenas.
- Entrega por módulo e tipo de arquivo, sem arquivos monolíticos.
- Validar URLs, IDs, gabaritos e conteúdo após cada lote.

## Regras de proteção
1. Nunca apagar `Dir-Adm` nem sua branch `nova-arquitetura`.
2. Não refazer auditoria de conteúdo ou questões de Administração; na migração apenas conferir equivalência binária/estrutural.
3. Nunca renumerar IDs existentes.
4. Jamais substituir automaticamente `admEstudo.v2.state`.
5. Cópia de trabalho e publicação separadas; release só após testes.
