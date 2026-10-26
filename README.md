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
- `tests/`: domínio/API, PDF e fluxos E2E com Playwright/axe.
- `docs/BACKLOG.md`: correspondência entre cada ticket e implementação.
- `docs/ARCHITECTURE.md`: decisões de domínio, API e limites de implantação.
- `infra/`: configuração opcional de bucket MinIO/S3.

Código-fonte no repositório [SOFTWARE-TRADUCAO](https://github.com/yveshjorge/SOFTWARE-TRADUCAO). A aplicação é executada localmente; a publicação do código não disponibiliza um servidor na internet. Os status do Jira permanecem inalterados para revisão humana da entrega.
