# ESTUDO-CONCURSOS — Fase 7C: aproveitamento e evidências pedagógicas

## Objetivo

Leitura e migração opcional das evidências pedagógicas de Administração sem alterar
`Dir-Adm` nem a chave original `admEstudo.v2.state` do ADM-ESTUDO.

A Fase 7B (tentativas de questões) continua separada. O registro novo da Fase 7C é
`estudoConcursos.v1.pedagogy.administracao`; não substitui o registro de treino
`estudoConcursos.v1.training.administracao` nem o motor original.

## Pontuação idêntica à regra F23, Lote 4

- Diagnóstico: **20** pontos; `sei=100`, `duvida=50`, `nao=0`; cobertura por cartões respondidos.
- Aulas: **15** pontos por conclusão e **15** por autoavaliação; ambas têm cobertura independente.
- Exercícios: **30** pontos; acertos sobre respostas dadas e cobertura de respostas sobre questões da sessão.
- Banco: **20** pontos pela proporção de acertos entre questões distintas respondidas no Banco, sem reduzir a nota pela cobertura do banco. Utiliza `bankAttempt.lastAnswer` ou os registros compatíveis `assessment=acerto_banco/erro_banco`, como o ADM-ESTUDO.
- O total é a soma de pontos ponderados disponíveis, **não** uma média das etapas concluídas. `percentage` é o piso dos pontos. O módulo atinge a meta somente com `earnedWeightedPoints >= 75`.

**Importante:** o índice é derivado do catálogo publicado; sessões legadas ativas ou alterações editoriais condicionais podem fazer alguns registros não corresponderem. Se isso ocorrer, compare no ADM-ESTUDO original antes de confiar na nota exibida.

## Índice pedagógico técnico

Durante o GitHub Actions, `scripts/build-admin-pedagogy-index.mjs` gera:

`dist/administracao/catalogo-leve/pedagogia-index.json`

A geração bloqueia a publicação se as 757 questões, 27 módulos, gabaritos ou hash do catálogo divergirem da Fase 5. O arquivo contém somente metadados: IDs e disponibilidade de aulas, diagnósticos e índice técnico de gabarito. Não contém enunciados, textos das aulas nem registros pessoais.

## Fluxo no aplicativo

1. Acesse `#treino-admin/pedagogia`.
2. Verifique o aproveitamento parcial do histórico original, calculado **somente em leitura**.
3. Clique em **Preparar prévia sem gravar**. A prévia lista as evidências importáveis e sessões incompatíveis que serão mantidas no original.
4. Baixe **Exportar backup dos históricos e da cópia pedagógica**. Abra e confirme que o JSON foi salvo antes de importar.
5. Confirme a importação. Os registros elegíveis são copiados para a nova chave; o original permanece intacto.
6. Caso necessário, utilize **Desfazer importação pedagógica** enquanto o registro não tiver sido modificado depois da importação. A recuperação é armazenada em chave exclusiva.

### O que é copiado

- Respostas válidas dos diagnósticos em seus subtópicos originais;
- Conclusão e autoavaliação explícitas de aulas identificadas no catálogo;
- Sessões de exercícios com IDs e respostas válidos (sem inventar conclusão);
- Uma fotografia do aproveitamento por módulo no momento da importação, inclusive contribuição histórica do Banco de Questões.

### O que não é copiado

- Enunciados, conteúdos ou gabaritos das questões;
- Tentativas detalhadas de questões, simulados ou agendamentos (tratados na Fase 7B ou mantidos no original);
- Registros incompatíveis ou sem equivalência identificável;
- A nota pedagógica para dentro das estatísticas do novo treino: as duas medidas ainda permanecem separadas;
- Histórico de outro navegador ou conta do Google Drive.

## Proteção e recuperação

- A prévia não faz gravações.
- A importação exige backup prévio solicitado pela interface e confirmação explícita.
- Antes de gravar, confere se os dois históricos continuam iguais aos da prévia (controle contra mudanças em outras abas).
- Salva uma recuperação técnica **antes** de gravar a nova chave pedagógica.
- O rollback funciona somente se a chave ainda corresponder ao estado salvo no ato da importação. Caso tenha mudado, impede substituição silenciosa.
- Se a importação for interrompida após a recuperação e antes da gravação, a mesma opção de recuperação poderá liberar a cópia técnica não aplicada.
- O arquivo de backup contém dados pessoais de estudo e não deve ser publicado no GitHub.

## Verificação de publicação

1. GitHub → Actions → **Publicar ESTUDO-CONCURSOS**: ambos os jobs `build` e `deploy` devem concluir com sucesso.
2. O endereço `/Concurso-Adm/administracao/catalogo-leve/pedagogia-index.json` deve retornar JSON com `questionCount=757` e `moduleCount=27`.
3. Acesse `/Concurso-Adm/#treino-admin/pedagogia` e confira os indicadores.
4. O ADM-ESTUDO original deve continuar abrindo e exibindo suas atividades normalmente.

Se o build falhar na geração do índice, **não** remova as verificações: examine as mudanças feitas na origem ou retorne ao commit aprovado. Não faça migração com contagens divergentes.
