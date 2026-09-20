import type { GameState } from "@monorepo/shared";
import type { GameSocket } from "../socket.js";
import { HexBoard } from "./HexBoard.js";
import "./board.css";

interface GameScreenProps {
  game: GameState;
  /** Not used yet - reserved for the next step, which wires build/trade/roll actions through this socket. */
  myPlayerId: string | null;
  socket: GameSocket;
}

export function GameScreen({ game }: GameScreenProps) {
  return (
    <div className="game-screen">
      <div className="game-screen__board-area">
        <HexBoard board={game.board} />
      </div>
    </div>
  );
}
