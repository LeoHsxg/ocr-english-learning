import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { crx } from "@crxjs/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import manifest from "./manifest.json";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        wordlist: "./src/wordlist/index.html",
      },
    },
  },
  plugins: [preact(), tailwindcss(), crx({ manifest })],
});

