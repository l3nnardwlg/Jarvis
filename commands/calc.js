module.exports = {
  name: "calc",
  triggers: ["rechner", "rechne", "berechne", "was ist"],
  run({ input, helpers, respond }) {
    const expression = helpers.extractMathExpression(input);
    const result = helpers.calculateExpression(expression);

    if (result === null) {
      return respond.error("Den Ausdruck konnte ich nicht sicher berechnen. Nutze nur Zahlen und + - * / % Klammern.", {
        highlight: "Calculator input rejected",
        quickActions: ["Rechne 5*9", "Rechne (12+4)/2", "Status"],
      });
    }

    return respond.text(`Ergebnis: ${expression} = ${result}`, {
      highlight: "Calculator solved",
      quickActions: ["Rechne 19*19", "Zufallszahl bis 50", "Status"],
    });
  },
};
