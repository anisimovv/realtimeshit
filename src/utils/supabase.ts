import { createClient } from "@supabase/supabase-js";
import { env } from "../env/client.mjs";

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPBASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const client = createClient(SUPABASE_URL, SUPBASE_ANON_KEY);

export { client as supabaseClient };
