import { createServer, type Server as HttpServer } from "node:http";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "@monorepo/shared";
import { Server } from "socket.io";
import { registerGameServer, type GameServer } from "./game-server.js";

export interface App {
  readonly httpServer: HttpServer;
  readonly io: GameServer;
  close(): Promise<void>;
}

/**
 * Builds the server without binding a port, so tests can listen on an
 * ephemeral one (`httpServer.listen(0)`) and connect a real socket.io-client
 * against it - the standard way to test Socket.io wiring, and more useful
 * here than mocking the network layer away.
 */
export function createApp(): App {
  const httpServer = createServer();
  const io: GameServer = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, {
    // Permissive CORS: per the project's own architecture, this server is
    // reached only through a Cloudflare Tunnel URL shared privately with
    // the four intended players - there's no multi-tenant origin to guard.
    cors: { origin: "*" },
  });
  registerGameServer(io);

  return {
    httpServer,
    io,
    close: () => new Promise((resolve, reject) => io.close((error) => (error ? reject(error) : resolve()))),
  };
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const port = Number(process.env.PORT ?? 3000);
  const { httpServer } = createApp();
  httpServer.listen(port, () => {
    console.log(`Imperial Catan server listening on http://localhost:${port}`);
    console.log(`Run \`cloudflared tunnel --url http://localhost:${port}\` to get a shareable link for the group.`);
  });
}
