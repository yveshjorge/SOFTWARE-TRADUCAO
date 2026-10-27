import { SaxesParser } from "saxes";
import { createReadStream } from "node:fs";
import { open } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { createGunzip, crc32 } from "node:zlib";
import yauzl from "yauzl";
import { AppError } from "./domain.js";

export function language(value) {
  if (
    typeof value !== "string" ||
    !/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(value)
  )
    throw new AppError(
      "Use um código de idioma válido, como en, pt ou pt-BR.",
      422,
    );
  return value.toLowerCase();
}

// Prefer exact language matches. A generic request may use a single regional
// variant, but never silently choose between pt-BR and pt-PT in the same TU.
function variant(variants, requested) {
  const exact = variants.filter((v) => v.lang === requested);
  const matches = exact.length
    ? exact
    : requested.includes("-")
      ? []
      : variants.filter((v) => v.lang.split("-")[0] === requested);
  return matches.length === 1 ? matches[0].text.trim() : "";
}

export async function* parseTmx(stream, options) {
  const source = language(options.source),
    target = language(options.target);
  if (source === target)
    throw new AppError("Escolha dois idiomas diferentes.", 422);
  const maxBytes = options.maxBytes ?? 4 * 1024 ** 3;
  const maxUnits = options.maxUnits ?? 5_000_000;
  const stats = options.stats ?? {};
  Object.assign(stats, { units: 0, pairs: 0, skipped: 0, bytes: 0 });
  const parser = new SaxesParser({ xmlns: true });
  const stack = [],
    queue = [];
  let variants = null,
    current = null,
    segment = false,
    suppressed = 0;
  let root = false,
    body = false,
    pending = 0,
    unitChars = 0;
  let decoder,
    prefix = Buffer.alloc(0);
  const fail = (message) => {
    throw new AppError(message, 422);
  };
  parser.on("error", () => fail("TMX corrompido: XML inválido ou incompleto."));
  parser.on("doctype", (d) => {
    pending = 0;
    // Saxes never fetches external DTDs. Internal entity declarations are refused.
    if (d.includes("["))
      fail("TMX com entidades DTD internas não é permitido.");
  });
  parser.on("opentag", (node) => {
    pending = 0;
    const name = node.local,
      parent = stack.at(-1);
    if (!stack.length) {
      if (name !== "tmx") fail("O arquivo não é uma memória TMX.");
      root = true;
      const enc = parser.xmlDecl.encoding?.toLowerCase();
      if (
        enc &&
        !["utf-8", "utf8", "utf-16", "utf-16le", "utf-16be"].includes(enc)
      )
        fail("O TMX deve usar UTF-8 ou UTF-16.");
      if (enc?.startsWith("utf-16") && decoder.encoding === "utf-8")
        fail("TMX UTF-16 deve conter BOM.");
    }
    stack.push(name);
    if (stack.length > 64) fail("TMX excedeu o limite de profundidade XML.");
    if (name === "body") {
      if (parent !== "tmx" || body) fail("Estrutura TMX inválida.");
      body = true;
    } else if (name === "tu") {
      if (parent !== "body" || variants) fail("Unidade TMX inválida.");
      if (++stats.units > maxUnits) fail("TMX excedeu o limite de unidades.");
      variants = [];
      unitChars = 0;
    } else if (name === "tuv") {
      if (parent !== "tu" || !variants || variants.length >= 64)
        fail("Variante TMX inválida.");
      const lang =
        node.attributes["xml:lang"]?.value ?? node.attributes.lang?.value;
      current = {
        lang: lang ? language(lang) : "",
        text: "",
        hasSegment: false,
      };
    } else if (name === "seg") {
      if (parent !== "tuv" || !current || current.hasSegment)
        fail("Segmento TMX inválido.");
      current.hasSegment = true;
      segment = true;
    } else if (
      segment &&
      (suppressed || ["bpt", "ept", "ph", "it", "ut"].includes(name))
    ) {
      suppressed++;
    }
  });
  function text(value) {
    pending = 0;
    if (variants && (unitChars += value.length) > 262144)
      fail("Unidade TMX grande demais.");
    if (segment && !suppressed) {
      current.text += value;
      if (current.text.length > 65536) fail("Segmento TMX grande demais.");
    }
  }
  parser.on("text", text);
  parser.on("cdata", text);
  parser.on("closetag", (node) => {
    pending = 0;
    const name = node.local;
    if (suppressed) suppressed--;
    else if (name === "seg") segment = false;
    else if (name === "tuv") {
      variants.push(current);
      current = null;
    } else if (name === "tu") {
      const original = variant(variants, source),
        translation = variant(variants, target);
      if (original && translation) {
        queue.push({ original, translation });
        stats.pairs++;
      } else stats.skipped++;
      variants = null;
    }
    stack.pop();
  });
  function write(bytes) {
    if (!decoder) {
      prefix = Buffer.concat([prefix, bytes]);
      if (prefix.length < 4) return;
      const encoding =
        prefix[0] === 255 && prefix[1] === 254
          ? "utf-16le"
          : prefix[0] === 254 && prefix[1] === 255
            ? "utf-16be"
            : "utf-8";
      decoder = new TextDecoder(encoding, { fatal: true });
      bytes = prefix;
      prefix = Buffer.alloc(0);
    }
    pending += bytes.length;
    if (pending > 1024 ** 2) fail("Elemento XML grande demais.");
    parser.write(decoder.decode(bytes, { stream: true }));
  }
  try {
    for await (const chunk of stream) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      stats.bytes += bytes.length;
      if (stats.bytes > maxBytes)
        fail("TMX descompactado excedeu o limite de tamanho.");
      for (let i = 0; i < bytes.length; i += 16384) {
        write(bytes.subarray(i, i + 16384));
        while (queue.length) yield queue.shift();
      }
    }
    if (!decoder) fail("Arquivo TMX vazio ou incompleto.");
    parser.write(decoder.decode()).close();
    while (queue.length) yield queue.shift();
    if (!root || !body || !stats.pairs)
      fail("O TMX não contém pares para os idiomas selecionados.");
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      "Não foi possível ler o TMX: arquivo corrompido ou codificação inválida.",
      422,
    );
  }
}

