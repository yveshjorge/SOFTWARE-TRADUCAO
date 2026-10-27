# SOFTWARE-TRADUCAO — Léxica

Aplicação local completa de biblioteca de termos para tradutores, construída a partir dos **35 itens em To Do** do [quadro BM no Jira](https://metodosageis06.atlassian.net/jira/software/projects/BM/boards/1) e do [canvas Tradução no Miro](https://miro.com/app/board/uXjVHwyuvsA=/).

## Executar

Requisito: **Node.js 24 ou superior**, npm e Git. Não exige chave de IA ou conta de nuvem.

```sh
git clone https://github.com/yveshjorge/SOFTWARE-TRADUCAO.git
cd SOFTWARE-TRADUCAO
npm ci
npm run build
npm start
```

Abra **http://localhost:4173**. Em instalação nova são criados oito termos e dois glossários de demonstração; eles são exemplos editáveis, não dados importados de usuários do Jira. Para uma biblioteca vazia, defina `SEED_DEMO=false` antes da primeira execução. Os dados ficam em `data/lexica.sqlite`, fora do Git.

`npm run dev` também inicia a aplicação. Sem `dist/`, serve o frontend via Vite. Se já houver build e você editar código frontend, execute `npm run build` novamente. `DATA_DIR`, `PORT` e `LEXICA_ACTOR` são configuráveis por variáveis de ambiente. O servidor escuta **apenas no loopback** e não oferece autenticação multiusuário.

## Funcionalidades

- Biblioteca com cadastro/edição, idiomas, exemplos destacados e variações por personagem/tom.
- Busca parcial sem distinção de acentos, filtros combinados por cliente, projeto, obra, área, tom e tags, paginação e URLs restauráveis.
- Glossários por cliente e par de idiomas; termos isolados por glossário.
- Notas editáveis, intenções criativas, justificativas, referências e DOIs.
- Histórico imutável com autor local, timestamps, diferenças antes/depois e exportação de versão antiga.
- CSV com notas/referências e TMX 1.4 com pares de idiomas; respeitam filtros e rejeitam bases vazias.
- Importação PDF textual/TXT/CSV com prévia, seleção dos termos, progresso, limites, duplicados e confirmação idempotente.
- Backup SQLite consistente no início e a cada hora enquanto o servidor estiver ativo; `npm run backup` executa manualmente.
- Adaptador de armazenamento temporário local ou S3, configuração MinIO e índice textual SQLite FTS5.
- Catálogo OPUS ao vivo, links para consulta online e importação limitada de TMX/GZIP/ZIP com busca local de sugestões.

## Memórias de tradução do OPUS

Abra **Memórias OPUS** na navegação. A consulta ao catálogo precisa de internet e aceita um par de idiomas, uma coleção opcional (Europarl, MultiUN, DGT etc.) e a versão. Depois de escolher um dataset, importe no máximo 10.000 pares por padrão; o limite ajustável vai de 1 a 100.000. GZIP é processado em fluxo e o download para ao atingir o limite. O parser aceita TMX e ZIP contendo um único TMX. A tela mostra andamento, falhas e as memórias salvas no computador.

As sugestões consultam as amostras importadas, sem enviar frases ao OPUS ou a um modelo de IA. A importação exige internet; a busca funciona offline. Para consultar sem importar, a tela oferece acesso às ferramentas online [OPUS Corpus Query](https://opus.nlpl.eu/bin/opuscqp.pl) e [OPUS Explorer](https://opus.nlpl.eu/explore/). A [API OPUS documentada](https://opus.nlpl.eu/opusapi) fornece catálogo, idiomas e endereços de download, e não uma API de busca por frases. Os corpora têm fontes e condições de uso variadas; confira licença e atribuição antes de usar sugestões em trabalho comercial. Uma amostra local não representa o conteúdo completo nem garante qualidade da tradução.

## Importação

PDF ou TXT: cada linha deve conter um par explícito, por exemplo `Health Potion → Poção de Vida`. Também aceita `->`, `=>`, tabulação ou `=`. CSV UTF-8: cabeçalhos `original,translation`, usando aspas para vírgulas no texto. Até 5 MB e 2.000 pares. O contexto/idiomas são escolhidos na tela antes da prévia.

O extrator não inventa traduções nem deduz pares de artigos em prosa. PDFs digitalizados exigem OCR prévio. Uploads só alimentam a biblioteca após a confirmação dos pares selecionados.

## Testes

```sh
npm run check
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run format:check
```

Os testes E2E iniciam servidor e banco temporários próprios na porta 4174. Não alteram a biblioteca principal. Evidências e limites em [docs/VERIFICATION.md](docs/VERIFICATION.md).

## Organização

- `src/`: frontend React/TypeScript e componentes acessíveis compartilhados.
- `server/`: API Express, validação Zod, SQLite, importação/exportação, backup e storage.
- `server/opus-client.js`, `server/tmx.js`: consulta ao catálogo, download seguro e parser TMX em fluxo.
- `server/translation-memory.js`: armazenamento, índice e consulta de sugestões locais.
- `tests/`: domínio/API, PDF e fluxos E2E com Playwright/axe.
- `tests/opus.test.js`: parser TMX, compressão, erros de rede, amostras, armazenamento e sugestões.
- `docs/BACKLOG.md`: correspondência entre cada ticket e implementação.
- `docs/ARCHITECTURE.md`: decisões de domínio, API e limites de implantação.
- `infra/`: configuração opcional de bucket MinIO/S3.

Código-fonte no repositório [SOFTWARE-TRADUCAO](https://github.com/yveshjorge/SOFTWARE-TRADUCAO). A aplicação é executada localmente; a publicação do código não disponibiliza um servidor na internet. Os status do Jira permanecem inalterados para revisão humana da entrega.
