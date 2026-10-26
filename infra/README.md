# Bucket opcional

O modo padrão grava arquivos temporários localmente. Para testar um bucket real sem usar conta de nuvem, instale Docker e defina `AWS_ACCESS_KEY_ID` e `AWS_SECRET_ACCESS_KEY` fortes no ambiente (não os registre em Git), depois:

```sh
docker compose -f infra/compose.yaml up -d
```

Defina também `S3_ENDPOINT=http://127.0.0.1:9000` e `S3_BUCKET=lexica-temporary`, aguarde o MinIO estar disponível e execute:

```sh
node infra/setup-bucket.js
npm start
```

O provisionador local cria bucket privado com expiração de um dia no prefixo `temporary/`. O backend usa as credenciais padrão AWS do ambiente. A API entrega os downloads; objetos não recebem ACL pública. A configuração foi entregue, mas Docker/MinIO não foi executado neste ambiente.

Para S3 externo, use bucket privado previamente provisionado com lifecycle equivalente, credenciais de menor privilégio (PutObject no prefixo temporário) e política de segurança da organização. Não há implantação automática em conta externa.
