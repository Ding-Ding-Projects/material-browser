module.exports = {
  packagerConfig: {
    asar: true,
    executableName: "MaterialBrowser",
    extraResource: ["../../target/release/material-browser.exe"],
    ignore: [/^\/src($|\/)/, /^\/node_modules($|\/)/],
  },
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "MaterialBrowser",
        authors: "Ding Ding Projects",
        description: "Encrypted browser profile workspace",
      },
    },
  ],
};
