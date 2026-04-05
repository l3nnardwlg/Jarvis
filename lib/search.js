const http = require("http");
const https = require("https");

const SEARXNG_ENDPOINT = process.env.SEARXNG_ENDPOINT || "http://localhost:8888";
const SEARXNG_ENABLED = !["0", "false", "off", "no"].includes(
  String(process.env.SEARXNG_ENABLED || "true").trim().toLowerCase()
);
const SEARXNG_TIMEOUT_MS = Number(process.env.SEARXNG_TIMEOUT_MS) || 5000;
const MAX_RESULTS = 5;

function requestGet(url, timeout) {
  const parsedUrl = new URL(url);
  const client = parsedUrl.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const req = client.get(parsedUrl, { timeout }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`SearXNG HTTP ${res.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error("SearXNG lieferte kein gueltiges JSON."));
        }
      });
    });

    req.on("timeout", () => {
      req.destroy(new Error("SearXNG Timeout"));
    });
    req.on("error", reject);
  });
}

async function isSearchAvailable() {
  if (!SEARXNG_ENABLED) return false;
  try {
    await requestGet(`${SEARXNG_ENDPOINT}/`, Math.min(SEARXNG_TIMEOUT_MS, 2000));
    return true;
  } catch {
    return false;
  }
}

async function searchWeb(query, options = {}) {
  if (!SEARXNG_ENABLED) {
    throw new Error("SearXNG ist deaktiviert.");
  }

  const params = new URLSearchParams({
    q: query,
    format: "json",
    categories: options.categories || "general",
    language: options.language || "de",
  });

  const url = `${SEARXNG_ENDPOINT}/search?${params}`;
  const data = await requestGet(url, SEARXNG_TIMEOUT_MS);

  const results = (data.results || []).slice(0, MAX_RESULTS).map((r) => ({
    title: r.title || "",
    url: r.url || "",
    content: r.content || "",
  }));

  return results;
}

function formatSearchContext(results) {
  if (!results.length) return "Keine Suchergebnisse gefunden.";

  return "Websuchergebnisse:\n" + results.map((r, i) =>
    `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.content}`
  ).join("\n\n");
}

function needsWebSearch(input) {
  const keywords = [
    "aktuell", "heute", "neueste", "2024", "2025", "2026",
    "preis", "kosten", "kaufen", "news", "nachrichten",
  ];
  const lower = String(input || "").toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

module.exports = {
  isSearchAvailable,
  searchWeb,
  formatSearchContext,
  needsWebSearch,
  SEARXNG_ENABLED,
};
