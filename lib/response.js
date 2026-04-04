const defaultQuickActions = ["Status", "Wetter in Berlin", "Wie spät ist es?", "Rechne 12*12"];

function createResponse(type, content, extras = {}) {
  return {
    response: {
      type,
      content,
    },
    quickActions: extras.quickActions || defaultQuickActions,
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
  error,
  card,
};
