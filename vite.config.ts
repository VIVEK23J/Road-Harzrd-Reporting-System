import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin, Connect } from "vite";

function apiPlugin(): Plugin {
  return {
    name: "mongodb-api-middleware",
    configureServer(server) {
      server.middlewares.use((async (req: Connect.IncomingMessage, res: any, next: Connect.NextFunction) => {
        if (req.url && (req.url.startsWith("/api/") || req.url === "/api")) {
          try {
            const { app } = await import("./src/server/app");
            (app as any)(req, res, next);
            return;
          } catch (err) {
            console.error("[API Middleware Error]:", err);
            return next(err);
          }
        }
        next();
      }) as Connect.NextHandleFunction);
    },
  };
}

export default defineConfig({
  plugins: [apiPlugin()],
  nitro: {
    preset: process.env.VERCEL ? "vercel" : process.env.NITRO_PRESET || undefined,
  },
  tanstackStart: {
    server: { entry: "server" },
  },
});
