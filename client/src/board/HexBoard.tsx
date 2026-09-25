import type { GameState, HexId } from "@monorepo/shared";
import { hexId as computeHexId, isTerritoryHex } from "@monorepo/shared";
import { Application, Graphics, Text } from "pixi.js";
import { useEffect, useRef, useState } from "react";
import { colorOfPlayer, PLAYER_COLOR_HEX } from "../playerColors.js";
import {
  NUMBER_LABEL_COLOR,
  resourceColor,
  TERRITORY_LINE_COLOR,
  WATER_COLOR,
  WATER_LINE_COLOR,
} from "./boardColors.js";
import {
  axialToPixel,
  boardBounds,
  hexCorners,
  HEX_SIZE,
} from "./hexLayout.js";
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
 * Owns a PixiJS Application imperatively inside a useEffect.
 *
 * The Application itself is created once for the current board.
 * Game-state changes redraw the contents of the existing Pixi stage.
 */
export function HexBoard({
  game,
  selectableHexIds,
  selectedHexId,
  onHexClick,
}: HexBoardProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [app, setApp] = useState<Application | null>(null);

  const board = game.board;

  /*
   * Create and destroy the PixiJS Application.
   *
   * This effect is intentionally dependent only on `board`.
   * The board geometry does not change during normal gameplay.
   */
  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const application = new Application();
    const bounds = boardBounds(board.hexes, HEX_SIZE);

    let cancelled = false;

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
        /*
         * React Strict Mode can cause the effect to be cleaned up
         * before Pixi's asynchronous initialization finishes.
         *
         * In that case, do not attach the destroyed application.
         */
        if (cancelled) {
          application.destroy(true, {
            children: true,
          });
          return;
        }

        container.appendChild(application.canvas);

        application.stage.x = -bounds.minX;
        application.stage.y = -bounds.minY;
        application.stage.eventMode = "static";

        setApp(application);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Failed to initialize Pixi application:", error);
        }
      });

    /*
     * Cleanup.
     */
    return () => {
      cancelled = true;

      /*
       * Remove the application from React state if this is
       * the currently active application.
       */
      setApp((current) => {
        if (current === application) {
          return null;
        }

        return current;
      });

      /*
       * Remove the canvas from the DOM before destroying Pixi.
       */
      if (application.canvas.parentElement === container) {
        container.removeChild(application.canvas);
      }

      /*
       * Destroy the Pixi application and all of its children.
       */
      application.destroy(true, {
        children: true,
      });
    };
  }, [board]);

  /*
   * Redraw the board whenever the game state or selection state changes.
   */
  useEffect(() => {
    /*
     * The Application may not have finished initializing yet.
     */
    if (!app) {
      return;
    }

    /*
     * The application can be destroyed during React cleanup.
     * Never attempt to draw into a destroyed stage.
     */
    if (!app.stage) {
      return;
    }

    const stage = app.stage;

    /*
     * Remove all objects from the previous render and destroy them.
     *
     * This is important because the game state changes frequently.
     * Without destroying the old Graphics/Text objects, they can
     * accumulate in memory.
     */
    const oldChildren = stage.removeChildren();

    for (const child of oldChildren) {
      child.destroy();
    }

    /*
     * Draw every hex.
     */
    for (const hex of board.hexes) {
      const id = computeHexId(hex);

      const center = axialToPixel(hex, HEX_SIZE);

      const points = hexCorners(center, HEX_SIZE).flatMap((corner) => [
        corner.x,
        corner.y,
      ]);

      const territory = isTerritoryHex(hex);

      const selectable = selectableHexIds?.has(id) ?? false;

      const selected = selectedHexId === id;

      /*
       * Draw the hex itself.
       */
      const tile = new Graphics();

      tile
        .poly(points)
        .fill(
          territory
            ? resourceColor(hex.resource)
            : WATER_COLOR
        )
        .stroke({
          width: selected
            ? 4
            : selectable
              ? 3
              : 1.5,

          color: selected
            ? SELECTED_STROKE
            : selectable
              ? SELECTABLE_STROKE
              : territory
                ? TERRITORY_LINE_COLOR
                : WATER_LINE_COLOR,

          alpha:
            selected || selectable
              ? 1
              : territory
                ? 0.6
                : 0.35,
        });

      /*
       * Make selectable hexes clickable.
       */
      if (selectable && onHexClick) {
        tile.eventMode = "static";
        tile.cursor = "pointer";

        tile.on("pointertap", () => {
          onHexClick(id);
        });
      }

      stage.addChild(tile);

      /*
       * Draw the number on territory hexes.
       */
      if (territory) {
        const label = new Text({
          text: String(hex.number),

          style: {
            fill: NUMBER_LABEL_COLOR,
            fontFamily: "Inter, sans-serif",
            fontSize: 16,
            fontWeight: "700",
          },
        });

        label.anchor.set(0.5);

        label.x = center.x;
        label.y = center.y - 12;

        label.eventMode = "none";

        stage.addChild(label);
      }

      /*
       * Get the current game state for this hex.
       */
      const hexState = game.hexes[id];

      if (!hexState) {
        continue;
      }

      /*
       * Draw units.
       */
      for (const unit of hexState.units) {
        const color =
          PLAYER_COLOR_HEX[
            colorOfPlayer(game, unit.ownerId)
          ];

        const marker = new Graphics();

        marker
          .circle(
            center.x - 9,
            center.y + 11,
            6
          )
          .fill(color)
          .stroke({
            width: 1.5,
            color: UNIT_OUTLINE,
          });

        marker.eventMode = "none";

        stage.addChild(marker);
      }

      /*
       * Draw buildings.
       */
      for (const building of hexState.buildings) {
        const color =
          PLAYER_COLOR_HEX[
            colorOfPlayer(game, building.ownerId)
          ];

        const marker = new Graphics();

        if (building.type === "Settlement") {
          marker
            .rect(
              center.x - 5,
              center.y - 5,
              10,
              10
            )
            .fill(color)
            .stroke({
              width: 1.5,
              color: UNIT_OUTLINE,
            });
        } else if (building.type === "City") {
          marker
            .rect(
              center.x - 7,
              center.y - 7,
              14,
              14
            )
            .fill(color)
            .stroke({
              width: 2,
              color: "#f2c14e",
            });
        } else {
          marker
            .circle(
              center.x + 10,
              center.y - 11,
              5
            )
            .stroke({
              width: 2,
              color,
            });
        }

        marker.eventMode = "none";

        stage.addChild(marker);
      }
    }
  }, [
    app,
    game,
    board,
    selectableHexIds,
    selectedHexId,
    onHexClick,
  ]);

  return (
    <div
      className="hex-board"
      ref={containerRef}
    />
  );
}