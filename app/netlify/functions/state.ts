import { handler, loadState } from "../lib/core.ts";
import { json } from "../lib/core.ts";

export default handler(async (_req, link) => json(await loadState(link)));
export const config = { path: "/api/state" };
