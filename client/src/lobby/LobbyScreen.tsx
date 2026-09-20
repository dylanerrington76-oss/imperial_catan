import type { JoinLobbyResult, LobbyState, PlayerColor, StartGameResult } from "@monorepo/shared";
import { canJoinLobby, canStartGame, PLAYER_COLORS, REQUIRED_PLAYER_COUNT } from "@monorepo/shared";
import { type FormEvent, useState } from "react";
import type { GameSocket } from "../socket.js";
import "./lobby.css";

interface LobbyScreenProps {
  socket: GameSocket;
  lobby: LobbyState | null;
  myPlayerId: string | null;
  onJoined: (playerId: string) => void;
}

const COLOR_SWATCH: Record<PlayerColor, string> = {
  Red: "var(--resource-brick)",
  Blue: "var(--color-water)",
  White: "#e8e2d2",
  Orange: "var(--color-brass)",
};

export function LobbyScreen({ socket, lobby, myPlayerId, onJoined }: LobbyScreenProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<PlayerColor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const players = lobby?.players ?? [];
  const me = players.find((player) => player.id === myPlayerId) ?? null;

  function handleJoin(event: FormEvent) {
    event.preventDefault();
    if (!color || !name.trim()) return;
    setJoining(true);
    setError(null);
    socket.emit("joinLobby", { name: name.trim(), color }, (result: JoinLobbyResult) => {
      setJoining(false);
      if (result.ok) onJoined(result.playerId);
      else setError(result.reason);
    });
  }

  function handleStart() {
    socket.emit("startGame", (result: StartGameResult) => {
      if (!result.ok) setError(result.reason);
    });
  }

  if (!me) {
    if (lobby?.started) {
      return (
        <main className="lobby">
          <div className="lobby__card">
            <p className="lobby__eyebrow">Imperial Catan</p>
            <h1 className="lobby__title">This game has already started</h1>
            <p>Ask the host for a new link once their session ends.</p>
          </div>
        </main>
      );
    }

    if (lobby && lobby.players.length >= REQUIRED_PLAYER_COUNT) {
      return (
        <main className="lobby">
          <div className="lobby__card">
            <p className="lobby__eyebrow">Imperial Catan</p>
            <h1 className="lobby__title">The table is full</h1>
            <p>Four players have already joined this session.</p>
          </div>
        </main>
      );
    }

    const joinDisabled = joining || !name.trim() || !color || (lobby !== null && color !== null && !canJoinLobby(lobby, color));

    return (
      <main className="lobby">
        <div className="lobby__card">
          <p className="lobby__eyebrow">Imperial Catan</p>
          <h1 className="lobby__title">Join the table</h1>
          <form className="lobby__form" onSubmit={handleJoin}>
            <label className="lobby__field">
              <span>Your name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} maxLength={20} placeholder="Admiral of the Fleet" required />
            </label>
            <fieldset className="lobby__colors">
              <legend>Choose a color</legend>
              <div className="lobby__swatches">
                {PLAYER_COLORS.map((swatchColor) => {
                  const taken = players.some((player) => player.color === swatchColor);
                  return (
                    <button
                      key={swatchColor}
                      type="button"
                      className={`lobby__swatch${color === swatchColor ? " lobby__swatch--selected" : ""}`}
                      style={{ background: COLOR_SWATCH[swatchColor] }}
                      disabled={taken}
                      aria-pressed={color === swatchColor}
                      aria-label={taken ? `${swatchColor} (taken)` : swatchColor}
                      onClick={() => setColor(swatchColor)}
                    />
                  );
                })}
              </div>
            </fieldset>
            <button type="submit" className="lobby__submit" disabled={joinDisabled}>
              {joining ? "Joining…" : "Join"}
            </button>
            {error && <p className="lobby__error">{error}</p>}
          </form>
        </div>
      </main>
    );
  }

  const missing = REQUIRED_PLAYER_COUNT - players.length;
  const canStart = lobby !== null && canStartGame(lobby, me.id);

  return (
    <main className="lobby">
      <div className="lobby__card">
        <p className="lobby__eyebrow">Imperial Catan — Lobby</p>
        <h1 className="lobby__title">Waiting for the table to fill</h1>
        <ul className="lobby__roster">
          {players.map((player) => (
            <li key={player.id} className="lobby__roster-row">
              <span className="lobby__swatch-dot" style={{ background: COLOR_SWATCH[player.color] }} />
              <span className="lobby__roster-name">
                {player.name}
                {player.id === me.id ? " (you)" : ""}
              </span>
              {player.isHost && <span className="lobby__host-badge">Host</span>}
            </li>
          ))}
          {Array.from({ length: Math.max(missing, 0) }).map((_, i) => (
            <li key={`empty-${i}`} className="lobby__roster-row lobby__roster-row--empty">
              Waiting for a player…
            </li>
          ))}
        </ul>
        {me.isHost ? (
          <button className="lobby__submit" onClick={handleStart} disabled={!canStart}>
            {canStart ? "Start the game" : `Waiting for ${missing} more player${missing === 1 ? "" : "s"}`}
          </button>
        ) : (
          <p className="lobby__waiting">Waiting for the host to start…</p>
        )}
        {error && <p className="lobby__error">{error}</p>}
      </div>
    </main>
  );
}
