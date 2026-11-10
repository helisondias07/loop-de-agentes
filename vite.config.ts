import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { loopApiPlugin } from "./src/server/plugin.ts";

export default defineConfig({
  plugins: [react(), loopApiPlugin()],
  server: {
    host: "127.0.0.1",
    port: 43147,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 43147,
    strictPort: true,
  },
});
