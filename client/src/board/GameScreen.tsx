import type { Action, GameState, HexId, SubmitActionResult } from "@monorepo/shared";
import {
  canPlaceStartingSettlementAndPort,
  canPlaceStartingSoldier,
  hexId as computeHexId,
  isOccupiedBy,
  isTerritoryHex,
} from "@monorepo/shared";
import { useEffect, useMemo, useState } from "react";
import type { GameSocket } from "../socket.js";
import { ActionPanel } from "./ActionPanel.js";
import "./board.css";
import { HexBoard } from "./HexBoard.js";
import { PhaseIndicator } from "./PhaseIndicator.js";
import { ResourcePanel } from "./ResourcePanel.js";
import { TurnTimer } from "./TurnTimer.js";

interface GameScreenProps {
  game: GameState;
  myPlayerId: string | null;
  socket: GameSocket;
}

/** Every territory hex `playerId` is currently allowed to click, for whatever interaction `game`'s stage/phase puts them in. */
function computeSelectableHexIds(game: GameState, playerId: string | null): ReadonlySet<HexId> {
  const ids = new Set<HexId>();
  if (!playerId) return ids;

  if (game.stage === "setup" && game.setup?.activePlayerId === playerId) {
    for (const hex of game.board.hexes) {
      if (!isTerritoryHex(hex)) continue;
      const id = computeHexId(hex);
      const legal =
        game.setup.step === "soldiers" ? canPlaceStartingSoldier(game, playerId, id) : canPlaceStartingSettlementAndPort(game, playerId, id);
      if (legal) ids.add(id);
    }
    return ids;
  }

  if (game.stage === "playing" && game.phase === "action" && game.currentPlayerId === playerId) {
    for (const hex of game.board.hexes) {
      if (!isTerritoryHex(hex)) continue;
      const id = computeHexId(hex);
      if (isOccupiedBy(game, playerId, id)) ids.add(id);
    }
  }

  return ids;
}

export function GameScreen({ game, myPlayerId, socket }: GameScreenProps) {
  const [selectedHexId, setSelectedHexId] = useState<HexId | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A hex selection (or a stale error) shouldn't survive into a new
  // turn/phase - both mean whatever was being decided has already moved on.
  useEffect(() => {
    setSelectedHexId(null);
    setError(null);
  }, [game.currentPlayerId, game.phase, game.stage]);

  function submit(action: Action) {
    setError(null);
    socket.emit("submitAction", action, (result: SubmitActionResult) => {
      if (!result.ok) setError(result.reason);
    });
  }

  function handleHexClick(hexId: HexId) {
    if (!myPlayerId) return;

    if (game.stage === "setup" && game.setup) {
      submit(
        game.setup.step === "soldiers"
          ? { type: "PlaceStartingSoldier", playerId: myPlayerId, hexId }
          : { type: "PlaceStartingSettlementAndPort", playerId: myPlayerId, hexId },
      );
      return;
    }

    setSelectedHexId(hexId);
  }

  const me = myPlayerId ? (game.players.find((player) => player.id === myPlayerId) ?? null) : null;
  const selectableHexIds = useMemo(() => computeSelectableHexIds(game, myPlayerId), [game, myPlayerId]);

  return (
    <div className="game-screen">
      <aside className="game-screen__sidebar">
        <PhaseIndicator game={game} myPlayerId={myPlayerId} />
        {game.stage === "playing" && <TurnTimer turnStartedAt={game.turnStartedAt} turnTimeLimitMs={game.turnTimeLimitMs} />}
        {me && <ResourcePanel resources={me.resources} />}
        <ActionPanel
          game={game}
          myPlayerId={myPlayerId}
          selectedHexId={selectedHexId}
          onClearSelection={() => setSelectedHexId(null)}
          submit={submit}
          error={error}
        />
      </aside>
      <div className="game-screen__board-area">
        <HexBoard game={game} selectableHexIds={selectableHexIds} selectedHexId={selectedHexId} onHexClick={handleHexClick} />
      </div>
    </div>
  );
}
