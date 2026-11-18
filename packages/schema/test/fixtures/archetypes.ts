/**
 * Synthetic archetype games (invented, not real titles) — one per turn model.
 * They exercise the core, the flow graph, every Phase 1 module and the scene layer.
 * Exported as `@bgc/schema/testing` for other packages' tests.
 */
import type { Citation, GameGuide, LocalizedString, Source } from "../../src";

export const L = (en: string, it: string): LocalizedString => ({ en, it });

const VIDEO_ID = "abcDEF12345";
const page = (n: number): Citation => ({ kind: "page", sourceId: "rulebook", page: n });
const time = (tStart: number, tEnd: number): Citation => ({
  kind: "time",
  sourceId: "tutorial",
  tStart,
  tEnd,
});

const SOURCES: Source[] = [
  { id: "rulebook", type: "pdf", title: "Official rulebook", lang: "en", official: true },
  {
    id: "tutorial",
    type: "video",
    title: "How to play",
    lang: "en",
    official: false,
    videoId: VIDEO_ID,
  },
  {
    id: "review",
    type: "web",
    title: "Strategy article",
    lang: "en",
    official: false,
    url: "https://example.com/review",
  },
];

const GUIDES = (goal: string, goalIt: string): GameGuide["guides"] => ({
  overview: {
    pitch: L(`A synthetic game: ${goal}.`, `Un gioco sintetico: ${goalIt}.`),
    goal: L(goal, goalIt),
    howToWin: L("Have the most points at the end.", "Avere più punti alla fine."),
  },
  misconceptions: [
    {
      id: "myth-1",
      myth: L("You may skip your turn.", "Puoi saltare il turno."),
      rule: L("You must always act.", "Devi sempre agire."),
      citations: [page(2)],
    },
  ],
  edgeCases: [
    {
      id: "edge-1",
      question: L("What if the supply runs out?", "Cosa succede se la riserva finisce?"),
      answer: L("The game ends immediately.", "La partita termina subito."),
      citations: [page(8)],
    },
  ],
});

