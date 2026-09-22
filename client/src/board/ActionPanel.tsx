import type { Action, GameState, HexId, PlayerId, Resource, ResourceHand } from "@monorepo/shared";
import {
  BUILDING_COSTS,
  canAcceptTrade,
  canAdvancePhase,
  canBuildCity,
  canBuildPort,
  canBuildSettlement,
  canProposeTrade,
  canRollDice,
  canTradeWithPort,
  canTradeWithSupply,
  getHexByHexId,
  isTerritoryHex,
} from "@monorepo/shared";
import { useState } from "react";
import { RESOURCE_ORDER } from "./ResourcePanel.js";
import "./game-ui.css";

function costLabel(cost: Partial<Record<Resource, number>>): string {
  return Object.entries(cost)
    .map(([resource, amount]) => `${amount} ${resource}`)
    .join(", ");
}

function ResourceSelect({ value, onChange }: { value: Resource; onChange: (resource: Resource) => void }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value as Resource)}>
      {RESOURCE_ORDER.map((resource) => (
        <option key={resource} value={resource}>
          {resource}
        </option>
      ))}
    </select>
  );
}

interface SubmitProps {
  submit: (action: Action) => void;
}

function RollDiceSection({ game, myPlayerId, submit }: { game: GameState; myPlayerId: PlayerId } & SubmitProps) {
  const canRoll = canRollDice(game, myPlayerId);
  return (
    <div className="action-section">
      <button className="action-button action-button--primary" disabled={!canRoll} onClick={() => submit({ type: "RollDice", playerId: myPlayerId })}>
        Roll Dice
      </button>
    </div>
  );
}

function BuildSection({
  game,
  myPlayerId,
  selectedHexId,
  onClearSelection,
  submit,
}: { game: GameState; myPlayerId: PlayerId; selectedHexId: HexId | null; onClearSelection: () => void } & SubmitProps) {
  if (!selectedHexId) {
    return (
      <div className="action-section">
        <h3 className="action-section__title">Build</h3>
        <p className="action-panel__hint">Click a hex you occupy to build there.</p>
      </div>
    );
  }

  const hex = getHexByHexId(game.board, selectedHexId);
  const hexLabel = hex && isTerritoryHex(hex) ? `${hex.resource} (${hex.number})` : selectedHexId;

  return (
    <div className="action-section">
      <div className="action-section__header">
        <h3 className="action-section__title">Build — {hexLabel}</h3>
        <button className="action-link" onClick={onClearSelection}>
          Clear
        </button>
      </div>
      <div className="build-buttons">
        <button
          className="action-button"
          disabled={!canBuildSettlement(game, myPlayerId, selectedHexId)}
          onClick={() => submit({ type: "BuildSettlement", playerId: myPlayerId, hexId: selectedHexId })}
        >
          Settlement<small>{costLabel(BUILDING_COSTS.Settlement)}</small>
        </button>
        <button
          className="action-button"
          disabled={!canBuildCity(game, myPlayerId, selectedHexId)}
          onClick={() => submit({ type: "BuildCity", playerId: myPlayerId, hexId: selectedHexId })}
        >
          City<small>{costLabel(BUILDING_COSTS.City)}</small>
        </button>
        <button
          className="action-button"
          disabled={!canBuildPort(game, myPlayerId, selectedHexId)}
          onClick={() => submit({ type: "BuildPort", playerId: myPlayerId, hexId: selectedHexId })}
        >
          Port<small>{costLabel(BUILDING_COSTS.Port)}</small>
        </button>
      </div>
    </div>
  );
}

