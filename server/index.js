import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import { Store } from "./store.js";
import { TemporaryStorage } from "./storage.js";
import { createApp } from "./app.js";
import { seed } from "./seed.js";
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const data = resolve(process.env.DATA_DIR || join(root, "data"));
const store = new Store(
  join(data, "lexica.sqlite"),
  process.env.LEXICA_ACTOR || "Tradutor local",
);
if (process.env.SEED_DEMO !== "false") seed(store);
const storage = new TemporaryStorage(join(data, "temporary"));
const app = createApp(store, storage);
if (existsSync(join(root, "dist", "index.html"))) {
  app.use(express.static(join(root, "dist")));
  app.get("/{*path}", (req, res) =>
    res.sendFile(join(root, "dist", "index.html")),
  );
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    root,
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
let backupBusy = false;
async function maintenance() {
  if (backupBusy) return;
  backupBusy = true;
  try {
    await store.backup(join(data, "backups"));
    await storage.cleanup();
  } catch (e) {
    console.error("Backup/manutenção falhou:", e.message);
  } finally {
    backupBusy = false;
  }
}
await maintenance();
const timer = setInterval(maintenance, 3600000);
timer.unref();
const server = app.listen(Number(process.env.PORT) || 4173, "127.0.0.1", () =>
  console.log(`Léxica em http://localhost:${server.address().port}`),
);
for (const sig of ["SIGINT", "SIGTERM"])
  process.on(sig, () => {
    clearInterval(timer);
    server.close(async () => {
      await app.locals.translationMemory.running;
      store.close();
      process.exit(0);
    });
  });
