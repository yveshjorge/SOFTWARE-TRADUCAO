export function seed(store) {
  if (store.metadata().total || store.glossaryList().length) return;
  const g = store.createGlossary({
    name: "Terminologia técnica",
    client: "TechCorp Solutions",
    sourceLang: "en",
    targetLang: "pt-BR",
  });
  const game = store.createGlossary({
    name: "RPG Fantasy",
    client: "Estúdio Aurora",
    sourceLang: "en",
    targetLang: "pt-BR",
  });
  const base = { sourceLang: "en", targetLang: "pt-BR", category: "Geral" };
  const rows = [
    {
      original: "Over-the-top",
      translation: "Exagerado",
      category: "Marketing e Mídias Sociais",
      tones: ["Informal"],
      examples: [
        {
          original: "The campaign was over-the-top.",
          translation: "A campanha foi exagerada.",
          category: "Marketing e Mídias Sociais",
        },
      ],
    },
    {
      original: "Power-up sequence",
      translation: "Sequência de energização",
      glossaryId: g.id,
      category: "Geral",
      tones: ["Formal"],
    },
    {
      original: "Health Potion",
      translation: "Poção de Vida",
      glossaryId: game.id,
      project: "RPG Fantasy",
      category: "Itens e Equipamentos",
    },
    {
      original: "Mana Potion",
      translation: "Poção de Mana",
      glossaryId: game.id,
      project: "RPG Fantasy",
      category: "Itens e Equipamentos",
    },
    {
      original: "Piece of cake",
      translation: "Sussa",
      glossaryId: game.id,
      project: "RPG Fantasy",
      category: "Diálogos",
      tones: ["Informal", "Gírias/Humor"],
      tags: ["Gírias/Humor"],
    },
    {
      original: "Consideration",
      translation: "Contraprestação",
      category: "Direito dos Contratos",
      tones: ["Formal"],
      justification:
        "Equivalência terminológica no contexto de obrigações contratuais; exemplo didático, sujeito à revisão profissional.",
      official: true,
    },
    {
      original: "CRISPR-Cas9",
      translation: "CRISPR-Cas9",
      category: "Biotecnologia",
      tones: ["Formal"],
    },
    {
      original: "Break a leg",
      translation: "Arrase!",
      category: "Literatura",
      work: "O último ato",
      intention: "Preservar a intenção de desejar sorte, sem tradução literal.",
      tones: ["Informal"],
      variations: [
        { translation: "Boa sorte!", character: "Narrador", tone: "Neutro" },
      ],
    },
  ];
  for (const r of rows) {
    const t = store.create({ ...base, ...r });
    if (r.original === "Piece of cake")
      store.note(
        t.id,
        {
          kind: "Nota explicativa",
          text: "Gíria gamer para fácil/tranquilo, usar em tom cômico",
        },
        t.version,
      );
  }
}
