# Arquitetura e limites

## Decisões

React + TypeScript no frontend, Vite no build, Express no backend, SQLite nativo do Node 24. Banco local com transações e WAL. `terms` guarda o estado atual; `versions` guarda snapshots append-only protegidos por triggers contra UPDATE/DELETE. Cada mutação incrementa a versão em transação. `version` fornecida pelo cliente deve coincidir com a atual; 409 preserva a versão salva.

O ator é configurado por `LEXICA_ACTOR`, padrão “Tradutor local”. Não representa identidade autenticada. O cadastro público, login, permissões entre organizações e tradução automática não pertencem aos itens To Do capturados. Esta entrega funciona em uma estação de trabalho. Não expor publicamente antes de adicionar autenticação, autorização por proprietário, TLS, limitação de abuso e política de retenção organizacional. As rotas aceitam apenas Host local e mutações exigem token por processo; isso mitiga requisições de páginas externas, não substitui login.

BM-12 menciona marca de validação: implementada como **registro interno fundamentado**, sem alegar certificação legal, assinatura digital ou validade jurídica. A ficha HTML pode ser aberta e impressa/salva como PDF pelo navegador. Histórico imutável no nível da aplicação não protege contra alguém com acesso direto ao arquivo SQLite.

## Busca

FTS5 trigram sobre original, tradução e variações normalizados (minúsculas, sem acentos). Consultas de três ou mais caracteres sem curingas usam índice LIKE; termos curtos e curingas literais usam instr para semântica previsível. Idiomas, glossário, projeto e obra são filtros exatos; grupos de categorias/tons/tags usam OR interno e AND entre grupos. SQL parametrizado. Índices adicionais em categoria e glossário. Não se atribui relevância fictícia.

## Importação e arquivos

PDF via pdf-parse, TXT UTF-8 estrito e CSV via csv-parse. Extensão, assinatura PDF, conteúdo, tamanho e quantidade são verificados. Arquivos inválidos não viram termos. Prévia expira em uma hora; commit atômico aceita índices da prévia e é idempotente. Duplicados exatos no mesmo contexto são ignorados. Importações inválidas inteiras revertem a transação. Base64 mantém o transporte simples, com limite de corpo de 8 MB para arquivos de até 5 MB.

Storage temporário local em `data/temporary` com nomes UUID não derivados de nomes de arquivo; limpeza após 24h durante manutenção horária. Com `S3_BUCKET`, os mesmos artefatos são gravados via S3; lifecycle expira o prefixo `temporary/` em um dia. Download é entregue diretamente pela API, sem links públicos. Arquivos válidos enviados permanecem temporariamente até a expiração. Backups não são apagados automaticamente.

CSV neutraliza prefixos de fórmulas e escapa aspas. TMX escapa XML. Referências externas só permitem HTTP/HTTPS ou DOI; links abrem com noopener/noreferrer. Conteúdo do usuário é texto React. Não há renderização de HTML arbitrário.

## Memória de tradução OPUS

O cliente consulta `https://opus.nlpl.eu/opusapi/` para descobrir corpora, versões, pares de idiomas e URLs TMX. Redirects e destinos de download aceitam somente HTTPS em `opus.nlpl.eu` e `object.pouta.csc.fi/OPUS-*`; a tela nunca envia URL arbitrária ao servidor. Download limitado a 1 GiB compactado, XML limitado a 4 GiB expandido. TMX é analisado em fluxo; o parser não resolve DTDs ou entidades externas. ZIP é processado sem extrair nomes de arquivo e deve conter exatamente um TMX. Unidades são salvas em lotes de 500; uma falha apaga os lotes parciais. Unidade máxima de 256 KiB; segmento máximo de 64 KiB; até cinco milhões de unidades e 64 variantes por unidade.

