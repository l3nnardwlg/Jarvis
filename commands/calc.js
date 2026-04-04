module.exports = {
  name: "calc",
  triggers: ["rechner", "rechne", "berechne", "was ist"],
  match({ input, state, helpers }) {
    const followUpExpression = helpers.buildFollowUpMathExpression(input, state.context.lastResult);
    return followUpExpression ? 135 : 0;
  },
  run({ input, state, memory, helpers, respond }) {
    const followUpExpression = helpers.buildFollowUpMathExpression(input, state.context.lastResult);
    const expression = followUpExpression || helpers.extractMathExpression(input);
    const result = helpers.calculateExpression(expression);

    if (result === null) {
      return respond.error(helpers.pickOne([
        "Den Ausdruck konnte ich nicht sicher auswerten. Nutze nur Zahlen und + - * / % mit Klammern.",
        "Die Rechnung war für mich nicht eindeutig. Versuch nur Zahlen und Rechenzeichen zu verwenden.",
        "Das sah nicht nach einer sicheren Rechnung aus. Schreib den Ausdruck bitte etwas klarer.",
      ]), {
        highlight: "Calculator input rejected",
        quickActions: ["Rechne 5*9", "Rechne (12+4)/2", "Status"],
      });
    }

    state.context.lastResult = result;
    memory.setContext({ lastResult: result, lastCommand: "calc" });

    return respond.text(helpers.pickOne([
      `Ergebnis: ${expression} = ${result}`,
      `Ich komme auf ${result}. Ausgangsrechnung: ${expression}`,
      `${expression} ergibt ${result}.`,
    ]), {
      highlight: "Calculator solved",
      quickActions: ["Mal 2", "Rechne 19*19", "Zufallszahl bis 50"],
    });
  },
};