// Detect compression from bytes, not from an untrusted filename. ZIP entries
// are streamed directly; no path supplied by the archive is written to disk.
export async function* readTmxFile(path, options) {
  const handle = await open(path, "r"),
    magic = Buffer.alloc(4);
  try {
    await handle.read(magic, 0, 4, 0);
  } finally {
    await handle.close();
  }
  if (magic[0] === 0x50 && magic[1] === 0x4b) {
    let zip;
    try {
      zip = await yauzl.openPromise(path, {
        lazyEntries: true,
        autoClose: false,
        strictFileNames: true,
      });
      let selected,
        entries = 0;
      for await (const entry of zip.eachEntry()) {
        if (++entries > 10000)
          throw new AppError("ZIP contém entradas demais.", 422);
        if (/\.tmx$/i.test(entry.fileName)) {
          if (selected)
            throw new AppError(
              "ZIP deve conter exatamente um arquivo TMX.",
              422,
            );
          selected = entry;
        }
      }
      if (!selected) throw new AppError("ZIP não contém arquivo TMX.", 422);
      if (selected.uncompressedSize > (options.maxBytes ?? 4 * 1024 ** 3))
        throw new AppError(
          "TMX descompactado excedeu o limite de tamanho.",
          422,
        );
      const input = await zip.openReadStreamPromise(selected);
      async function* checked() {
        let crc = 0;
        for await (const chunk of input) {
          crc = crc32(chunk, crc);
          yield chunk;
        }
        if (crc !== selected.crc32)
          throw new AppError("ZIP corrompido: checksum inválido.", 422);
      }
      yield* parseTmx(checked(), options);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Arquivo ZIP inválido ou corrompido.", 422);
    } finally {
      zip?.close();
    }
  } else {
    const input = createReadStream(path);
    const stream =
      magic[0] === 0x1f && magic[1] === 0x8b ? createGunzip() : input;
    const pumping =
      stream === input ? null : pipeline(input, stream).catch(() => {});
    try {
      yield* parseTmx(stream, options);
    } finally {
      stream.destroy();
      await pumping;
    }
  }
}
