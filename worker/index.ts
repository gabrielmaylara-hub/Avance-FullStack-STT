import { route } from "../backend/router";
import type { AppEnv } from "../backend/middleware/auth";

interface Env extends AppEnv { ASSETS: Fetcher; }

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname.startsWith("/api/")) {
      return route(request, env);
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
