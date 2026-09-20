import type { Resource } from "@monorepo/shared";

/**
 * Matches Catan_rules.docx's own color coding ("Four types of cards and
 * their color": Wood/Green, Brick/Red, Wheat/Yellow, Stone/Grey) - kept in
 * sync with the CSS custom properties in `../styles/tokens.css`, since
 * PixiJS draws to a canvas and can't read CSS variables itself.
 */
const RESOURCE_COLORS: Record<Resource, string> = {
  Wood: "#4b7b4b",
  Brick: "#a6432e",
  Wheat: "#d6a929",
  Stone: "#8b8b85",
};

export function resourceColor(resource: Resource): string {
  return RESOURCE_COLORS[resource];
}

export const WATER_COLOR = "#2f5670";
export const WATER_LINE_COLOR = "#1c3140";
export const TERRITORY_LINE_COLOR = "#1b2a3a";
export const NUMBER_LABEL_COLOR = "#1b2a3a";
