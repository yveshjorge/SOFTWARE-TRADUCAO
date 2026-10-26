import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.PORT = "4174";
process.env.DATA_DIR = await mkdtemp(join(tmpdir(), "lexica-e2e-"));
process.env.LEXICA_ACTOR = "Tradutor de teste";
await import("../server/index.js");
