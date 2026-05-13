/**
 * electron-builder configuration
 * Produces a standard Windows NSIS installer (.exe)
 */
module.exports = {
  appId: "com.appointmentbot.app",
  productName: "Appointment Bot",
  copyright: "Copyright 2026",
  asar: true,
  directories: {
    output: "release",
    buildResources: "resources",
  },
  files: [
    "out/**",
    "package.json",
    "!**/*.map",
    "!**/node_modules/.cache/**",
  ],
  extraResources: [
    {
      from: "bot/dist",
      to: "bot/dist",
    },
    {
      from: "bot/node_modules",
      to: "bot/node_modules",
    },
  ],
  win: {
    target: [
      {
        target: "nsis",
        arch: ["x64"],
      },
      {
        target: "portable",
        arch: ["x64"],
      },
    ],
    icon: "resources/icon.ico",
    signingHashAlgorithms: null,
    sign: null,
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowElevation: true,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: "Appointment Bot",
    installerIcon: "resources/icon.ico",
    uninstallerIcon: "resources/icon.ico",
    installerHeaderIcon: "resources/icon.ico",
    deleteAppDataOnUninstall: false,
  },
  mac: {
    target: "dmg",
    icon: "resources/icon.icns",
  },
  linux: {
    target: "AppImage",
    icon: "resources/icon.png",
  },
};