// ── 1. sequential turns: tile placement ────────────────────────────────────
export const sequentialGame: GameGuide = {
  schemaVersion: 2,
  id: "tile-trek",
  meta: { title: L("Tile Trek", "Sentiero di Tessere"), year: 2024 },
  classification: {
    turnModel: "sequential",
    interaction: "competitive",
    mechanics: ["tile-placement", "area-control"],
    playerCount: { min: 2, max: 5, best: [3, 4] },
    playtimeMinutes: { min: 30, max: 45 },
    complexity: 1.8,
  },
  sources: SOURCES,
  components: [
    { id: "start-tile", type: "tile", name: L("Start tile", "Tessera iniziale"), quantity: 1 },
    { id: "land-tiles", type: "tile", name: L("Land tiles", "Tessere terreno"), quantity: 71 },
    {
      id: "followers",
      type: "meeple",
      name: L("Followers", "Seguaci"),
      quantity: 40,
      sceneRefs: [{ sceneId: "table", hotspotId: "supply" }],
    },
  ],
  variants: [
    {
      id: "duel",
      kind: "two-player",
      name: L("Duel", "Duello"),
      description: L(
        "Each player gets 2 extra followers.",
        "Ogni giocatore riceve 2 seguaci extra.",
      ),
    },
  ],
  expansions: [],
  glossary: [
    {
      id: "feature",
      term: L("Feature", "Elemento"),
      definition: L("A road, city or field.", "Una strada, città o campo."),
      aliases: { it: ["Zona"] },
      icon: { sceneId: "table", hotspotId: "map" },
      ruleRefs: ["place-tile"],
    },
  ],
  topics: [
    { id: "tiles", name: L("Tiles", "Tessere") },
    { id: "turn", name: L("Turn", "Turno") },
    { id: "followers", name: L("Followers", "Seguaci") },
    { id: "setup", name: L("Setup", "Preparazione") },
  ],
  rules: [
    {
      id: "place-tile",
      topics: ["tiles", "turn"],
      summary: L(
        "Place the drawn tile adjacent and matching.",
        "Piazza la tessera adiacente e combaciante.",
      ),
      detail: L("All edges must match neighbours.", "Tutti i lati devono combaciare."),
      appliesTo: { flowNodes: ["place"], components: ["land-tiles"] },
      citations: [page(3), time(95, 140)],
      conflicts: [
        {
          claim: L("Only one edge must match.", "Basta che combaci un lato."),
          citation: time(130, 140),
          resolution: L("The rulebook says all edges.", "Il regolamento dice tutti i lati."),
        },
      ],
      confidence: "high",
      sceneRefs: [{ sceneId: "table", hotspotId: "map" }],
      clips: [{ videoId: VIDEO_ID, start: 95, end: 140, lang: "en" }],
    },
    {
      id: "follower-limit",
      topics: ["followers"],
      summary: L("Max one follower per tile.", "Massimo un seguace per tessera."),
      citations: [page(4)],
      confidence: "high",
    },
    {
      id: "duel-followers",
      topics: ["followers", "setup"],
      summary: L("In a duel take 2 extra followers.", "Nel duello prendi 2 seguaci extra."),
      conditions: { playerCount: [2], variants: ["duel"] },
      citations: [page(9)],
      confidence: "medium",
    },
  ],
  setup: {
    areas: [
      { id: "center", name: L("Table center", "Centro del tavolo") },
      { id: "players", name: L("Players", "Giocatori") },
    ],
    steps: [
      {
        id: "start",
        areaId: "center",
        text: L("Place the start tile.", "Piazza la tessera iniziale."),
        components: ["start-tile"],
        sceneRef: { sceneId: "table", hotspotId: "map" },
      },
      {
        id: "followers",
        areaId: "players",
        text: L("Each player takes 7 followers.", "Ogni giocatore prende 7 seguaci."),
        components: ["followers"],
      },
      {
        id: "duel-extra",
        areaId: "players",
        text: L("Duel: take 2 more.", "Duello: prendine altri 2."),
        conditions: { playerCount: [2] },
        ruleRefs: ["duel-followers"],
      },
    ],
  },
  flow: {
    id: "game",
    kind: "sequence",
    title: L("Game", "Partita"),
    children: [
      {
        id: "turns",
        kind: "repeat",
        title: L("Play turns", "Turni di gioco"),
        until: L("No tiles remain", "Non restano tessere"),
        children: [
          {
            id: "turn",
            kind: "turnOrder",
            order: "clockwise",
            title: L("A player's turn", "Turno di un giocatore"),
            actor: "active-player",
            children: [
              { id: "draw", kind: "step", title: L("Draw a tile", "Pesca una tessera") },
              {
                id: "place",
                kind: "step",
                title: L("Place it", "Piazzala"),
                ruleRefs: ["place-tile"],
                sceneRef: { sceneId: "table", hotspotId: "map" },
                clip: { videoId: VIDEO_ID, start: 95, end: 140, lang: "en" },
              },
              {
                id: "follower",
                kind: "choice",
                title: L("Follower?", "Seguace?"),
                pick: { min: 0, max: 1 },
                options: [
                  { id: "deploy", kind: "step", title: L("Deploy one", "Piazzane uno") },
                  { id: "pass", kind: "step", title: L("Do not deploy", "Non piazzare") },
                ],
              },
              {
                id: "score-features",
                kind: "trigger",
                title: L("Completed feature", "Elemento completato"),
                when: L("A feature is completed", "Un elemento viene completato"),
                children: [
                  { id: "score-now", kind: "step", title: L("Score it", "Assegna i punti") },
                ],
              },
            ],
          },
        ],
      },
      { id: "final-scoring", kind: "step", title: L("Final scoring", "Punteggio finale") },
    ],
  },
  modules: [
    {
      id: "scoring",
      kind: "scoring",
      categories: [
        {
          id: "roads",
          name: L("Roads", "Strade"),
          timing: "both",
          description: L("1 point per tile.", "1 punto per tessera."),
        },
        {
          id: "cities",
          name: L("Cities", "Città"),
          timing: "both",
          description: L("2 points per tile.", "2 punti per tessera."),
        },
      ],
      tieBreakers: [L("Shared victory.", "Vittoria condivisa.")],
    },
  ],
  scenes: [
    {
      id: "table",
      title: L("Table", "Tavolo"),
      image: { src: "images/table.svg", width: 1600, height: 1200, alt: L("Table", "Tavolo") },
      hotspots: [
        {
          id: "map",
          label: L("Map", "Mappa"),
          shape: { kind: "rect", rect: { x: 0.2, y: 0.2, w: 0.6, h: 0.6 } },
          ruleRefs: ["place-tile"],
        },
        {
          id: "supply",
          label: L("Supply", "Riserva"),
          shape: {
            kind: "polygon",
            points: [
              { x: 0.85, y: 0.1 },
              { x: 0.98, y: 0.1 },
              { x: 0.95, y: 0.3 },
            ],
          },
        },
      ],
      annotations: [
        { id: "arrow-place", kind: "arrow", from: { x: 0.9, y: 0.2 }, to: { x: 0.5, y: 0.5 } },
        { id: "spot", kind: "marker", at: { x: 0.5, y: 0.5 }, tone: "place" },
      ],
    },
  ],
  walkthroughs: [
    {
      id: "first-turn",
      title: L("Your first turn", "Il tuo primo turno"),
      level: "newbie",
      steps: [
        {
          id: "s1",
          text: L("Draw a tile.", "Pesca una tessera."),
          flowNodeRef: "draw",
          sceneId: "table",
          highlightHotspots: ["supply"],
        },
        {
          id: "s2",
          text: L("Place it here.", "Piazzala qui."),
          flowNodeRef: "place",
          sceneId: "table",
          focus: { x: 0.3, y: 0.3, w: 0.4, h: 0.4 },
          annotations: ["arrow-place", "spot"],
          check: {
            question: L("Where does the tile go?", "Dove va la tessera?"),
            answerHotspotId: "map",
          },
        },
      ],
    },
  ],
  guides: GUIDES("build the biggest map", "costruire la mappa più grande"),
};

