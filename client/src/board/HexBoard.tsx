import type { Board } from "@monorepo/shared";
import { isTerritoryHex } from "@monorepo/shared";
import { Application, Graphics, Text } from "pixi.js";
import { useEffect, useRef } from "react";
import { NUMBER_LABEL_COLOR, resourceColor, TERRITORY_LINE_COLOR, WATER_COLOR, WATER_LINE_COLOR } from "./boardColors.js";
import { axialToPixel, boardBounds, hexCorners, HEX_SIZE } from "./hexLayout.js";
import "./board.css";

interface HexBoardProps {
  board: Board;
}

/**
 * Owns a PixiJS `Application` imperatively inside a `useEffect`, rather than
 * going through `@pixi/react`: one canvas, no reconciler needed, and one
 * fewer dependency whose major-version compatibility with Pixi v8 and React
 * 19 would otherwise need tracking.
 */
export function HexBoard({ board }: HexBoardProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const app = new Application();
    const bounds = boardBounds(board.hexes, HEX_SIZE);
    // Guards the race between this async init and the effect cleanup below
    // (which Strict Mode's mount/cleanup/mount replay makes a real case,
    // not just a theoretical one): if cleanup fires first, `ready` never
    // gets set, and the `.then()` callback destroys the never-appended app
    // instead of drawing into a container that's already gone.
    let cleanedUp = false;
    let ready = false;

    void app
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
          app.destroy(true, { children: true });
          return;
        }

        container.appendChild(app.canvas);
        app.stage.x = -bounds.minX;
        app.stage.y = -bounds.minY;

        for (const hex of board.hexes) {
          const center = axialToPixel(hex, HEX_SIZE);
          const points = hexCorners(center, HEX_SIZE).flatMap((corner) => [corner.x, corner.y]);
          const territory = isTerritoryHex(hex);

          const tile = new Graphics();
          tile
            .poly(points)
            .fill(territory ? resourceColor(hex.resource) : WATER_COLOR)
            .stroke({ width: 1.5, color: territory ? TERRITORY_LINE_COLOR : WATER_LINE_COLOR, alpha: territory ? 0.6 : 0.35 });
          app.stage.addChild(tile);

          if (territory) {
            const label = new Text({
              text: String(hex.number),
              style: { fill: NUMBER_LABEL_COLOR, fontFamily: "Inter, sans-serif", fontSize: 16, fontWeight: "700" },
            });
            label.anchor.set(0.5);
            label.x = center.x;
            label.y = center.y;
            app.stage.addChild(label);
          }
        }

        ready = true;
      });

    return () => {
      cleanedUp = true;
      if (ready) {
        if (app.canvas.parentElement === container) container.removeChild(app.canvas);
        app.destroy(true, { children: true });
      }
      // If not `ready` yet, the `.then()` callback above sees `cleanedUp`
      // and destroys the (never-appended) app itself once init resolves.
    };
  }, [board]);

  return <div className="hex-board" ref={containerRef} />;
}
