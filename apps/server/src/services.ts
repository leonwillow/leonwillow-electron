import { createAuth } from "@leonwillow-electron/auth";
import { createDb } from "@leonwillow-electron/db";

import { ENV } from "./env.server";

export const db = createDb(ENV);
export const auth = createAuth(ENV, db);
