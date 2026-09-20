import type { GameState, LobbyState } from "@monorepo/shared";
import { useEffect, useMemo, useState } from "react";
import { GameScreen } from "./board/GameScreen.js";
import { LobbyScreen } from "./lobby/LobbyScreen.js";
import { createGameSocket } from "./socket.js";

export function App() {
  const socket = useMemo(() => createGameSocket(), []);
  const [connected, setConnected] = useState(false);
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);

  useEffect(() => {
    function handleConnect() {
      setConnected(true);
    }
    function handleDisconnect() {
      setConnected(false);
    }
    function handleLobbyUpdate(next: LobbyState) {
      setLobby(next);
    }
    function handleGameUpdate(next: GameState) {
      setGame(next);
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("lobbyUpdate", handleLobbyUpdate);
    socket.on("gameStarted", handleGameUpdate);
    socket.on("gameStateUpdate", handleGameUpdate);
    socket.connect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("lobbyUpdate", handleLobbyUpdate);
      socket.off("gameStarted", handleGameUpdate);
      socket.off("gameStateUpdate", handleGameUpdate);
      socket.disconnect();
    };
  }, [socket]);

  if (!connected) {
    return (
      <main className="status-screen">
        <p>Reaching the game server…</p>
      </main>
    );
  }

  if (game) {
    return <GameScreen game={game} myPlayerId={myPlayerId} socket={socket} />;
  }

  return <LobbyScreen socket={socket} lobby={lobby} myPlayerId={myPlayerId} onJoined={setMyPlayerId} />;
}
