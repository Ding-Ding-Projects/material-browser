const path = require("node:path");
const icon = path.join(__dirname, "assets/material-browser.ico");
module.exports = {
  packagerConfig: {
    asar: true,
    executableName: "MaterialBrowser",
    icon,
    extraResource: ["../../target/release/material-browser.exe"],
    ignore: [/^\/src($|\/)/, /^\/node_modules($|\/)/],
  },
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "MaterialBrowser",
        setupIcon: icon,
        authors: "Ding Ding Projects",
        description: "Encrypted browser profile workspace",
      },
    },
  ],
};
