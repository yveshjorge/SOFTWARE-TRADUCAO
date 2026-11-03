# Verificação da entrega

Executada em 27/10/2026, Windows, Node 24.22.0. A validação OPUS usou somente uma amostra efêmera de 20 pares e não gravou uma base grande no banco de demonstração.

| Verificação | Resultado |
|---|---|
| TypeScript (`npm run check`) | Passou |
| Build Vite (`npm run build`) | Passou |
| Testes de domínio/API/design e OPUS (`npm test`) | 33 passaram |
| Playwright (`npm run test:e2e`) | 10 passaram; texto dividido por frase, revisão e atribuição das sugestões OPUS verificados |
| Axe WCAG A/AA nos estados cobertos | Zero violações detectadas |
| Auditoria estática premium strict | Zero erros/avisos |
| Lint DESIGN.md | Zero erros; 7 avisos de tokens documentados em prosa, consumidos em CSS |
| Auditoria npm após atualização csv-parse | Zero vulnerabilidades reportadas |
| Cliente OPUS real | Europarl en→pt v8: 20 pares lidos e download interrompido no limite; DGT en→pt v2021 disponível; MultiUN en→pt indisponível no catálogo consultado |

## Cobertura real

Criação e edição de termo com histórico anterior preservado; consulta e download de ficha histórica; busca parcial sem acentos combinada com projeto/categoria/tom; cliente isolado por glossário; reclassificação; notas editáveis; variantes estilísticas; fontes/DOIs; CSV/TMX com escaping; PDF textual válido; corrupção, binário, limite, CSV inválido e arquivo sem pares; prévia com seleção, commit idempotente e duplicados; conflitos de versão; snapshot de backup reaberto; proteção de mutação via token local.

No navegador: CRUD, histórico, notas, link de referência, variantes, upload TXT com revisão e desmarcação, rejeição de executável, validação de formulário, foco, Escape e Cancelar com rascunho, preservação após falha de rede, respostas de busca atrasadas, URL/Back/reload, layout sem overflow em 1440×1000 e 390×844 e reduced-motion. Axe avaliado na biblioteca desktop e no formulário mobile.

Para OPUS: fixtures TMX em UTF-8/UTF-16, variantes regionais, sentido invertido, escapes, inline tags, conteúdo truncado, DTD, entidades externas, limites de tamanho, GZIP/ZIP e checksums inválidos; catálogo/API offline, revalidação, falhas de rede, busca exata/semelhante e em lote, falha depois de lotes parciais, retomada idempotente, migração de amostras anteriores para exibir procedência, estado interrompido e rotas HTTP protegidas. E2E com respostas de catálogo/importação/sugestões simuladas verifica o fluxo de revisão por frase sem baixar uma coleção inteira.

Os testes usam banco temporário separado e não alteram `data/lexica.sqlite`. Capturas em `desktop.png` e `mobile-form.png` mostram dados do ambiente de testes. `preview.png` mostra a biblioteca local de demonstração.

## Limites de validação

- S3/MinIO: adaptador, compose e lifecycle entregues, sem bucket externo provisionado e sem teste real em Docker neste ambiente. O modo de armazenamento local foi validado.
- Backup consistente validado com recuperação; a rotina horária usa o mesmo método. Não foi necessário aguardar uma hora para testar o timer.
- PDF: extrator de pares explícitos; sem OCR e sem deduzir traduções de prosa.
- Aplicação local de um usuário; não foi publicada, nem recebeu autenticação para exposição pública.
- Axe e testes de teclado não equivalem a auditoria manual completa com leitor de tela.
- Tickets do Jira não foram movidos para Done. A matriz BACKLOG.md permite revisar a implementação antes do aceite.
