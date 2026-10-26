import {S3Client,CreateBucketCommand,PutBucketLifecycleConfigurationCommand,HeadBucketCommand} from '@aws-sdk/client-s3';
const Bucket=process.env.S3_BUCKET;const endpoint=process.env.S3_ENDPOINT;
if(!Bucket||!endpoint)throw Error('Defina S3_BUCKET e S3_ENDPOINT.');
if(!['localhost','127.0.0.1'].includes(new URL(endpoint).hostname))throw Error('Este provisionador é destinado ao MinIO local. Provisione buckets externos pelo processo aprovado da sua organização.');
const client=new S3Client({endpoint,region:'us-east-1',forcePathStyle:true});
try{await client.send(new HeadBucketCommand({Bucket}));}catch(e){if(e.$metadata?.httpStatusCode!==404)throw e;await client.send(new CreateBucketCommand({Bucket}));}
await client.send(new PutBucketLifecycleConfigurationCommand({Bucket,LifecycleConfiguration:{Rules:[{ID:'temporary-one-day',Status:'Enabled',Filter:{Prefix:'temporary/'},Expiration:{Days:1}}]}}));
console.log('Bucket temporário local configurado com expiração de um dia.');
