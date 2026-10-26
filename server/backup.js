import { resolve, join } from "node:path";
import { Store } from "./store.js";
const root = resolve(process.env.DATA_DIR || "data");
const store = new Store(join(root, "lexica.sqlite"));
try {
  console.log(await store.backup(join(root, "backups")));
} finally {
  store.close();
}
