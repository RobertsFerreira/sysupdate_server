import { env } from "@/config/env";
import { routes } from "@/routes/routes";
import { Elysia } from "elysia";

const app = new Elysia()
  .use(routes)
  .listen(env.SERVER_PORT);

console.log(`Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
