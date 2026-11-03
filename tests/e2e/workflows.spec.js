import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("create edit and consult immutable history through UI", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Novo termo", exact: true }).click();
  await page
    .getByLabel("Termo original *", { exact: true })
    .fill("E2E Moonstone");
  await page.getByLabel("Tradução *", { exact: true }).fill("Pedra da lua");
  await page
    .getByRole("button", { name: "Salvar Registro", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Ver detalhes de E2E Moonstone", exact: true })
    .click();
  await page.getByRole("button", { name: "Editar termo", exact: true }).click();
  await page.getByLabel("Tradução *", { exact: true }).fill("Pedra lunar");
  await page
    .getByRole("button", { name: "Salvar Registro", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".translation")).toHaveText("Pedra lunar");
  await page
    .getByRole("button", { name: "Histórico (2)", exact: true })
    .click();
  await expect(page.locator("del")).toContainText("Pedra da lua");
  await expect(page.locator("ins")).toContainText("Pedra lunar");
  await page
    .getByRole("button", { name: "Consultar versão 1", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Pedra da lua");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exportar registro histórico" })
    .click();
  expect((await download).suggestedFilename()).toBe("ficha-v1.html");
});
test("search filters combine, clear, preserve URL and support Back", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Buscar termos", { exact: true }).fill("pocao");
  await expect(page.locator(".term-card")).toHaveCount(2);
  await page
    .getByRole("combobox", { name: "Projeto / jogo", exact: true })
    .selectOption("RPG Fantasy");
  await page.getByLabel("Itens e Equipamentos", { exact: true }).check();
  await expect(page.locator(".term-card")).toHaveCount(2);
  await page.reload();
  await expect(page.getByLabel("Buscar termos", { exact: true })).toHaveValue(
    "pocao",
  );
  await page.getByRole("button", { name: "Limpar busca", exact: true }).click();
  await expect(page.getByLabel("Buscar termos", { exact: true })).toBeFocused();
  await page.goBack();
  await expect(page.getByLabel("Buscar termos", { exact: true })).toHaveValue(
    "pocao",
  );
  await page
    .getByLabel("Buscar termos", { exact: true })
    .fill("nada-encontrado");
  await expect(
    page.getByRole("heading", { name: "Nenhum termo encontrado", exact: true }),
  ).toBeVisible();
});
test("create client glossary then term restricted to it", async ({ page }) => {
  await page.goto("/?view=glossaries");
  await page
    .getByRole("button", { name: "Criar Glossário por Cliente", exact: true })
    .click();
  await page.getByLabel("Nome do glossário *").fill("Vocabulário E2E");
  await page.getByLabel("Cliente *").fill("Cliente E2E");
  await page
    .getByRole("button", { name: "Criar glossário", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .locator(".glossary-card")
    .filter({ hasText: "Cliente E2E" })
    .getByRole("button", { name: "Abrir glossário" })
    .click();
  await page.getByRole("button", { name: "Novo termo", exact: true }).click();
  await page.getByLabel("Termo original *").fill("Client only");
  await page
    .getByLabel("Tradução *", { exact: true })
    .fill("Exclusivo do cliente");
  await page
    .getByRole("button", { name: "Salvar Registro", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".term-card")).toHaveCount(1);
  await expect(page.locator(".term-card")).toContainText("Client only");
});
test("import preview, deselection, confirmation and unsupported file error", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Importar termos", exact: true })
    .click();
  await page.locator("input[type=file]").setInputFiles({
    name: "glossario.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("E2E Sun → Sol\nE2E Ocean → Oceano"),
  });
  await page.getByRole("button", { name: "Pré-visualizar termos" }).click();
  await expect(
    page.getByLabel("Selecionar E2E Sun", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Selecionar E2E Ocean", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Confirmar e Salvar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("1 termos importados");
  await page.getByLabel("Buscar termos", { exact: true }).fill("E2E");
  await expect(
    page.locator(".term-card").filter({ hasText: "E2E Sun" }),
  ).toHaveCount(1);
  await expect(
    page.locator(".term-card").filter({ hasText: "E2E Ocean" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Importar termos", exact: true })
    .click();
  await page.locator("input[type=file]").setInputFiles({
    name: "bad.exe",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("bad"),
  });
  await page.getByRole("button", { name: "Pré-visualizar termos" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Formato de arquivo inválido",
  );
});
test("notes, examples, scientific source and variants survive edits", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Ver detalhes de Over-the-top", exact: true })
    .click();
  await expect(page.locator("mark")).toHaveText("over-the-top");
  await page.getByRole("button", { name: "Notas (0)", exact: true }).click();
  await page
    .getByRole("button", { name: "Adicionar nota", exact: true })
    .click();
  await page.getByLabel("Texto da nota *").fill("Explicação inicial");
  await page.getByRole("button", { name: "Salvar nota", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Editar nota", exact: true }).click();
  await page.getByLabel("Texto da nota *").fill("Explicação revisada");
  await page.getByRole("button", { name: "Salvar nota", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".note")).toContainText("Explicação revisada");
  await page.getByRole("button", { name: "Editar termo", exact: true }).click();
  await page.getByLabel("Fonte / referência / DOI").fill("10.1000/example");
  await page
    .getByRole("button", { name: "Adicionar variação", exact: true })
    .click();
  await page.getByLabel("Variação 1: tradução").fill("Extravagante");
  await page.getByLabel("Variação 1: personagem").fill("Narrador");
  await page
    .getByRole("button", { name: "Salvar Registro", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Contexto", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "10.1000/example ↗" }),
  ).toHaveAttribute("href", "https://doi.org/10.1000/example");
  await expect(page.locator(".variation")).toContainText("Extravagante");
});
test("validation, unsaved close and modal keyboard focus", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Novo termo", exact: true });
  await trigger.click();
  await page
    .getByRole("button", { name: "Salvar Registro", exact: true })
    .click();
  await expect(page.getByLabel("Termo original *")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByLabel("Termo original *")).toBeFocused();
  await page.getByLabel("Termo original *").fill("Unsaved");
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Descartar alterações?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continuar editando" }).click();
  await expect(page.getByLabel("Termo original *")).toHaveValue("Unsaved");
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Descartar alterações", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
test("network failure preserves form and allows retry", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Novo termo", exact: true }).click();
  await page.getByLabel("Termo original *").fill("Retry term");
  await page.getByLabel("Tradução *", { exact: true }).fill("Termo preservado");
  await page.route("**/api/terms", (route) =>
    route.request().method() === "POST" ? route.abort() : route.continue(),
  );
  await page
    .getByRole("button", { name: "Salvar Registro", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Sem conexão");
  await expect(page.getByLabel("Tradução *", { exact: true })).toHaveValue(
    "Termo preservado",
  );
  await page.unroute("**/api/terms");
  await page
    .getByRole("button", { name: "Salvar Registro", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("accessibility desktop and narrow mobile layout", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".term-card").first()).toBeVisible();
  let results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({ path: "docs/desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(
    page.getByRole("button", { name: "Filtros", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Filtros", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Idioma de origem", exact: true })
    .selectOption("en");
  await page.getByRole("button", { name: "Novo termo", exact: true }).click();
  results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  await page.screenshot({ path: "docs/mobile-form.png", fullPage: true });
});
test("stale search responses do not replace current results", async ({
  page,
}) => {
  await page.goto("/");
  await page.route("**/api/terms?**", async (route) => {
    if (route.request().url().includes("q=Health"))
      await new Promise((r) => setTimeout(r, 700));
    await route.continue();
  });
  await page.getByLabel("Buscar termos", { exact: true }).fill("Health");
  await page.waitForTimeout(350);
  await page.getByLabel("Buscar termos", { exact: true }).fill("CRISPR");
  await expect(page.locator(".term-card")).toHaveCount(1);
  await expect(page.locator(".term-card")).toContainText("CRISPR");
  await page.waitForTimeout(800);
  await expect(page.locator(".term-card")).toContainText("CRISPR");
});

test("OPUS catalog, bounded import, local suggestions and mobile layout", async ({
  page,
}) => {
  const dataset = {
    id: "a".repeat(64),
    corpus: "Europarl",
    version: "v8",
    source: "en",
    target: "pt",
    estimatedPairs: 1958175,
    downloadUrl:
      "https://object.pouta.csc.fi/OPUS-Europarl/v8/tmx/en-pt.tmx.gz",
  };
  let imported = false;
  await page.route("**/api/opus/**", async (route) => {
    const request = route.request();
    if (request.method() === "GET" && request.url().includes("/datasets?"))
      return route.fulfill({ json: { items: [dataset] } });
    if (request.method() === "GET" && request.url().endsWith("/imports"))
      return route.fulfill({
        json: {
          items: imported
            ? [
                {
                  ...dataset,
                  status: "ready",
                  importedPairs: 2,
                  coverage: "sample",
                  sampleMethod: "beginning",
                },
              ]
            : [],
        },
      });
    if (request.method() === "POST" && request.url().endsWith("/imports")) {
      imported = true;
      expect(request.postDataJSON().maxPairs).toBe(10000);
      return route.fulfill({
        status: 202,
        json: {
          ...dataset,
          id: "job-1",
          status: "importing",
          importedPairs: 0,
        },
      });
    }
    return route.fulfill({ status: 404, json: { error: "Unexpected route" } });
  });
  await page.route("**/api/translation-memory/suggestions?**", (route) =>
    route.fulfill({
      json: {
        items: [
          {
            original: "Good morning",
            translation: "Bom dia",
            corpus: "Europarl",
            version: "v8",
            match: "exact",
            sourceUrl: dataset.downloadUrl,
          },
        ],
      },
    }),
  );
  await page.route(
    "**/api/translation-memory/suggestions/batch",
    async (route) => {
      const body = route.request().postDataJSON();
      expect(body.segments).toEqual(["Good morning.", "Health care?"]);
      return route.fulfill({
        json: {
          items: body.segments.map((segment) => ({
            segment,
            suggestions: [
              {
                original: segment,
                translation: "Tradução sugerida",
                corpus: "Europarl",
                version: "v8",
                match: "exact",
                sourceUrl: dataset.downloadUrl,
                coverage: "sample",
                sampleMethod: "beginning",
              },
            ],
          })),
        },
      });
    },
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Memórias OPUS" }).click();
  await expect(
    page.getByRole("heading", { name: "Memórias do OPUS" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Buscar coleções disponíveis" })
    .click();
  await expect(
    page.getByRole("button", { name: /Importar até 10\.000 pares/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Importar até 10\.000 pares/ })
    .click();
  await expect(page.getByText("Disponível offline")).toBeVisible();
  await page.getByLabel("Trecho de origem").fill("Good morning");
  await page.getByRole("button", { name: "Buscar sugestões locais" }).click();
  await expect(page.getByText("Bom dia")).toBeVisible();
  await expect(page.getByText("Amostra do início do arquivo")).toBeVisible();
  await page
    .getByLabel("Texto para revisar")
    .fill("Good morning.\nHealth care?");
  await page
    .getByRole("button", { name: "Revisar com sugestões locais" })
    .click();
  await expect(page.getByText("Tradução sugerida")).toHaveCount(2);
  await expect(page.getByText("amostra do início").first()).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.locator("body").evaluate((el) => el.scrollWidth),
  ).resolves.toBeLessThanOrEqual(390);
});
