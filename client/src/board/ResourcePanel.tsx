import type { Resource, ResourceHand } from "@monorepo/shared";
import "./game-ui.css";

export const RESOURCE_ORDER: readonly Resource[] = ["Wood", "Brick", "Wheat", "Stone"];

interface ResourcePanelProps {
  resources: ResourceHand;
}

/** Rulebook COMPONENTS: "Four types of cards and their color" - your hand of each. */
export function ResourcePanel({ resources }: ResourcePanelProps) {
  return (
    <div className="resource-panel">
      {RESOURCE_ORDER.map((resource) => (
        <div key={resource} className={`resource-chip resource-chip--${resource.toLowerCase()}`}>
          <span className="resource-chip__label">{resource}</span>
          <span className="resource-chip__count">{resources[resource]}</span>
        </div>
      ))}
    </div>
  );
}