// ── 2. simultaneous: card drafting ─────────────────────────────────────────
export const simultaneousGame: GameGuide = {
  schemaVersion: 2,
  id: "card-feast",
  meta: { title: L("Card Feast", "Banchetto di Carte") },
  classification: {
    turnModel: "simultaneous",
    interaction: "competitive",
    mechanics: ["card-drafting", "set-collection"],
    playerCount: { min: 3, max: 7 },
    playtimeMinutes: { min: 30, max: 30 },
    complexity: 2.3,
  },
  sources: SOURCES,
  components: [{ id: "cards", type: "card", name: L("Cards", "Carte"), quantity: 60 }],
  variants: [],
  expansions: [],
  glossary: [],
  topics: [{ id: "drafting", name: L("Drafting", "Draft") }],
  rules: [
    {
      id: "draft",
      topics: ["drafting"],
      summary: L(
        "Keep one card, pass the rest left.",
        "Tieni una carta, passa le altre a sinistra.",
      ),
      appliesTo: { flowNodes: ["pick", "pass"], modules: ["cards"] },
      citations: [page(4)],
      confidence: "high",
    },
  ],
  setup: {
    areas: [],
    steps: [{ id: "deal", text: L("Deal 7 cards each.", "Distribuisci 7 carte a testa.") }],
  },
  flow: {
    id: "game",
    kind: "repeat",
    title: L("Ages", "Ere"),
    until: L("Three ages are played", "Sono state giocate tre ere"),
    children: [
      {
        id: "draft-round",
        kind: "simultaneous",
        title: L("Draft", "Draft"),
        actor: "all-players",
        syncPoint: L("Everyone reveals together", "Tutti rivelano insieme"),
        children: [
          {
            id: "pick",
            kind: "step",
            title: L("Pick a card", "Scegli una carta"),
            ruleRefs: ["draft"],
          },
          {
            id: "pass",
            kind: "step",
            title: L("Pass the hand", "Passa la mano"),
            ruleRefs: ["draft"],
          },
        ],
      },
    ],
  },
  modules: [
    {
      id: "cards",
      kind: "cards",
      decks: [
        {
          id: "main",
          name: L("Main deck", "Mazzo principale"),
          count: 60,
          composition: [
            { id: "red", label: L("Red", "Rosse"), count: 20 },
            { id: "blue", label: L("Blue", "Blu"), count: 40 },
          ],
        },
      ],
      handLimit: L("7 cards", "7 carte"),
    },
    {
      id: "scoring",
      kind: "scoring",
      categories: [
        {
          id: "sets",
          name: L("Sets", "Set"),
          timing: "end-game",
          description: L("Score complete sets.", "Segna i set completi."),
          ruleRefs: ["draft"],
        },
      ],
      tieBreakers: [],
    },
  ],
  scenes: [],
  walkthroughs: [],
  guides: GUIDES("collect the best sets", "collezionare i set migliori"),
};