function TradeSection({ game, myPlayerId, submit }: { game: GameState; myPlayerId: PlayerId } & SubmitProps) {
  const [bankGive, setBankGive] = useState<Resource>("Wood");
  const [bankWant, setBankWant] = useState<Resource>("Brick");
  const canBank = canTradeWithSupply(game, myPlayerId, bankGive, bankWant);

  const myAvailablePorts = Object.values(game.hexes)
    .flatMap((hexState) => hexState.buildings.filter((building) => building.type === "Port" && building.ownerId === myPlayerId))
    .map((building) => building.hexId)
    .filter((hexId) => !game.portsUsedThisTurn.includes(hexId));
  const [portHexId, setPortHexId] = useState<HexId | null>(null);
  const activePort = (portHexId && myAvailablePorts.includes(portHexId) ? portHexId : myAvailablePorts[0]) ?? null;
  const [portGive, setPortGive] = useState<Resource>("Wood");
  const [portWant, setPortWant] = useState<Resource>("Brick");
  const canPort = activePort !== null && canTradeWithPort(game, myPlayerId, activePort, portGive, portWant);

  const [proposeGive, setProposeGive] = useState<Resource>("Wood");
  const [proposeGiveQty, setProposeGiveQty] = useState(1);
  const [proposeWant, setProposeWant] = useState<Resource>("Brick");
  const [proposeWantQty, setProposeWantQty] = useState(1);
  const proposeOffer = {
    give: { [proposeGive]: proposeGiveQty } as Partial<ResourceHand>,
    want: { [proposeWant]: proposeWantQty } as Partial<ResourceHand>,
  };
  const canPropose = canProposeTrade(game, myPlayerId, proposeOffer);

  return (
    <div className="action-section">
      <h3 className="action-section__title">Trade</h3>

      <div className="trade-row">
        <span className="trade-row__label">Bank (4:1)</span>
        <ResourceSelect value={bankGive} onChange={setBankGive} />
        <span>for</span>
        <ResourceSelect value={bankWant} onChange={setBankWant} />
        <button
          className="action-button"
          disabled={!canBank}
          onClick={() => submit({ type: "TradeWithSupply", playerId: myPlayerId, give: bankGive, want: bankWant })}
        >
          Trade
        </button>
      </div>

      {activePort && (
        <div className="trade-row">
          <span className="trade-row__label">Port (3:1)</span>
          {myAvailablePorts.length > 1 && (
            <select value={activePort} onChange={(event) => setPortHexId(event.target.value)}>
              {myAvailablePorts.map((hexId) => (
                <option key={hexId} value={hexId}>
                  {hexId}
                </option>
              ))}
            </select>
          )}
          <ResourceSelect value={portGive} onChange={setPortGive} />
          <span>for</span>
          <ResourceSelect value={portWant} onChange={setPortWant} />
          <button
            className="action-button"
            disabled={!canPort}
            onClick={() => submit({ type: "TradeWithPort", playerId: myPlayerId, portHexId: activePort, give: portGive, want: portWant })}
          >
            Trade
          </button>
        </div>
      )}

      <div className="trade-row">
        <span className="trade-row__label">Offer table</span>
        <input
          className="trade-row__qty"
          type="number"
          min={1}
          max={10}
          value={proposeGiveQty}
          onChange={(event) => setProposeGiveQty(Math.max(1, Number(event.target.value)))}
        />
        <ResourceSelect value={proposeGive} onChange={setProposeGive} />
        <span>for</span>
        <input
          className="trade-row__qty"
          type="number"
          min={1}
          max={10}
          value={proposeWantQty}
          onChange={(event) => setProposeWantQty(Math.max(1, Number(event.target.value)))}
        />
        <ResourceSelect value={proposeWant} onChange={setProposeWant} />
        <button
          className="action-button"
          disabled={!canPropose}
          onClick={() => submit({ type: "ProposeTrade", playerId: myPlayerId, offer: proposeOffer })}
        >
          Propose
        </button>
      </div>
    </div>
  );
}

