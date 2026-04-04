const fs = require("fs");
const path = require("path");

function loadCommands(commandsDir) {
  return fs
    .readdirSync(commandsDir)
    .filter((file) => file.endsWith(".js"))
    .sort()
    .map((file) => require(path.join(commandsDir, file)))
    .filter((command) => command && command.name && typeof command.run === "function");
}

module.exports = {
  loadCommands,
};
