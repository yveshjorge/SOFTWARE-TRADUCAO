# Rastreabilidade — Jira BM / To Do

Leitura do quadro em 26/10/2026: 35 itens em To Do. Os 16 primeiros são histórias; os demais são tarefas técnicas. Os status não foram alterados. Fonte: https://metodosageis06.atlassian.net/jira/software/projects/BM/boards/1

| Ticket | Requisito | Implementação / evidência |
|---|---|---|
| BM-5 / US03 | Exemplos de uso, destaque, vazio e filtro de área | Detail, exemplos na TermForm; E2E contexto |
| BM-6 / US04 | Glossários por cliente e par de idiomas; isolamento | GlossaryForm, Store.glossary; testes cliente |
| BM-8 / US06 | Exportação TMX/CSV filtrada, sem arquivos vazios | exportTerms, export API e modal; testes CSV/TMX |
| BM-9 / US07 | Soluções criativas por obra, intenção, copiar, variantes por personagem/tom | TermForm, Detail; testes variações e busca |
| BM-10 / US08 | Classificação e filtro por múltiplos tons | termSchema.tones, filtros; testes combinados |
| BM-11 / US09 | Comentários, indicação nas listas, edição/data | NoteForm, notas no cartão, snapshots; E2E notas |
| BM-12 / US10 | Justificativa obrigatória oficial, ficha e versões preservadas | termSchema, auditReport, selo interno; testes validação/report |
| BM-13 / US11 | Histórico com autor/data, comparação e exportação legada | versions append-only, timeline; E2E e testes imutabilidade |
| BM-14 / US12 | Filtro jurídico combinado com busca e estado vazio | categorias, Store.list, atalho para cadastro |
| BM-16 / US14 | Nota explicativa da adaptação | NoteForm + API de notas; caso Piece of cake no seed |
| BM-2 / US15 | Busca parcial por palavra-chave no projeto e limpeza | FTS5, filtros, clear; E2E busca/Back |
| BM-17 / US16 | Marcar e filtrar Gírias/Humor | checkboxes de tom e tags, etiquetas; testes combinação |
| BM-18 / US17 | Exportar glossário do jogo, notas, categoria, vazio | filtros project/category, CSV com notas; testes export |
| BM-19 / US18 | Fonte bibliográfica/URL/DOI opcional e link externo | termSchema.source, Source, vazio; E2E link |
| BM-20 / US19 | Área acadêmica, filtro e reclassificação | category, edição, filtros; teste reclassificação |
| BM-21 / US20 | PDF/TXT, extração, revisão seletiva e erro de formato | extractTerms, preview/commit, ImportForm; testes PDF/TXT e E2E |
| BM-33 | Serviço de exportação | server/files.js, GET /api/export |
| BM-34 | Leitura/importação de referência | PDFParse, CSV/TXT; testes arquivos |
| BM-35 | Modelo/endpoints de glossários por cliente | tabela glossaries + API, validação de par |
| BM-36 | Upload com progresso | ImportForm, XMLHttpRequest.upload, estado de extração |
| BM-37 | Gerenciamento de glossários e exportação rápida | Tela Glossários por cliente; E2E criação |
| BM-38 | Bucket temporário de upload/download | Adaptador S3 + configuração MinIO/lifecycle entregue; execução local validada; bucket externo não provisionado |
| BM-39 | Erros de arquivo corrompido/incompatível | testes binário, PDF corrompido, CSV inválido, limite, formato |
| BM-40 | Atributos de categoria | termSchema, JSON SQLite, índice de categoria |
| BM-41 | Query de filtros combinados | Store.list parametrizado; teste múltiplos filtros |
| BM-42 | Painel com checkboxes | filters responsivo no frontend |
| BM-43 | Card detalhado com exemplos e fonte | Detail, Source, Highlight; E2E |
| BM-44 | Serviço/índice de busca textual | FTS5 trigram + índices de filtros SQLite |
| BM-45 | Testes de integração dos filtros | tests/domain.test.js + tests/e2e/workflows.spec.js |
| BM-46 | Log de auditoria com quem/quando | versions(actor,at,action,snapshot), transações/triggers |
| BM-47 | Endpoints de notas, soluções e justificativas | POST/PUT terms, POST/PUT notes |
| BM-48 | Timeline de alterações | Detail histórico com antes/depois |
| BM-49 | Campo/lista de notas | NoteForm e aba Notas |
| BM-50 | Backup automatizado | startup + intervalo horário + CLI; teste de recuperação |
| BM-51 | E2E criar/editar preservando anterior | primeiro teste Playwright, relatório legado |

## Critérios e decisões explícitas

- PDF/TXT deve conter pares identificáveis; artigos sem pares não geram traduções presumidas. Sem OCR de imagens.
- A marca de BM-12 comprova somente registro interno. Não gera certificação jurídica fictícia.
- Como não havia código base, cadastro e consulta dos itens In Progress necessários ao To Do também foram implementados como infraestrutura funcional.
- A proposta do Miro cita memória de tradução e biblioteca por idioma. O nome Léxica e identidade visual foram criados para este repositório; não são uma marca fornecida no quadro.
- Validação local não equivale a aceite de negócio nem implantação em produção. Consulte VERIFICATION.md.
