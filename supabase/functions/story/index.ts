// Fonction Supabase « story » : écrit une histoire adaptée à l'enfant avec l'API Claude d'Anthropic.
// Secrets à définir (voir GUIDE.md, étape 4) : ANTHROPIC_API_KEY, et éventuellement STORY_MODEL.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const clean = (v: unknown) => String(v ?? "").replace(/[<>{}\[\]]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);

const SYSTEM = `Tu es un auteur de littérature jeunesse française. Tu écris des histoires originales, bienveillantes et adaptées à l'âge de l'enfant.
Règles absolues :
- Contenu adapté aux enfants : pas de violence effrayante, pas de mort, pas de contenu inquiétant, pas de moquerie. L'histoire finit bien.
- Aucun personnage, lieu ou objet protégé par des droits (pas de héros de films, dessins animés, jeux vidéo, marques). Tout est inventé.
- Français correct et soigné, orthographe impeccable, ponctuation claire.
- Si une idée de l'enfant n'est pas appropriée, remplace-la discrètement par une idée gentille et proche.
- Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return json({ error: "Connexion requise" }, 401);

    const body = await req.json();
    const slug = clean(body.child).toLowerCase();
    // RLS : on ne trouve l'enfant que s'il fait partie de la famille du parent connecté
    const { data: kids } = await sb.from("children").select("first_name, grade").eq("slug", slug).limit(1);
    if (!kids || !kids.length) return json({ error: "Profil introuvable" }, 403);
    const grade = kids[0].grade;
    const p = Object.fromEntries(Object.entries(body.params ?? {}).map(([k, v]) => [k, clean(v)]));

    const LEVELS: Record<string, string> = {
      CP: `Lectrice ou lecteur de CP (6 ans) qui apprend à lire. 3 pages, chaque page 50 à 80 mots. Phrases très courtes (5 à 8 mots), mots simples avec des sons déjà connus, présent de l'indicatif. Très peu de dialogues. 4 mots de vocabulaire à expliquer. 3 questions de compréhension très simples (qui ? où ? quoi ?).`,
      CE1: `Lecteur de CE1 (7 ans) qui apprend encore à bien lire. 3 pages, chaque page 100 à 150 mots (300 à 450 mots au total). Phrases courtes (8 à 12 mots), mots simples et courants, présent de l'indicatif surtout. Peu de dialogues, toujours introduits clairement. 5 mots de vocabulaire à expliquer. 4 questions de compréhension très simples (qui ? où ? quoi ? pourquoi ?).`,
      CM1: `Lectrice de CM1 (9 ans), bonne lectrice. 3 pages, chaque page 180 à 250 mots. Vocabulaire riche mais compréhensible, des dialogues, imparfait et passé simple. 6 mots de vocabulaire à expliquer. 5 questions de compréhension dont au moins 2 qui demandent de réfléchir.`,
      CM2: `Lectrice de CM2 (10 ans), bonne lectrice. 3 pages, chaque page 220 à 300 mots (650 à 900 mots au total). Vocabulaire riche mais compréhensible, des dialogues, imparfait et passé simple. 7 mots de vocabulaire à expliquer. 5 questions de compréhension dont au moins 2 qui demandent de réfléchir (déduire, expliquer un sentiment).`,
    };
    const level = LEVELS[grade] ?? LEVELS.CE1;

    const prompt = `Écris une histoire avec ces choix de l'enfant :
- Héros ou héroïne : ${p.heros || "un enfant courageux"}
- Compagnon : ${p.compagnon || "un ami fidèle"}
- Époque : ${p.epoque || "aujourd'hui"}
- Lieu : ${p.lieu || "une forêt"}
- Genre : ${p.genre || "une aventure"}
- But du héros : ${p.objectif || "aider quelqu'un"}
- Obstacle : ${p.obstacle || "une énigme"}
- Ton : ${p.ton || "drôle"}

Niveau : ${level}

Réponds avec ce JSON exactement :
{"title":"titre court","pages":["texte page 1","texte page 2","texte page 3"],"glossary":[{"mot":"un mot difficile présent tel quel dans le texte","definition":"définition simple pour un enfant"}],"questions":[{"question":"…","bonne_reponse":"la seule réponse juste","mauvaises_reponses":["fausse 1","fausse 2","fausse 3"],"explication":"phrase qui explique la bonne réponse en citant l'histoire"}]}
Dans "pages", sépare les paragraphes par un retour à la ligne (\\n). Pour chaque question, "bonne_reponse" doit être exactement la réponse que justifie "explication", et les "mauvaises_reponses" doivent être clairement fausses d'après l'histoire.`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: Deno.env.get("STORY_MODEL") || "claude-haiku-5-5",
        max_tokens: 16000,
        thinking: { type: "disabled" },
        system: SYSTEM,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const j = await r.json();
    if (!r.ok) return json({ error: "Le service d'histoires ne répond pas", detail: j?.error?.message }, 502);
    const text = (j.content ?? []).map((c: { text?: string }) => c.text ?? "").join("");
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return json({ error: "Réponse illisible", detail: `stop=${j.stop_reason}` }, 502);
    const s = JSON.parse(m[0]);
    if (!s.title || !Array.isArray(s.pages) || !s.pages.length || !Array.isArray(s.questions)) return json({ error: "Histoire incomplète" }, 502);
    s.glossary = Array.isArray(s.glossary) ? s.glossary.slice(0, 10) : [];
    // Les options sont mélangées ici : la bonne réponse est connue par son texte, pas par une position donnée par le modèle
    type Q = { question?: string; bonne_reponse?: string; mauvaises_reponses?: unknown[]; explication?: string };
    s.questions = (s.questions as Q[])
      .filter((q) => q.question && q.bonne_reponse && Array.isArray(q.mauvaises_reponses) && q.mauvaises_reponses.length >= 1)
      .slice(0, 6)
      .map((q) => {
        const good = String(q.bonne_reponse);
        const bad = q.mauvaises_reponses!.map(String).filter((o) => o && o !== good).slice(0, 3);
        const options = [good, ...bad];
        for (let i = options.length - 1; i > 0; i--) {
          const k = Math.floor(Math.random() * (i + 1));
          [options[i], options[k]] = [options[k], options[i]];
        }
        return { question: q.question, options, answer: options.indexOf(good), explication: q.explication ?? "" };
      });
    return json(s);
  } catch (_e) {
    return json({ error: "Erreur pendant la création de l'histoire" }, 500);
  }
});
