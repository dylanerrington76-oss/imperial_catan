import type { GameState, HexId } from "@monorepo/shared";
import { hexId as computeHexId, isTerritoryHex } from "@monorepo/shared";
import { Application, Graphics, Text } from "pixi.js";
import { useEffect, useRef, useState } from "react";
import { colorOfPlayer, PLAYER_COLOR_HEX } from "../playerColors.js";
import { NUMBER_LABEL_COLOR, resourceColor, TERRITORY_LINE_COLOR, WATER_COLOR, WATER_LINE_COLOR } from "./boardColors.js";
import { axialToPixel, boardBounds, hexCorners, HEX_SIZE } from "./hexLayout.js";
import "./board.css";

const SELECTABLE_STROKE = "#f2c14e";
const SELECTED_STROKE = "#ffffff";
const UNIT_OUTLINE = "#1b2a3a";

interface HexBoardProps {
  game: GameState;
  /** Hexes the current interaction (setup placement or build target) allows clicking. */
  selectableHexIds?: ReadonlySet<HexId>;
  /** The hex currently chosen for the build panel, if any - drawn with a brighter outline. */
  selectedHexId?: HexId | null;
  onHexClick?: (hexId: HexId) => void;
}

/**
 * Owns a PixiJS `Application` imperatively inside a `useEffect`, rather than
 * going through `@pixi/react`: one canvas, no reconciler needed, and one
 * fewer dependency whose major-version compatibility with Pixi v8 and React
 * 19 would otherwise need tracking.
 *
 * Split into two effects: the `Application` itself is expensive to create
 * (async init, a real `<canvas>`) and only needs to exist once per board,
 * since `board` is immutable seeded geometry that never changes mid-game
 * (see `../../../packages/shared/src/hex/types.ts`). Everything that *does*
 * change turn to turn - units, buildings, which hexes are selectable - is
 * redrawn by the second effect against the same long-lived `app`.
 */
export function HexBoard({ game, selectableHexIds, selectedHexId, onHexClick }: HexBoardProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [app, setApp] = useState<Application | null>(null);
  const board = game.board;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const application = new Application();
    const bounds = boardBounds(board.hexes, HEX_SIZE);
    // Guards the race between this async init and the effect cleanup below
    // (which Strict Mode's mount/cleanup/mount replay makes a real case,
    // not just a theoretical one): if cleanup fires first, the app is
    // destroyed as soon as init resolves instead of being handed to a
    // container that's already gone.
    let cleanedUp = false;

    void application
      .init({
        width: bounds.width,
        height: bounds.height,
        backgroundAlpha: 0,
        antialias: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
      })
      .then(() => {
        if (cleanedUp) {
          application.destroy(true, { children: true });
          return;
        }
        container.appendChild(application.canvas);
        application.stage.x = -bounds.minX;
        application.stage.y = -bounds.minY;
        application.stage.eventMode = "static";
        setApp(application);
      });

    return () => {
      cleanedUp = true;
      setApp((current) => {
        if (current !== application) return current;
        if (application.canvas.parentElement === container) container.removeChild(application.canvas);
        application.destroy(true, { children: true });
        return null;
      });
    };
    // Intentionally keyed on `board` only - see the comment above.
  }, [board]);

  useEffect(() => {
    if (!app) return;
    app.stage.removeChildren();

    for (const hex of board.hexes) {
      const id = computeHexId(hex);
      const center = axialToPixel(hex, HEX_SIZE);
      const points = hexCorners(center, HEX_SIZE).flatMap((corner) => [corner.x, corner.y]);
      const territory = isTerritoryHex(hex);
      const selectable = selectableHexIds?.has(id) ?? false;
      const selected = selectedHexId === id;

      const tile = new Graphics();
      tile
        .poly(points)
        .fill(territory ? resourceColor(hex.resource) : WATER_COLOR)
        .stroke({
          width: selected ? 4 : selectable ? 3 : 1.5,
          color: selected ? SELECTED_STROKE : selectable ? SELECTABLE_STROKE : territory ? TERRITORY_LINE_COLOR : WATER_LINE_COLOR,
          alpha: selected || selectable ? 1 : territory ? 0.6 : 0.35,
        });

      if (selectable && onHexClick) {
        tile.eventMode = "static";
        tile.cursor = "pointer";
        tile.on("pointertap", () => onHexClick(id));
      }

      app.stage.addChild(tile);

      if (territory) {
        const label = new Text({
          text: String(hex.number),
          style: { fill: NUMBER_LABEL_COLOR, fontFamily: "Inter, sans-serif", fontSize: 16, fontWeight: "700" },
        });
        label.anchor.set(0.5);
        label.x = center.x;
        label.y = center.y - 12;
        label.eventMode = "none";
        app.stage.addChild(label);
      }

      const hexState = game.hexes[id];
      if (!hexState) continue;

      for (const unit of hexState.units) {
        const color = PLAYER_COLOR_HEX[colorOfPlayer(game, unit.ownerId)];
        const marker = new Graphics();
        marker.circle(center.x - 9, center.y + 11, 6).fill(color).stroke({ width: 1.5, color: UNIT_OUTLINE });
        marker.eventMode = "none";
        app.stage.addChild(marker);
      }

      for (const building of hexState.buildings) {
        const color = PLAYER_COLOR_HEX[colorOfPlayer(game, building.ownerId)];
        const marker = new Graphics();
        if (building.type === "Settlement") {
          marker.rect(center.x - 5, center.y - 5, 10, 10).fill(color).stroke({ width: 1.5, color: UNIT_OUTLINE });
        } else if (building.type === "City") {
          marker.rect(center.x - 7, center.y - 7, 14, 14).fill(color).stroke({ width: 2, color: "#f2c14e" });
        } else {
          marker.circle(center.x + 10, center.y - 11, 5).stroke({ width: 2, color });
        }
        marker.eventMode = "none";
        app.stage.addChild(marker);
      }
    }
  }, [app, game, board, selectableHexIds, selectedHexId, onHexClick]);

  return <div className="hex-board" ref={containerRef} />;
}
