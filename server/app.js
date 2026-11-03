import express from "express";
import { randomUUID } from "node:crypto";
import { AppError, categories, tones, languages } from "./domain.js";
import { exportTerms, extractTerms, auditReport } from "./files.js";
import { TranslationMemory } from "./translation-memory.js";
import { opusLinks } from "./opus-client.js";
export function createApp(
  store,
  storage,
  memory = new TranslationMemory(store),
) {
  const app = express();
  app.disable("x-powered-by");
  const token = randomUUID();
  app.use((req, res, next) => {
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Referrer-Policy", "same-origin");
    if (!["127.0.0.1", "localhost", "[::1]"].includes(req.hostname))
      return res
        .status(403)
        .json({ error: "Acesso disponível apenas neste computador." });
    if (req.path.startsWith("/api/")) {
      res.set("Cache-Control", "no-store");
      if (req.method !== "GET" && req.get("X-Lexica-Token") !== token)
        return res
          .status(403)
          .json({ error: "Sessão inválida. Recarregue a aplicação." });
    }
    next();
  });
  app.use(express.json({ limit: "8mb" }));
  app.get("/api/meta", (req, res) =>
    res.json({ ...store.metadata(), categories, tones, languages, token }),
  );
  app.get("/api/glossaries", (req, res) => res.json(store.glossaryList()));
  app.post("/api/glossaries", (req, res) =>
    res.status(201).json(store.createGlossary(req.body)),
  );
  app.get("/api/terms", (req, res) => res.json(store.list(req.query)));
  app.post("/api/terms", (req, res) =>
    res.status(201).json(store.create(req.body)),
  );
  app.get("/api/terms/:id", (req, res) => res.json(store.get(req.params.id)));
  app.put("/api/terms/:id", (req, res) =>
    res.json(store.update(req.params.id, req.body.term, req.body.version)),
  );
  app.get("/api/terms/:id/history", (req, res) =>
    res.json(store.history(req.params.id)),
  );
  app.post("/api/terms/:id/notes", (req, res) =>
    res
      .status(201)
      .json(store.note(req.params.id, req.body.note, req.body.version)),
  );
  app.put("/api/terms/:id/notes/:noteId", (req, res) =>
    res.json(
      store.note(
        req.params.id,
        req.body.note,
        req.body.version,
        req.params.noteId,
      ),
    ),
  );
  app.get("/api/terms/:id/report", (req, res) => {
    const versions = store.history(req.params.id);
    const v = req.query.version
      ? versions.find((v) => v.version === Number(req.query.version))
      : versions[0];
    if (!v) throw new AppError("Versão não encontrada.", 404);
    res.set(
      "Content-Disposition",
      `attachment; filename="ficha-${req.params.id}-v${v.version}.html"`,
    );
    res.type("html").send(auditReport(v.snapshot, v));
  });
  app.get("/api/export", async (req, res) => {
    const format = req.query.format || "csv";
    const result = exportTerms(store.list(req.query, true).items, format);
    await storage.put(Buffer.from(result.body), result.type);
    res.set("Content-Disposition", `attachment; filename="lexica.${format}"`);
    res.type(result.type).send(result.body);
  });
  app.post("/api/import/preview", async (req, res) => {
    const { filename, content, context } = req.body;
    if (
      typeof filename !== "string" ||
      typeof content !== "string" ||
      content.length > 7000000 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(content)
    )
      throw new AppError("Arquivo inválido.", 422);
    const bytes = Buffer.from(content, "base64");
    const rows = await extractTerms(filename, bytes);
    const safeContext = store.validate({
      ...context,
      original: "Validação",
      translation: "Validation",
    });
    delete safeContext.original;
    delete safeContext.translation;
    await storage.put(bytes, "application/octet-stream");
    res.json(store.preview(rows, safeContext));
  });
  app.post("/api/import/:id/commit", (req, res) =>
    res.json(store.commitImport(req.params.id, req.body.selected)),
  );
  app.get("/api/opus/datasets", async (req, res) =>
    res.json({
      items: await memory.client.catalog(req.query),
      links: opusLinks,
    }),
  );
  app.get("/api/opus/imports", (req, res) =>
    res.json({ items: memory.list(), links: opusLinks }),
  );
  app.post("/api/opus/imports", async (req, res) => {
    const job = await memory.start(req.body);
    res.status(job.status === "ready" ? 200 : 202).json(job);
  });
  app.get("/api/opus/imports/:id", (req, res) =>
    res.json(memory.get(req.params.id)),
  );
  app.get("/api/translation-memory/suggestions", (req, res) =>
    res.json({ items: memory.suggestions(req.query) }),
  );
  app.post("/api/translation-memory/suggestions/batch", (req, res) =>
    res.json({ items: memory.suggestionsBatch(req.body) }),
  );
  app.locals.translationMemory = memory;
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "Endpoint não encontrado." }),
  );
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    const status = err.status || 500;
    if (status === 500) console.error("Falha interna:", err.message);
    res.status(status).json({
      error:
        status === 500
          ? "Não foi possível concluir a operação. Tente novamente."
          : err.message,
      fields: err.fields,
    });
  });
  return app;
}
