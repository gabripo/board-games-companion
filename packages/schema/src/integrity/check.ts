import type { Citation, Conditions, SceneRef, YouTubeClip } from "../core/primitives";
import { walkFlow } from "../flow/flow";
import type { GameGuide } from "../guide";
import { type IntegrityIssue, IssueCollector, type Path } from "./issues";
import { checkModule } from "./modules";

const CITATION_SOURCE_TYPE = { page: "pdf", time: "video", url: "web" } as const;
// push-your-luck is not here: card games (e.g. Flip 7) press their luck without dice.
const DICE_MECHANICS = new Set(["dice-rolling", "roll-and-write"]);

/**
 * Cross-reference checks that a schema alone cannot express: every id reference must
 * resolve, ids must be unique, citations must point at a source of the right type, etc.
 * Returns errors (block publishing) and warnings (worth a human look).
 */
export function checkIntegrity(g: GameGuide): IntegrityIssue[] {
  const issues = new IssueCollector();

  // ── id namespaces ────────────────────────────────────────────────────────
  const sourceById = new Map(g.sources.map((s) => [s.id, s]));
  issues.unique(g.sources, ["sources"], "source");
  const componentIds = issues.unique(g.components, ["components"], "component");
  const variantIds = issues.unique(g.variants, ["variants"], "variant");
  const expansionIds = issues.unique(g.expansions, ["expansions"], "expansion");
  issues.unique(g.glossary, ["glossary"], "glossary");
  const ruleIds = issues.unique(g.rules, ["rules"], "rule");
  const topicIds = issues.unique(g.topics, ["topics"], "topic");
  const moduleIds = issues.unique(g.modules, ["modules"], "module");
  const sceneIds = issues.unique(g.scenes, ["scenes"], "scene");
  issues.unique(g.walkthroughs, ["walkthroughs"], "walkthrough");
  issues.unique(g.guides.misconceptions, ["guides", "misconceptions"], "misconception");
  issues.unique(g.guides.edgeCases, ["guides", "edgeCases"], "edge case");
  const areaIds = issues.unique(g.setup.areas, ["setup", "areas"], "setup area");
  issues.unique(g.setup.steps, ["setup", "steps"], "setup step");

  const flowNodes = [...walkFlow(g.flow, ["flow"])];
  const flowIds = new Set<string>();
  for (const { node, path } of flowNodes) {
    if (flowIds.has(node.id)) issues.error([...path, "id"], `duplicate flow node id "${node.id}"`);
    flowIds.add(node.id);
  }

  const hotspotsByScene = new Map<string, Set<string>>();
  const annotationsByScene = new Map<string, Set<string>>();
  for (const [i, scene] of g.scenes.entries()) {
    hotspotsByScene.set(
      scene.id,
      issues.unique(scene.hotspots, ["scenes", i, "hotspots"], "hotspot"),
    );
    annotationsByScene.set(
      scene.id,
      issues.unique(scene.annotations ?? [], ["scenes", i, "annotations"], "annotation"),
    );
  }

  const diceById = new Map(
    g.modules.flatMap((m) => (m.kind === "dice" ? m.dice.map((d) => [d.id, d] as const) : [])),
  );
  const videoIds = new Set(g.sources.flatMap((s) => (s.type === "video" ? [s.videoId] : [])));
  const hasOfficialPdf = g.sources.some((s) => s.type === "pdf" && s.official);

  // ── reference checkers ──────────────────────────────────────────────────
  const checkRuleRefs = (refs: readonly string[] | undefined, path: Path) => {
    for (const [i, r] of (refs ?? []).entries()) {
      if (!ruleIds.has(r)) issues.error([...path, i], `unknown rule "${r}"`);
    }
  };

  const checkSceneRef = (ref: SceneRef | undefined, path: Path) => {
    if (!ref) return;
    const hotspots = hotspotsByScene.get(ref.sceneId);
    if (!hotspots) {
      issues.error([...path, "sceneId"], `unknown scene "${ref.sceneId}"`);
    } else if (ref.hotspotId !== undefined && !hotspots.has(ref.hotspotId)) {
      issues.error(
        [...path, "hotspotId"],
        `unknown hotspot "${ref.hotspotId}" in scene "${ref.sceneId}"`,
      );
    }
  };

  const { min: minPlayers, max: maxPlayers } = g.classification.playerCount;
  const checkConditions = (c: Conditions | undefined, path: Path) => {
    if (!c) return;
    for (const [i, n] of (c.playerCount ?? []).entries()) {
      if (n < minPlayers || n > maxPlayers) {
        issues.error(
          [...path, "playerCount", i],
          `player count ${n} is outside the game's ${minPlayers}–${maxPlayers}`,
        );
      }
    }
    for (const [i, v] of (c.variants ?? []).entries()) {
      if (!variantIds.has(v)) issues.error([...path, "variants", i], `unknown variant "${v}"`);
    }
    for (const [i, e] of (c.expansions ?? []).entries()) {
      if (!expansionIds.has(e))
        issues.error([...path, "expansions", i], `unknown expansion "${e}"`);
    }
  };

  const checkCitation = (c: Citation, path: Path) => {
    const source = sourceById.get(c.sourceId);
    if (!source) {
      issues.error([...path, "sourceId"], `unknown source "${c.sourceId}"`);
      return;
    }
    const expected = CITATION_SOURCE_TYPE[c.kind];
    if (source.type !== expected) {
      issues.error(
        path,
        `a "${c.kind}" citation must point at a ${expected} source, but "${c.sourceId}" is ${source.type}`,
      );
    }
  };

  const checkClip = (clip: YouTubeClip | undefined, path: Path) => {
    if (clip && !videoIds.has(clip.videoId)) {
      issues.warning(
        [...path, "videoId"],
        `clip video "${clip.videoId}" is not declared in sources (add it for attribution)`,
      );
    }
  };

  // ── components / glossary ───────────────────────────────────────────────
  for (const [i, c] of g.components.entries()) {
    checkConditions(c.conditions, ["components", i, "conditions"]);
    for (const [j, ref] of (c.sceneRefs ?? []).entries()) {
      checkSceneRef(ref, ["components", i, "sceneRefs", j]);
    }
  }
  for (const [i, entry] of g.glossary.entries()) {
    checkSceneRef(entry.icon, ["glossary", i, "icon"]);
    checkConditions(entry.conditions, ["glossary", i, "conditions"]);
    checkRuleRefs(entry.ruleRefs, ["glossary", i, "ruleRefs"]);
  }

  // ── rules ───────────────────────────────────────────────────────────────
  for (const [i, rule] of g.rules.entries()) {
    const p: Path = ["rules", i];
    for (const [j, c] of rule.citations.entries()) checkCitation(c, [...p, "citations", j]);
    for (const [j, topic] of rule.topics.entries()) {
      if (!topicIds.has(topic)) {
        issues.error(
          [...p, "topics", j],
          `unknown topic "${topic}" (declare it in game.json topics)`,
        );
      }
    }
    for (const [j, conflict] of (rule.conflicts ?? []).entries()) {
      checkCitation(conflict.citation, [...p, "conflicts", j, "citation"]);
    }
    for (const [j, f] of (rule.appliesTo?.flowNodes ?? []).entries()) {
      if (!flowIds.has(f))
        issues.error([...p, "appliesTo", "flowNodes", j], `unknown flow node "${f}"`);
    }
    for (const [j, c] of (rule.appliesTo?.components ?? []).entries()) {
      if (!componentIds.has(c)) {
        issues.error([...p, "appliesTo", "components", j], `unknown component "${c}"`);
      }
    }
    for (const [j, m] of (rule.appliesTo?.modules ?? []).entries()) {
      if (!moduleIds.has(m))
        issues.error([...p, "appliesTo", "modules", j], `unknown module "${m}"`);
    }
    checkConditions(rule.conditions, [...p, "conditions"]);
    for (const [j, ref] of (rule.sceneRefs ?? []).entries())
      checkSceneRef(ref, [...p, "sceneRefs", j]);
    for (const [j, clip] of (rule.clips ?? []).entries()) checkClip(clip, [...p, "clips", j]);

    if (rule.confidence === "low") {
      issues.warning([...p, "confidence"], `rule "${rule.id}" has low confidence — review it`);
    }
    if (hasOfficialPdf) {
      const citesOfficial = rule.citations.some(
        (c) => sourceById.get(c.sourceId)?.official === true,
      );
      if (!citesOfficial) {
        issues.warning(
          [...p, "citations"],
          `rule "${rule.id}" is not backed by an official source — verify against the rulebook`,
        );
      }
    }
  }

  // ── topics ──────────────────────────────────────────────────────────────
  const usedTopics = new Set(g.rules.flatMap((r) => r.topics));
  for (const [i, topic] of g.topics.entries()) {
    if (!usedTopics.has(topic.id)) {
      issues.warning(["topics", i], `topic "${topic.id}" is not used by any rule`);
    }
    if (topic.name.en.trim().toLowerCase() === topic.name.it.trim().toLowerCase()) {
      issues.warning(
        ["topics", i, "name"],
        `topic "${topic.id}" is not translated (same EN and IT name)`,
      );
    }
  }

  // ── setup ───────────────────────────────────────────────────────────────
  for (const [i, step] of g.setup.steps.entries()) {
    const p: Path = ["setup", "steps", i];
    if (step.areaId !== undefined && !areaIds.has(step.areaId)) {
      issues.error([...p, "areaId"], `unknown setup area "${step.areaId}"`);
    }
    for (const [j, c] of (step.components ?? []).entries()) {
      if (!componentIds.has(c)) issues.error([...p, "components", j], `unknown component "${c}"`);
    }
    checkSceneRef(step.sceneRef, [...p, "sceneRef"]);
    checkConditions(step.conditions, [...p, "conditions"]);
    checkRuleRefs(step.ruleRefs, [...p, "ruleRefs"]);
  }

  // ── flow graph ──────────────────────────────────────────────────────────
  for (const { node, path } of flowNodes) {
    checkRuleRefs(node.ruleRefs, [...path, "ruleRefs"]);
    checkConditions(node.conditions, [...path, "conditions"]);
    checkSceneRef(node.sceneRef, [...path, "sceneRef"]);
    checkClip(node.clip, [...path, "clip"]);
    if (node.kind === "repeat" && node.untilRuleRef !== undefined) {
      checkRuleRefs([node.untilRuleRef], [...path, "untilRuleRef"]);
    }
    if (node.kind === "roll" && node.dieId !== undefined) {
      const die = diceById.get(node.dieId);
      if (!die) {
        issues.error(
          [...path, "dieId"],
          `unknown die "${node.dieId}" (define it in a dice module)`,
        );
      } else {
        const faceIds = new Set(die.faces.map((f) => f.id));
        for (const [i, o] of node.outcomes.entries()) {
          for (const [j, f] of (o.faces ?? []).entries()) {
            if (!faceIds.has(f)) {
              issues.error(
                [...path, "outcomes", i, "faces", j],
                `die "${die.id}" has no face "${f}"`,
              );
            }
          }
        }
      }
    }
  }

  // ── modules ─────────────────────────────────────────────────────────────
  const moduleCtx = { issues, checkRuleRefs, checkSceneRef, checkConditions };
  for (const [i, m] of g.modules.entries()) checkModule(m, ["modules", i], moduleCtx);

  if (
    g.classification.mechanics.some((m) => DICE_MECHANICS.has(m)) &&
    !g.modules.some((m) => m.kind === "dice")
  ) {
    issues.warning(["modules"], "game uses a dice mechanic but has no dice module");
  }

  // ── scenes ──────────────────────────────────────────────────────────────
  for (const [i, scene] of g.scenes.entries()) {
    checkConditions(scene.conditions, ["scenes", i, "conditions"]);
    for (const [j, h] of scene.hotspots.entries()) {
      checkRuleRefs(h.ruleRefs, ["scenes", i, "hotspots", j, "ruleRefs"]);
      checkClip(h.clip, ["scenes", i, "hotspots", j, "clip"]);
    }
  }

  // ── walkthroughs ────────────────────────────────────────────────────────
  for (const [i, w] of g.walkthroughs.entries()) {
    const wp: Path = ["walkthroughs", i];
    checkConditions(w.conditions, [...wp, "conditions"]);
    issues.unique(w.steps, [...wp, "steps"], "walkthrough step");
    for (const [j, step] of w.steps.entries()) {
      const p: Path = [...wp, "steps", j];
      if (step.flowNodeRef !== undefined && !flowIds.has(step.flowNodeRef)) {
        issues.error([...p, "flowNodeRef"], `unknown flow node "${step.flowNodeRef}"`);
      }
      checkClip(step.clip, [...p, "clip"]);

      const needsScene =
        step.focus !== undefined ||
        (step.highlightHotspots?.length ?? 0) > 0 ||
        (step.annotations?.length ?? 0) > 0 ||
        step.check !== undefined;
      if (step.sceneId === undefined) {
        if (needsScene)
          issues.error(p, "step uses focus/hotspots/annotations/check but has no sceneId");
        continue;
      }
      if (!sceneIds.has(step.sceneId)) {
        issues.error([...p, "sceneId"], `unknown scene "${step.sceneId}"`);
        continue;
      }
      const hotspots = hotspotsByScene.get(step.sceneId) ?? new Set();
      const annotations = annotationsByScene.get(step.sceneId) ?? new Set();
      for (const [k, h] of (step.highlightHotspots ?? []).entries()) {
        if (!hotspots.has(h)) {
          issues.error(
            [...p, "highlightHotspots", k],
            `unknown hotspot "${h}" in scene "${step.sceneId}"`,
          );
        }
      }
      for (const [k, a] of (step.annotations ?? []).entries()) {
        if (!annotations.has(a)) {
          issues.error(
            [...p, "annotations", k],
            `unknown annotation "${a}" in scene "${step.sceneId}"`,
          );
        }
      }
      if (step.check && !hotspots.has(step.check.answerHotspotId)) {
        issues.error(
          [...p, "check", "answerHotspotId"],
          `unknown hotspot "${step.check.answerHotspotId}" in scene "${step.sceneId}"`,
        );
      }
    }
  }

  // ── guides ──────────────────────────────────────────────────────────────
  for (const key of ["misconceptions", "edgeCases"] as const) {
    for (const [i, item] of g.guides[key].entries()) {
      for (const [j, c] of item.citations.entries()) {
        checkCitation(c, ["guides", key, i, "citations", j]);
      }
      checkRuleRefs(item.ruleRefs, ["guides", key, i, "ruleRefs"]);
    }
  }

  return issues.issues;
}
