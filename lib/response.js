const defaultQuickActions = ["Status", "Wetter in Berlin", "Wie spät ist es?", "Rechne 12*12"];
const persistentQuickActions = ["Wie spät ist es?", "Rechne 5+5", "Such Kopfhörer auf Amazon"];

function mergeQuickActions(items = []) {
  return [...new Set([...(items || []), ...persistentQuickActions, ...defaultQuickActions])].slice(0, 6);
}

function createResponse(type, content, extras = {}) {
  const response = {
    type,
    content,
  };

  if (Array.isArray(extras.items) && extras.items.length) {
    response.items = extras.items;
  }

  return {
    response,
    quickActions: mergeQuickActions(extras.quickActions),
    links: extras.links || [],
    highlight: extras.highlight || "System nominal",
    autoOpenLinks: extras.autoOpenLinks || false,
    linkType: extras.linkType || null,
  };
}

function text(content, extras = {}) {
  return createResponse("text", content, extras);
}

function link(content, extras = {}) {
  return createResponse("link", content, extras);
}

function list(content, extras = {}) {
  return createResponse("list", content, extras);
}

function error(content, extras = {}) {
  return createResponse("error", content, {
    highlight: extras.highlight || "Command error",
    ...extras,
  });
}

function card(content, extras = {}) {
  return createResponse("card", content, extras);
}

module.exports = {
  text,
  link,
  list,
  error,
  card,
};
