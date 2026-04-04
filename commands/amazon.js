module.exports = {
  name: "amazon",
  triggers: ["amazon", "suche", "such", "finde", "find", "bestell", "kaufen"],
  match({ normalizedInput }) {
    if (/(notiz|notizen|merke|speicher)/.test(normalizedInput)) {
      return 0;
    }

    let score = 0;
    if (/\bamazon\b/.test(normalizedInput)) score += 140;
    if (/\b(such|suche|find|finde|bestell|kauf|kaufe)\b/.test(normalizedInput)) score += 100;
    return score;
  },
  run({ input, helpers, respond }) {
    const product = helpers.extractAmazonProduct(input);
    return respond.link(helpers.pickOne([
      `Ich habe eine Amazon-Suche für \"${product}\" vorbereitet.`,
      `Die Suche nach \"${product}\" steht bereit.`,
      `Amazon-Link für \"${product}\" ist erzeugt.`,
    ]), {
      links: [{ label: `Amazon: ${product}`, url: helpers.searchAmazon(product) }],
      highlight: "Shopping-Link erzeugt",
      linkType: "amazon",
      quickActions: ["Such Tastatur auf Amazon", "Such ESP32 auf Amazon", "Öffne amazon.de"],
    });
  },
};
