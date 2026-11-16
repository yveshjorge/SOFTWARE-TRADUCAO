# MVP revisado — Léxica

Rascunho pronto para revisar em grupo e copiar para o Miro/Confluence. O escopo parte do aplicativo já implementado no repositório SOFTWARE-TRADUCAO.

## Problema

Tradutores freelancers precisam manter os mesmos termos consistentes entre textos, clientes e projetos. Quando as decisões ficam espalhadas em arquivos e anotações, é demorado localizar traduções anteriores, entender o contexto e repetir uma escolha com segurança.

## Público prioritário

Tradutor autônomo ou freelancer que trabalha com projetos recorrentes e precisa consultar a própria terminologia. As demais personas do espaço podem ser usadas em validações posteriores; para o primeiro teste, recrutar participantes que se reconheçam nesse perfil.

## Hipótese do MVP

Se tradutores puderem registrar termos traduzidos com par de idiomas, contexto e observações, e depois localizá-los rapidamente, então conseguirão reutilizar decisões e manter maior consistência entre trabalhos.

## Proposta de valor

O Léxica organiza a memória terminológica do tradutor por cliente, projeto e par de idiomas, para que ele possa encontrar e reutilizar traduções anteriores junto de seu contexto, variantes e justificativas.

## Diferencial a validar

O foco é a memória terminológica contextual, controlada pelo tradutor: cada resultado pode mostrar onde e por que a tradução foi usada, além de variantes e referências. O tradutor decide se reutiliza a sugestão. As memórias OPUS podem complementar a busca com amostras externas identificadas por coleção e versão.

Não afirmar que não existem alternativas gratuitas. Comparar o fluxo do Léxica com o método que cada participante usa hoje (planilhas, documentos, CAT tools ou outros) e avaliar se contexto, reutilização e organização trazem valor para esse grupo.

## Escopo demonstrável do MVP

1. Criar um glossário/memória para cliente e par de idiomas.
2. Cadastrar um termo com original, tradução, contexto de projeto/obra/área e, quando pertinente, exemplo, variante, tom, nota, justificativa ou fonte.
3. Buscar termos anteriores por texto, idioma e contexto.
4. Abrir o resultado para conferir notas, variantes e histórico antes de reutilizar a tradução.
5. Importar pares explícitos de arquivos compatíveis e exportar a memória em CSV ou TMX.
6. Opcional na demonstração: consultar o catálogo OPUS, importar uma amostra limitada e conferir sugestões locais por frase. Identificar coleção, versão e cobertura da amostra.

O produto atual é uma aplicação web executada localmente, de usuário único. A demonstração não representa hospedagem pública, colaboração entre contas ou operação comercial.

## Fora do escopo desta validação

- Cadastro/login de usuários, recuperação ou exclusão de conta e permissões entre organizações.
- Tradução automática de documentos PDF/imagens, OCR ou revisão automática de texto.
- Promessa de tradução correta, certificação jurídica ou substituição do julgamento profissional.
- Operação pública multiusuário, cobrança, venda a empresas ou metas de milhares de usuários.

## Jornada principal

1. O tradutor escolhe ou cria a memória do cliente e o par de idiomas.
2. Cadastra um termo já traduzido e informa contexto suficiente para distingui-lo de outros usos.
3. Durante outro trabalho, pesquisa o termo ou trecho na memória.
4. Confere tradução, contexto, variantes e justificativa; decide se reutiliza ou registra uma nova escolha.
5. Exporta a memória para consulta ou continuidade do trabalho.

## Critérios de aceite da demonstração

- É possível cadastrar um par de tradução associado a um glossário e par de idiomas.
- A busca encontra o termo pelo original e permite restringir pelo contexto selecionado.
- O resultado apresenta a tradução e os dados de contexto registrados.
- Uma edição preserva o histórico anterior.
- A exportação gera arquivo com os pares selecionados; a importação exige revisão antes de gravar novos pares.
- Se OPUS for demonstrado, a interface deixa claro que amostra limitada não representa o corpus inteiro e permite identificar a origem.

## Validação do MVP

### Roteiro proposto

Convidar 5 tradutores freelancers que usem terminologia recorrente. Com um conjunto de termos fictício ou autorizado, pedir que cada participante:

1. Cadastre um termo com contexto.
2. Encontre uma tradução já registrada para uma tarefa de outro projeto.
3. Confira a justificativa/variante e exporte a memória.

Observar sem orientar, registrar conclusão, erros, pedidos de ajuda e tempo por tarefa. Ao final, perguntar qual método usava antes, se o contexto ajudou e em qual situação adotaria o Léxica.

### Metas iniciais para o piloto

- Pelo menos 4 de 5 participantes concluem as três tarefas sem ajuda.
- Pelo menos 4 de 5 encontram o termo correto em até 60 segundos.
- Pelo menos 4 de 5 avaliam como útil consultar o contexto junto da tradução (4 ou 5 numa escala de 1 a 5).

Essas metas medem uma primeira rodada pequena, não comprovam demanda de mercado. Registrar resultados e ajustar o produto; repetir o teste antes de ampliar a alegação de sucesso.

