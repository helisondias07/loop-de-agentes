import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { loopApiPlugin } from "./src/server/plugin.ts";

export default defineConfig(({ command, mode }) => {
  const isStatic = mode === "static";
  return {
    base: isStatic ? "./" : "/",
    plugins: [react(), ...(isStatic || command === "build" ? [] : [loopApiPlugin()])],
    define: {
      "import.meta.env.VITE_STATIC_DEMO": JSON.stringify(isStatic ? "true" : "false"),
    },
    build: {
      outDir: isStatic ? "dist-static" : "dist",
      emptyOutDir: true,
    },
    server: {
      host: "127.0.0.1",
      port: 43147,
      strictPort: true,
    },
    preview: {
      host: "127.0.0.1",
      port: 43148,
      strictPort: true,
    },
  };
});