A amostra é limitada por idioma, coleção, versão e limite escolhido. Padrão de 10.000 pares, máximo de 100.000; ao atingir o limite, ela inclui os primeiros pares do TMX, identificados por `coverage: sample` e `sampleMethod: beginning`. Estados persistidos: `importing`, `ready`, `failed`; importações interrompidas são removidas na inicialização. Só uma importação executa por vez. Dados e busca FTS5 residem no mesmo SQLite local e backup. Correspondências exatas vêm primeiro; busca semelhante usa FTS5 no idioma de origem. `POST /api/translation-memory/suggestions/batch` recebe até 30 segmentos (20 mil caracteres no total), preserva os segmentos e devolve as sugestões locais de cada um. A interface divide texto por frases, pede as correspondências uma vez e só copia uma sugestão sob ação explícita do usuário. Nenhum trecho é enviado para a API OPUS. A ferramenta de consulta online do OPUS é um link externo; a API pública documentada não oferece endpoint de busca por frases. A licença varia entre corpora e deve ser conferida para uso comercial.

## API

| Método | Rota | Comportamento |
|---|---|---|
| GET | `/api/meta` | Categorias, idiomas, contexto local e token de mutação |
| GET/POST | `/api/glossaries` | Lista/cria glossário por cliente |
| GET/POST | `/api/terms` | Busca paginada/cria termo |
| GET/PUT | `/api/terms/:id` | Lê/edita com `{term,version}` |
| GET | `/api/terms/:id/history` | Snapshots e ator/data |
| POST | `/api/terms/:id/notes` | Adiciona com `{note,version}` |
| PUT | `/api/terms/:id/notes/:noteId` | Edita nota preservando snapshot |
| GET | `/api/terms/:id/report?version=N` | Ficha HTML da versão |
| GET | `/api/export?format=csv ou tmx` | Exporta todos os resultados filtrados |
| POST | `/api/import/preview` | `{filename,content:base64,context}` → pares e ID |
| POST | `/api/import/:id/commit` | `{selected:[índices]}` → criados/ignorados |
| GET | `/api/opus/datasets?source=en&target=pt&corpus=Europarl` | Lista corpora com TMX pela API oficial OPUS |
| GET/POST | `/api/opus/imports` | Lista e importa amostras revalidadas no catálogo oficial |
| GET | `/api/opus/imports/:id` | Estado e contagem de uma importação |
| GET | `/api/translation-memory/suggestions?source=en&target=pt&q=...` | Busca exata e semelhante no SQLite local |
| POST | `/api/translation-memory/suggestions/batch` | `{source,target,corpus?,segments:[...]}` → sugestões locais por segmento |

Mutações exigem `X-Lexica-Token` obtido da própria página. Erros usam `{error,fields?}`; 422 validação, 409 duplicação/conflito, 410 prévia expirada. Busca aceita `q`, `glossaryId`, `project`, `work`, `sourceLang`, `targetLang`, `category`, `tones`, `tags`, `page`, `pageSize`, `sort`. Repetição de chave representa opções de um grupo.

## Backup e recuperação

Ao iniciar e a cada hora, `node:sqlite` backup produz snapshot consistente, incluindo WAL. Backups ficam em `data/backups/` e não expiram automaticamente. Para recuperar, pare o servidor, guarde o diretório de dados atual e coloque o snapshot escolhido como `lexica.sqlite` em um **novo DATA_DIR vazio**, evitando misturar arquivos WAL antigos. Inicie com esse diretório. Um teste automatizado abre um backup e verifica termos, histórico e índice. Para agendamento com o servidor parado, agende `npm run backup` no mecanismo operacional de sua preferência.

## Fora do ambiente validado

O adaptador e configuração S3/MinIO são entregues em código, mas não foi provisionado bucket em conta externa. Autenticação multiusuário, implantação pública, OCR, inferência de traduções de texto livre e IA não são simulados. A base nova inclui pré-requisitos de cadastro e consulta das histórias em andamento; BM-22 (traduzir texto automaticamente) permanece fora do escopo To Do.
