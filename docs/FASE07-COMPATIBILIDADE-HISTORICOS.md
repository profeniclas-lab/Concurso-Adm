# Fase 7A — Compatibilidade não destrutiva dos históricos

## Escopo

Esta atualização adiciona a rota `#treino-admin/compatibilidade` e o item **Históricos** na navegação do novo motor de Administração.

Lê, sem modificar:

- `admEstudo.v2.state` — ADM-ESTUDO original, schema 3.
- `estudoConcursos.v1.training.administracao` — treino do portal, schema 1.

O aplicativo original continua sendo responsável pelo aproveitamento ponderado (diagnóstico, aulas, exercícios e banco). O novo painel **não recalcula esse aproveitamento**.

## Indicadores seguros

- Questões distintas respondidas no legado: IDs de `progress.questionHistory` com resposta numérica em `lastAnswer`, `bankAttempt.lastAnswer` ou `attempts[].answer`.
- Questões distintas no novo motor: IDs de `state.questions` validados pelo schema 1.
- Questões vistas em ambos: interseção de IDs (a mesma questão conta apenas uma vez na união).
- Apenas em uma das fontes: diferença de conjuntos de IDs.
- Aulas concluídas, diagnósticos registrados, simulados e agendamentos: apresentados **separadamente** por origem.

### Limitações importantes

1. Ter o mesmo ID não garante que o enunciado/gabarito seja idêntico entre versões editoriais. Essa é uma conferência por ID, não uma auditoria pedagógica.
2. Registros antigos sem resposta numérica não entram na contagem de questões respondidas.
3. `attempts[]` do ADM-ESTUDO pode não cobrir toda a atividade histórica. Não somamos esses dados como se fossem completos.
4. A taxa de acerto do novo motor **não** é fundida com a nota/aproveitamento original, porque representam métricas diferentes.
5. Revisões do legado e do portal não são mescladas ou reagendadas nesta fase.
6. A tela lê apenas o armazenamento da **origem do navegador atual**. Não faz sincronização Google Drive nem descobre dados de outros dispositivos.

## Segurança do armazenamento

O arquivo `legacy-compat.js` não invoca `setItem`, `removeItem` nem `clear`. A tela de compatibilidade usa apenas leitura.

O botão **Exportar cópia dos dois históricos** salva um JSON com as strings brutas dos dois registros. É uma cópia de segurança complementar que permite preservar os bytes textuais originais, mesmo quando um registro tem JSON inválido. **Não é um formato que os aplicativos restaurem diretamente**. Para backup e restauração usuais, continue usando as funções disponíveis no ADM-ESTUDO e no novo treino.

Não apague o armazenamento local, não substitua as chaves do navegador e não misture manualmente os JSONs.

## Instalação

Adicione ou substitua somente os arquivos indicados no pacote, preservando os caminhos. Nenhuma alteração é necessária em `index.html`, `scripts/build-site.sh` ou no repositório `Dir-Adm`.

A publicação é feita pelo workflow `Publicar ESTUDO-CONCURSOS` do repositório `Concurso-Adm`. Confirme que o GitHub Pages utiliza **GitHub Actions** como fonte, e não uma segunda publicação por branch.

## Validação manual após publicação

1. Entre em `https://profeniclas-lab.github.io/Concurso-Adm/#treino-admin`.
2. Abra **Históricos**.
3. Confira que mostra os números existentes no navegador, sem somar repetidas por ID.
4. Acesse o ADM-ESTUDO original no mesmo navegador e confirme que o progresso continua lá.
5. Exporte a cópia de segurança e confirme que o arquivo JSON foi baixado; não tente importá-lo como backup do ADM-ESTUDO.
6. Responda uma questão no novo motor, volte à tela **Históricos** e verifique o novo total. O progresso original não deve ser afetado.

## Próxima etapa proposta

**Fase 7B — Prévia de migração controlada:** estudar com mais profundidade a equivalência de respostas e eventos das duas fontes. Qualquer gravação futura deve exigir backup válido, comparação de IDs e consentimento explícito, com opção de desfazer; na ausência dessas garantias, os históricos permanecem separados.
