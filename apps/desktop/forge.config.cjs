module.exports = {
  packagerConfig: {
    asar: true,
    executableName: "MaterialBrowser",
    extraResource: [
      "../../target/release/material-browser.exe",
      "../../.cache/history-git/v2.56.0.windows.2",
      "../../engines/runtime/history-git.lock.json",
    ],
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