// ── 3. real-time co-op ─────────────────────────────────────────────────────
export const realTimeGame: GameGuide = {
  schemaVersion: 2,
  id: "panic-kitchen",
  meta: { title: L("Panic Kitchen", "Cucina nel Panico") },
  classification: {
    turnModel: "real-time",
    interaction: "cooperative",
    mechanics: ["pattern-building", "other"],
    playerCount: { min: 1, max: 4 },
    playtimeMinutes: { min: 10, max: 15 },
    complexity: 1.5,
  },
  sources: SOURCES,
  components: [{ id: "sand-timer", type: "timer", name: L("Sand timer", "Clessidra") }],
  variants: [],
  expansions: [],
  glossary: [],
  topics: [{ id: "communication", name: L("Communication", "Comunicazione") }],
  rules: [
    {
      id: "no-talking",
      topics: ["communication"],
      summary: L("No talking while the timer runs.", "Vietato parlare mentre scorre il tempo."),
      citations: [page(2)],
      confidence: "high",
    },
  ],
  setup: {
    areas: [],
    steps: [{ id: "flip", text: L("Get the timer ready.", "Prepara la clessidra.") }],
  },
  flow: {
    id: "game",
    kind: "timer",
    title: L("Cook!", "Cucina!"),
    durationSeconds: 180,
    actor: "all-players",
    ruleRefs: ["no-talking"],
    children: [
      { id: "grab", kind: "step", title: L("Grab ingredients", "Prendi gli ingredienti") },
      { id: "serve", kind: "step", title: L("Serve dishes", "Servi i piatti") },
    ],
  },
  modules: [
    {
      id: "sections",
      kind: "sections",
      sections: [
        {
          id: "penalties",
          title: L("Penalties", "Penalità"),
          body: L("Talking costs 10 seconds.", "Parlare costa 10 secondi."),
          ruleRefs: ["no-talking"],
        },
      ],
    },
  ],
  scenes: [],
  walkthroughs: [],
  guides: GUIDES("serve all orders together", "servire tutti gli ordini insieme"),
};

// ── 4. dice-driven, push-your-luck ─────────────────────────────────────────
const d6Faces = [1, 2, 3, 4, 5, 6].map((v) => ({ id: `f${v}`, value: v }));

