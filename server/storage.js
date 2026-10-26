import { mkdir, writeFile, readdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
export class TemporaryStorage {
  constructor(root) {
    this.root = root;
    this.bucket = process.env.S3_BUCKET;
    this.client = this.bucket
      ? new S3Client({
          region: process.env.AWS_REGION || "us-east-1",
          endpoint: process.env.S3_ENDPOINT || undefined,
          forcePathStyle: true,
        })
      : null;
  }
  async put(bytes, contentType) {
    const key = "temporary/" + randomUUID();
    if (this.client)
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: bytes,
          ContentType: contentType,
        }),
      );
    else {
      await mkdir(this.root, { recursive: true });
      await writeFile(join(this.root, key.split("/")[1]), bytes, {
        flag: "wx",
      });
    }
    return key;
  }
  async cleanup() {
    if (this.client) return;
    await mkdir(this.root, { recursive: true });
    for (const file of await readdir(this.root)) {
      const path = join(this.root, file);
      const s = await stat(path);
      if (s.isFile() && Date.now() - s.mtimeMs > 86400000) await unlink(path);
    }
  }
}
