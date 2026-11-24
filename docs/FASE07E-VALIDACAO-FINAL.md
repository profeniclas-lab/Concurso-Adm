# Fase 7E — Auditoria final e encerramento técnico da migração

## Escopo e estado

A Fase 7E encerra o **ciclo de compatibilidade e migração controlada** das Fases 7A–7D. Ela NÃO remove o ADM-ESTUDO incorporado, não modifica os arquivos originais de Administração e não unifica automaticamente taxas de acerto ou agendas de revisão. A substituição definitiva do motor legado pertence à **Fase 8**.

A arquitetura tem três origens diferentes:

1. `admEstudo.v2.state`: progresso ADM-ESTUDO original, **somente leitura pelo portal**.
2. `estudoConcursos.v1.training.administracao`: tentativas e simulados do novo motor, que podem conter uma migração 7B opcional.
3. `estudoConcursos.v1.pedagogy.administracao`: fotografia de aulas, diagnósticos e exercícios importados opcionalmente na Fase 7C; a tela 7D exibe esta fotografia se existir.

**Nunca misturar as duas formas de pontuação**: aproveitamento pedagógico (20+15+15+30+20, meta de 75 pontos) versus percentual de acerto do treino novo.

## Nova página: Verificação 7E

URL: `https://profeniclas-lab.github.io/Concurso-Adm/#treino-admin/auditoria`

- Confere se o índice contém **27 módulos e 757 IDs únicos**;
- Valida os formatos das duas fontes e a assinatura do catálogo da cópia 7C;
- Informa quantas questões aparecem em ambos os históricos sem duplicar IDs na união;
- Avisa sobre questões fora do catálogo, diferenças de módulos ou tentativas importadas inconsistentes;
- Identifica recuperações técnicas ainda presentes ou com formato inválido;
- Destaca quando o ADM-ESTUDO foi atualizado após a importação pedagógica;
- Oferece **Exportar os cinco registros**, um JSON de proteção com as strings brutas de:
  - `admEstudo.v2.state`;
  - `estudoConcursos.v1.training.administracao`;
  - `estudoConcursos.v1.pedagogy.administracao`;
  - `estudoConcursos.v1.migration-recovery.administracao`;
  - `estudoConcursos.v1.pedagogy-recovery.administracao`.

A tela é **100% somente leitura**, exceto pelo download solicitado pelo usuário, que não altera o localStorage. Os backups contêm histórico pessoal de estudo e **NUNCA devem ser enviados ao GitHub**. Eles não são arquivos de restauração automática.

Os estados de retorno da auditoria são `ok`, `aviso`, `erro`, `info`. Ausência de dados no navegador não significa corrupção. Avisos de dados antigos modificados indicam necessidade de conferir o original; não autorizam sobrescrita.

## Auditoria independente do cálculo original no build

Durante `npm run build`, depois de gerar `dist/administracao/catalogo-leve/pedagogia-index.json`, é executado:

```bash
node scripts/audit-phase7e-parity.mjs dist/administracao
```

A validação **importa e executa a função verdadeira** `moduleAchievement()` de `dist/administracao/js/features/module-achievement.js`, proveniente da versão administrativa fixada, e a compara a `modulePedagogy()` do portal com os **mesmos estados artificiais**.

Ela utiliza 24 cenários determinísticos × 27 módulos = **648 comparações**. Em cada comparação, verifica pontos ponderados, cobertura, porcentagem e componentes individuais (diagnóstico, aula concluída, autoavaliação, exercícios e banco de questões). Os cenários incluem módulos sem respostas, atividades parciais, respostas certas/erradas e sessões de exercícios incompletas.

Se houver divergência, o build termina com erro e não publica a versão incompatível. Se passar, gera um relatório público sem dados pessoais:

`https://profeniclas-lab.github.io/Concurso-Adm/administracao/catalogo-leve/auditoria-fase7e.json`

Resultado verificado localmente com o **artefato publicado da Fase 7D** (workflow concluído com sucesso no GitHub, commit `3a7c55e1afb9ac2986c2e7b3cc35f2044952cf61`):

- 757 questões preservadas;
- 27 módulos preservados;
- 648 avaliações de módulo comparadas;
- **0 divergências de cálculo** nos cenários artificiais;
- 151 testes da suíte local concluídos com sucesso depois da inclusão da 7E.

**Limite do teste**: os 648 cenários não são o histórico privado do usuário. A comparação manual do histórico real ainda é indispensável, especialmente se houver sessões ativas protegidas por revisão editorial F23 ou alterações posteriores à importação.

## Instalação

Arquivos que mudam:

- **Substituir** `scripts/build-site.sh`;
- **Substituir** `site/js/unificado/admin-training-ui.js`;
- **Adicionar** `scripts/audit-phase7e-parity.mjs`;
- **Adicionar** `site/js/unificado/phase7e-audit.js`;
- **Adicionar** `tests/phase7e-audit.test.mjs`;
- **Adicionar** `docs/FASE07E-VALIDACAO-FINAL.md`.

Não alterar `index.html`, `site/css/app.css`, o repositório `Dir-Adm` nem as questões.

Depois de fazer commit no `Concurso-Adm/main`, verificar GitHub Actions → **Publicar ESTUDO-CONCURSOS**: `build` e `deploy` devem ficar verdes.

Se `build` falhar na auditoria F7E, **não remova a verificação**. Guarde o log, analise o módulo e a divergência; o site anterior permanece como alternativa.

Se apenas `deploy` falhar com erro HTTP 500 enquanto `build` estiver verde, verificar GitHub Status e tentar **Re-run failed jobs**. Esse erro normalmente se refere ao serviço de publicação, não a uma modificação de conteúdo.

## Checklist manual final (obrigatório para o histórico real)

1. Abra a nova Verificação 7E e exporte uma cópia dos cinco registros, caso existam.
2. Entre no ADM-ESTUDO original e no portal **no mesmo navegador**. Compare pelo menos três módulos: um sem atividade, um parcialmente estudado e um que tenha concluído a meta (se houver).
3. Compare os pontos **com casas decimais**, não somente a porcentagem inteira. Meta: **75 pontos ponderados**. Treino novo não soma pontos na fotografia importada.
4. Confira se as questões distintas dos dois históricos não são somadas duas vezes.
5. Confira se simulados, revisões e erros existentes continuam acessíveis; nenhum deve ser apagado ou alterado pela nova auditoria.
6. Se houver importação 7B/7C, confira se as recuperações pendentes são mostradas e se uma nova atividade impede restauração destrutiva. **Não acione recuperação sem necessidade e backup confirmado.**
7. Verifique a URL `auditoria-fase7e.json` com `comparedModuleScores=648`, `discrepancies=0`, `questionCount=757` e `moduleCount=27`.
8. Confirme que o ADM-ESTUDO incorporado e a opção de abrir em tela cheia ainda funcionam.

## Critérios de encerramento

A Fase 7E pode ser marcada **concluída** quando:

- Build e deploy reais finalizarem com sucesso;
- Relatório técnico publicado mostrar 648 comparações, nenhuma divergência e 757 questões;
- O usuário conferir a nova rota sem perda ou corrupção dos seus próprios dados;
- Qualquer alerta relevante for analisado, sem sobrescrever o progresso existente;
- O backup de segurança tiver sido salvo fora do GitHub.

Mesmo concluída, a Fase 7 não implica motor único em produção. **Fase 8**: migração do motor inteiro, incluindo aulas, diagnósticos, exercícios, Banco, simulados, revisão, flashcards, Meus Erros, estatísticas e integração das futuras disciplinas, com retirada do iframe apenas após equivalência funcional comprovada.
