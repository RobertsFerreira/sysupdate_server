import { env } from "@/config/env";
import { initializeDatabase } from "@/db/schemas";
import { routes } from "@/routes/routes";
import { Elysia } from "elysia";

const app = new Elysia()
  .onStart(() => {
    initializeDatabase();
  })
  .use(routes)
  .listen(env.SERVER_PORT);

console.log(`Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
