import type { ClientToServerEvents, ServerToClientEvents } from "@monorepo/shared";
import { io, type Socket } from "socket.io-client";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * No URL in production: the plan is for the game server to serve this
 * client's built files itself (one host machine, one Cloudflare Tunnel), so
 * same-origin is correct there. `.env.development` points local dev at a
 * separately-running `npm run dev` in the server workspace instead.
 */
const SERVER_URL = import.meta.env.VITE_SERVER_URL as string | undefined;

/**
 * `autoConnect: false` - the caller (see `App.tsx`) connects explicitly
 * inside a `useEffect`, so React 18 Strict Mode's mount/cleanup/mount replay
 * in development reconnects correctly instead of leaving a closed socket.
 */
export function createGameSocket(): GameSocket {
  return io(SERVER_URL, { autoConnect: false });
}
