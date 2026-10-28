import { createClient } from "@supabase/supabase-js";
import { Action, World, demoWorld, reduceDemo } from "@/domain/world";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const supabase =
  url && key
    ? createClient(url, key, {
        global: {
          fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
        },
      })
    : null;
const DEMO_KEY = "isola-demo-v1";
export function loadDemo(): World {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    if (raw) {
      const state = JSON.parse(raw);
      if (
        state.version === 1 &&
        state.me === "demo-me" &&
        Array.isArray(state.spaces)
      )
        return state;
    }
  } catch {}
  const s = demoWorld();
  localStorage.setItem(DEMO_KEY, JSON.stringify(s));
  return s;
}
export async function loadWorld(demo: boolean): Promise<World> {
  if (demo) return loadDemo();
  const { data, error } = await supabase!.rpc("isola_state");
  if (error) throw Error(error.message);
  return data as World;
}
export async function mutate(
  demo: boolean,
  state: World,
  action: Action,
): Promise<World> {
  if (!navigator.onLine) throw Error("인터넷 연결 후 다시 시도해 주세요.");
  if (demo) {
    const latest = loadDemo();
    const next = reduceDemo(latest, action);
    localStorage.setItem(DEMO_KEY, JSON.stringify(next));
    return next;
  }
  const { error } = await supabase!.rpc("isola_mutate", { action });
  if (error) throw Error(error.message);
  return loadWorld(false);
}