## Resultados de negócio

“Alcançar 2.500 pessoas”, “1.000 usuários ativos” e “vender por 30 vezes o investimento” são hipóteses de crescimento/receita para etapas posteriores. Para torná-las avaliáveis, definir período, canal, preço, custo, significado de usuário ativo e fonte dos dados. Não usar esses números como prova de que o MVP resolveu o problema.

## Entrega, custo e prazo

- Forma de entrega desta etapa: demonstração local do aplicativo existente e teste acompanhado com tradutores.
- Prazo informado no Canvas apresentado: 30/11/2026. Planejar as atividades restantes até essa data conforme a capacidade real do grupo.
- O Canvas cita R$ 300.000,00, enquanto a página Planejamento afirma que o projeto não demanda investimento financeiro e estima cerca de uma hora semanal. Reconciliar os valores antes da próxima apresentação: separar desembolso real de custo estimado de mão de obra, registrar horas por integrante e explicitar premissas para segurança, ferramentas e infraestrutura.
- Para a demonstração local, não apresentar R$ 300.000,00 como gasto realizado. Para hospedagem pública, estimar uma etapa separada com autenticação, autorização, backups, segurança e operação.

## Roadmap depois da validação

1. Corrigir problemas observados na busca, no cadastro e no contexto dos termos.
2. Repetir o piloto com mais tradutores e outros perfis (literário, técnico, juramentado, games e acadêmico).
3. Avaliar integração com ferramentas CAT e importação de memórias de projetos reais, com autorização e requisitos de privacidade definidos.
4. Só depois decidir se vale implementar hospedagem multiusuário, colaboração, cobrança, tradução/revisão de documentos ou OCR.

## Relatório de métricas de cada sprint

Manter uma página por sprint no Confluence, com período, itens concluídos, dados, cálculos, análise e comparação com a sprint anterior. Usar uma regra única para dias corridos ou úteis.

| Métrica                        | Cálculo / dados necessários                                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Throughput médio da equipe     | Total de itens concluídos desde o início ÷ número de sprints concluídas. Informar os dois valores e interpretar a tendência.                     |
| Lead time individual           | Data de conclusão − data de criação de cada item concluído.                                                                                      |
| Lead time médio geral          | Soma dos lead times dos itens concluídos ÷ quantidade desses itens.                                                                              |
| Lead time médio Backend        | Mesmo cálculo, filtrando itens classificados como Backend.                                                                                       |
| Lead time médio Front-end      | Mesmo cálculo, filtrando itens classificados como Front-end.                                                                                     |
| Cycle time individual          | Data de conclusão − data de início do trabalho de cada item concluído. Preferir a data em que o ticket entrou em andamento no histórico do Jira. |
| Cycle time médio geral         | Soma dos cycle times ÷ quantidade de itens concluídos com data de início registrada.                                                             |
| Comparação com sprint anterior | Para cada métrica: valor anterior, valor atual, variação e justificativa baseada em fatos observados.                                            |

Não calcular médias com itens sem datas ou categorias. Registrar itens excluídos e a razão; lead time e cycle time são métricas de fluxo do time, enquanto as metas do piloto medem valor para o tradutor.

## Plano de organização do Jira

Estado observado na visualização fornecida em 16/11/2026: 17 tickets no backlog filtrado, 5 pendentes, 12 em andamento e nenhum concluído. Quatro épicos aparecem no filtro: Memória de Tradução, Glossário e Termos, Filtros, Rastreabilidade e Notas. A página não mostra itens alocados a uma sprint.

Antes de criar tickets duplicados:

1. Revisar os tickets existentes e manter os que já representam o escopo do MVP.
2. Para cada história, registrar uma tarefa que possa ser demonstrada, critérios de aceite e dependências.
3. Dividir trabalho por fatias testáveis de usuário, evitando subtarefas técnicas sem resultado integrado.
4. Atribuir Story Points em planejamento de grupo, usando a escala acordada pelo time.
5. Classificar tickets com os componentes ou rótulos Backend, Front-end, Testes e Infraestrutura para permitir os recortes das métricas.
6. Criar sprints com objetivo, período e capacidade do grupo; selecionar apenas itens prioritários do MVP.
7. Ao iniciar um ticket, movê-lo para Em andamento; ao concluir e validar seus critérios, movê-lo para Concluído. Usar o histórico do Jira nas datas do relatório.

### Exemplos de fatias para revisar contra os tickets existentes

- **Cadastrar termo:** formulário e validações; persistência e prevenção de duplicidade; feedback de sucesso/erro; teste integrado.
- **Localizar termo:** busca pelo texto; filtros por idioma e cliente/projeto; estado sem resultados; validação com exemplos.
- **Reutilizar tradução:** abrir detalhe com contexto, variante e justificativa; editar preservando histórico; exportar pares.
- **Importar memória:** selecionar arquivo; pré-visualizar pares; confirmar seleção; importar e conferir duplicados/erros.

São exemplos para decompor e estimar o backlog atual, não autorização para duplicar histórias já existentes.