function PendingTradeSection({ game, myPlayerId, submit }: { game: GameState; myPlayerId: PlayerId } & SubmitProps) {
  const trade = game.pendingTrade;
  if (!trade) return null;

  const offer = trade.offers[trade.offers.length - 1];
  const proposerName = game.players.find((player) => player.id === trade.proposerId)?.name ?? "Someone";
  const isProposer = trade.proposerId === myPlayerId;
  const canAccept = !isProposer && canAcceptTrade(game, myPlayerId, trade);

  return (
    <div className="action-section action-section--pending-trade">
      <p className="action-panel__hint">
        <strong>{proposerName}</strong> offers {costLabel(offer.give)} for {costLabel(offer.want)}
      </p>
      {isProposer ? (
        <button className="action-button" onClick={() => submit({ type: "CancelTrade", playerId: myPlayerId, tradeId: trade.id })}>
          Cancel offer
        </button>
      ) : (
        <button
          className="action-button action-button--primary"
          disabled={!canAccept}
          onClick={() => submit({ type: "AcceptTrade", playerId: myPlayerId, tradeId: trade.id })}
        >
          Accept
        </button>
      )}
    </div>
  );
}

function EndPhaseSection({ game, myPlayerId, submit }: { game: GameState; myPlayerId: PlayerId } & SubmitProps) {
  const canAdvance = canAdvancePhase(game, myPlayerId);
  return (
    <div className="action-section">
      <button className="action-button action-button--primary" disabled={!canAdvance} onClick={() => submit({ type: "AdvancePhase", playerId: myPlayerId })}>
        {game.phase === "action" ? "End Action Phase" : "End Turn"}
      </button>
      {game.phase === "movement" && (
        <p className="action-panel__hint action-panel__hint--muted">
          Military movement and combat aren't built yet (Milestone 2) — ending your turn hands play to the next player.
        </p>
      )}
    </div>
  );
}

interface ActionPanelProps {
  game: GameState;
  myPlayerId: PlayerId | null;
  selectedHexId: HexId | null;
  onClearSelection: () => void;
  submit: (action: Action) => void;
  error: string | null;
}

export function ActionPanel({ game, myPlayerId, selectedHexId, onClearSelection, submit, error }: ActionPanelProps) {
  if (game.stage === "ended") return null;

  if (!myPlayerId) {
    return (
      <div className="action-panel">
        <p className="action-panel__hint">You're spectating this session.</p>
      </div>
    );
  }

  if (game.stage === "setup") {
    const isMyTurn = game.setup?.activePlayerId === myPlayerId;
    return (
      <div className="action-panel">
        <p className="action-panel__hint">
          {isMyTurn
            ? game.setup?.step === "soldiers"
              ? "Click an empty hex to place a soldier."
              : "Click a hex you've claimed with a soldier to place your settlement and port."
            : "Waiting for your turn to place…"}
        </p>
        {error && <p className="action-panel__error">{error}</p>}
      </div>
    );
  }

  const isMyTurn = game.currentPlayerId === myPlayerId;

  return (
    <div className="action-panel">
      {game.phase === "production" && (isMyTurn ? (
        <RollDiceSection game={game} myPlayerId={myPlayerId} submit={submit} />
      ) : (
        <p className="action-panel__hint">Waiting for the dice roll…</p>
      ))}

      {game.phase === "action" && isMyTurn && (
        <>
          <BuildSection game={game} myPlayerId={myPlayerId} selectedHexId={selectedHexId} onClearSelection={onClearSelection} submit={submit} />
          <TradeSection game={game} myPlayerId={myPlayerId} submit={submit} />
        </>
      )}

      <PendingTradeSection game={game} myPlayerId={myPlayerId} submit={submit} />

      {(game.phase === "action" || game.phase === "movement") && isMyTurn && (
        <EndPhaseSection game={game} myPlayerId={myPlayerId} submit={submit} />
      )}

      {!isMyTurn && game.phase === "movement" && <p className="action-panel__hint">Waiting for the current player to end their turn…</p>}

      {error && <p className="action-panel__error">{error}</p>}
    </div>
  );
}