export const diceGame: GameGuide = {
  schemaVersion: 2,
  id: "dice-harbor",
  meta: { title: L("Dice Harbor", "Porto dei Dadi") },
  classification: {
    turnModel: "sequential",
    interaction: "competitive",
    mechanics: ["dice-rolling", "push-your-luck", "worker-placement"],
    playerCount: { min: 2, max: 4 },
    playtimeMinutes: { min: 20, max: 40 },
    complexity: 2,
  },
  sources: SOURCES,
  components: [{ id: "dice", type: "die", name: L("Dice", "Dadi"), quantity: 2 }],
  variants: [],
  expansions: [],
  glossary: [],
  topics: [
    { id: "dice", name: L("Dice", "Dadi") },
    { id: "actions", name: L("Actions", "Azioni") },
  ],
  rules: [
    {
      id: "bust",
      topics: ["dice"],
      summary: L("Rolling 7 ends your turn.", "Fare 7 termina il turno."),
      appliesTo: { flowNodes: ["roll"], modules: ["dice"] },
      citations: [page(5)],
      confidence: "high",
    },
    {
      id: "dock-blocking",
      topics: ["actions"],
      summary: L("An occupied dock is blocked.", "Un molo occupato è bloccato."),
      citations: [page(6)],
      confidence: "high",
    },
  ],
  setup: {
    areas: [],
    steps: [
      {
        id: "hand-dice",
        text: L("Give the dice to the first player.", "Dai i dadi al primo giocatore."),
      },
    ],
  },
  flow: {
    id: "game",
    kind: "turnOrder",
    order: "clockwise",
    title: L("Turns", "Turni"),
    children: [
      {
        id: "roll",
        kind: "roll",
        title: L("Roll 2 dice", "Tira 2 dadi"),
        dieId: "d6",
        count: 2,
        reroll: L("Reroll as long as you dare.", "Ritira finché osi."),
        ruleRefs: ["bust"],
        outcomes: [
          {
            label: L("7: bust", "7: sballato"),
            sum: { min: 7, max: 7 },
            children: [
              {
                id: "lose",
                kind: "step",
                title: L("Lose this turn's gains", "Perdi i guadagni del turno"),
              },
            ],
          },
          {
            label: L("Any six: bonus", "Un sei: bonus"),
            faces: ["f6"],
          },
          {
            label: L("Anything else", "Qualsiasi altro"),
            sum: { min: 2, max: 12 },
            children: [
              {
                id: "place-worker",
                kind: "choice",
                title: L("Use a dock", "Usa un molo"),
                pick: { min: 1, max: 1 },
                options: [
                  { id: "fish", kind: "step", title: L("Fish", "Pesca") },
                  { id: "trade", kind: "step", title: L("Trade", "Commercia") },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  modules: [
    {
      id: "dice",
      kind: "dice",
      dice: [
        {
          id: "d6",
          name: L("Six-sided die", "Dado a sei facce"),
          count: 2,
          sides: 6,
          faces: d6Faces,
        },
      ],
      rerollPolicy: L("Unlimited rerolls until bust.", "Rilanci illimitati fino allo sballo."),
    },
    {
      id: "actions",
      kind: "actions",
      actions: [
        {
          id: "fish",
          name: L("Fish", "Pesca"),
          effect: L("Gain fish equal to the lower die.", "Ottieni pesci pari al dado più basso."),
          blocking: true,
          ruleRefs: ["dock-blocking"],
          sceneRef: { sceneId: "harbor", hotspotId: "dock-fish" },
        },
        {
          id: "trade",
          name: L("Trade", "Commercia"),
          cost: L("2 fish", "2 pesci"),
          effect: L("Gain 1 coin.", "Ottieni 1 moneta."),
          conditions: { playerCount: [3, 4] },
          sceneRef: { sceneId: "harbor", hotspotId: "dock-trade" },
        },
      ],
    },
  ],
  scenes: [
    {
      id: "harbor",
      title: L("Harbor board", "Plancia del porto"),
      image: { src: "images/harbor.svg", width: 1600, height: 1000, alt: L("Harbor", "Porto") },
      hotspots: [
        {
          id: "dice-tray",
          label: L("Dice tray", "Vassoio dei dadi"),
          description: L("Roll here.", "Tira qui."),
          shape: { kind: "rect", rect: { x: 0.05, y: 0.6, w: 0.3, h: 0.3 } },
          ruleRefs: ["bust"],
        },
        {
          id: "dock-fish",
          label: L("Fishing dock", "Molo di pesca"),
          shape: { kind: "rect", rect: { x: 0.45, y: 0.1, w: 0.2, h: 0.35 } },
          ruleRefs: ["dock-blocking"],
          clip: { videoId: VIDEO_ID, start: 210, end: 245, lang: "en" },
        },
        {
          id: "dock-trade",
          label: L("Trading dock", "Molo commerciale"),
          shape: { kind: "rect", rect: { x: 0.72, y: 0.1, w: 0.2, h: 0.35 } },
        },
      ],
      annotations: [
        { id: "worker-here", kind: "marker", at: { x: 0.55, y: 0.27 }, tone: "place" },
        {
          id: "to-dock",
          kind: "arrow",
          from: { x: 0.2, y: 0.6 },
          to: { x: 0.5, y: 0.4 },
          label: L("Then place a worker", "Poi piazza un lavoratore"),
        },
        { id: "tray-glow", kind: "highlight", rect: { x: 0.05, y: 0.6, w: 0.3, h: 0.3 } },
      ],
    },
  ],
  walkthroughs: [
    {
      id: "first-roll",
      title: L("Your first roll", "Il tuo primo tiro"),
      level: "newbie",
      steps: [
        {
          id: "roll",
          text: L("Roll both dice in the tray.", "Tira entrambi i dadi nel vassoio."),
          flowNodeRef: "roll",
          sceneId: "harbor",
          focus: { x: 0, y: 0.5, w: 0.45, h: 0.5 },
          annotations: ["tray-glow"],
        },
        {
          id: "place",
          text: L("No 7? Place a worker on a dock.", "Niente 7? Piazza un lavoratore su un molo."),
          flowNodeRef: "place-worker",
          sceneId: "harbor",
          annotations: ["to-dock", "worker-here"],
          check: {
            question: L("Which dock gives you fish?", "Quale molo ti dà pesci?"),
            answerHotspotId: "dock-fish",
            explanation: L("The fishing dock, on the left.", "Il molo di pesca, a sinistra."),
          },
        },
      ],
    },
  ],
  guides: GUIDES("earn the most coins", "guadagnare più monete"),
};

// ── 5. trick-taking ────────────────────────────────────────────────────────
export const trickTakingGame: GameGuide = {
  schemaVersion: 2,
  id: "trump-tide",
  meta: { title: L("Trump Tide", "Marea di Briscole") },
  classification: {
    turnModel: "phase-rounds",
    interaction: "team",
    mechanics: ["trick-taking", "hand-management"],
    playerCount: { min: 4, max: 4 },
    playtimeMinutes: { min: 20, max: 30 },
    complexity: 1.7,
  },
  sources: SOURCES,
  components: [{ id: "deck", type: "card", name: L("Deck", "Mazzo"), quantity: 40 }],
  variants: [],
  expansions: [],
  glossary: [],
  topics: [{ id: "tricks", name: L("Tricks", "Prese") }],
  rules: [
    {
      id: "follow-suit",
      topics: ["tricks"],
      summary: L("Follow the led suit if you can.", "Rispondi al seme se puoi."),
      citations: [page(3), { kind: "url", sourceId: "review", anchor: "follow" }],
      confidence: "high",
    },
  ],
  setup: {
    areas: [],
    steps: [{ id: "deal", text: L("Deal 10 cards each.", "Distribuisci 10 carte a testa.") }],
  },
  flow: {
    id: "game",
    kind: "repeat",
    title: L("Hands", "Mani"),
    until: L("A team reaches 31 points", "Una squadra arriva a 31 punti"),
    children: [
      {
        id: "trick",
        kind: "turnOrder",
        order: "counterclockwise",
        title: L("Play a trick", "Gioca una presa"),
        firstPlayer: L("Winner of the last trick leads", "Chi ha vinto l'ultima presa inizia"),
        children: [
          { id: "lead", kind: "step", title: L("Lead a card", "Gioca una carta"), actor: "leader" },
          {
            id: "follow",
            kind: "step",
            title: L("Follow suit", "Rispondi al seme"),
            ruleRefs: ["follow-suit"],
          },
          {
            id: "win-trick",
            kind: "step",
            title: L("Highest trump wins", "Vince la briscola più alta"),
            actor: "game",
          },
        ],
      },
    ],
  },
  modules: [
    {
      id: "cards",
      kind: "cards",
      decks: [{ id: "deck", name: L("40-card deck", "Mazzo da 40"), count: 40 }],
    },
    {
      id: "sections",
      kind: "sections",
      sections: [
        {
          id: "trump",
          title: L("Trump", "Briscola"),
          body: L(
            "The last card dealt sets trump.",
            "L'ultima carta distribuita indica la briscola.",
          ),
          ruleRefs: ["follow-suit"],
        },
      ],
    },
  ],
  scenes: [],
  walkthroughs: [],
  guides: GUIDES("win the most tricks", "vincere più prese"),
};

export const ARCHETYPES = {
  sequential: sequentialGame,
  simultaneous: simultaneousGame,
  "real-time": realTimeGame,
  "dice-driven": diceGame,
  "trick-taking": trickTakingGame,
} as const;

/** Deep copy so tests can mutate freely. */
export const clone = <T>(v: T): T => structuredClone(v);
