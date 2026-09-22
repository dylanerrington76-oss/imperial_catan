import type { GameState, PlayerId, SetupStep, TurnPhase } from "@monorepo/shared";
import { WINNING_VICTORY_POINTS } from "@monorepo/shared";
import { PLAYER_COLOR_HEX } from "../playerColors.js";
import "./game-ui.css";

const SETUP_STEP_LABEL: Record<SetupStep, string> = {
  soldiers: "Placing starting soldiers",
  "settlements-and-ports": "Placing starting settlement & port",
  "starting-resources": "Collecting starting resources",
};

const PHASE_LABEL: Record<TurnPhase, string> = {
  production: "Production phase",
  action: "Action phase",
  movement: "Movement phase",
};

function nameFor(game: GameState, playerId: PlayerId): string {
  return game.players.find((player) => player.id === playerId)?.name ?? "Someone";
}

interface PhaseIndicatorProps {
  game: GameState;
  myPlayerId: string | null;
}

export function PhaseIndicator({ game, myPlayerId }: PhaseIndicatorProps) {
  const activePlayerId = game.stage === "setup" ? game.setup?.activePlayerId : game.currentPlayerId;
  const isMyTurn = activePlayerId !== undefined && activePlayerId === myPlayerId;

  let statusLine: string;
  if (game.stage === "ended") {
    const winner = game.players.find((player) => player.id === game.winnerId);
    statusLine = winner ? `🏆 ${winner.name} wins with ${winner.victoryPoints} VP!` : "Game over.";
  } else if (game.stage === "setup" && game.setup) {
    const whose = isMyTurn ? "your turn" : `${nameFor(game, game.setup.activePlayerId)}'s turn`;
    statusLine = `${SETUP_STEP_LABEL[game.setup.step]} — ${whose}`;
  } else {
    const whose = isMyTurn ? "your turn" : `${nameFor(game, game.currentPlayerId)}'s turn`;
    statusLine = `Turn ${game.turnNumber} — ${PHASE_LABEL[game.phase]} — ${whose}`;
  }

  return (
    <div className="phase-indicator">
      <p className="phase-indicator__status">{statusLine}</p>
      {game.diceRoll && (
        <p className="phase-indicator__dice">
          Rolled {game.diceRoll[0]} + {game.diceRoll[1]} = {game.diceRoll[0] + game.diceRoll[1]}
        </p>
      )}
      <ul className="phase-indicator__roster">
        {game.players.map((player) => (
          <li
            key={player.id}
            className={`phase-indicator__player${player.id === activePlayerId ? " phase-indicator__player--active" : ""}`}
          >
            <span className="phase-indicator__dot" style={{ background: PLAYER_COLOR_HEX[player.color] }} />
            <span className="phase-indicator__name">
              {player.name}
              {player.id === myPlayerId ? " (you)" : ""}
            </span>
            <span className="phase-indicator__vp">
              {player.victoryPoints}/{WINNING_VICTORY_POINTS} VP
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
