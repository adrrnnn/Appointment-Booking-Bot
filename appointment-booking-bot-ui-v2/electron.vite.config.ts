import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "electron/main.ts"),
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "electron/preload.ts"),
        },
      },
    },
  },
  renderer: {
    root: resolve(__dirname, "src"),
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/index.html"),
        },
      },
      outDir: resolve(__dirname, "out/renderer"),
      emptyOutDir: true,
    },
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
      },
      // Prefer TypeScript sources when both Foo.tsx and Foo.jsx exist (otherwise Vite picks .jsx first).
      extensions: [".mjs", ".js", ".mts", ".ts", ".tsx", ".jsx", ".json"],
    },
    plugins: [react()],
  },
});
