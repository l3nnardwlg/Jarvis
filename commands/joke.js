module.exports = {
  name: "joke",
  triggers: ["witz"],
  run({ helpers, respond }) {
    return respond.text(helpers.pickOne([helpers.pickJoke(), helpers.pickJoke(), helpers.pickJoke()]), {
      highlight: "Comedy subroutine online",
      quickActions: ["Erzähl noch einen Witz", "Zufallszahl bis 20", "Status"],
    });
  },
};
