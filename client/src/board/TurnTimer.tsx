import { useEffect, useState } from "react";
import { formatClock, remainingTurnMs } from "./turnClock.js";
import "./game-ui.css";

const LOW_TIME_THRESHOLD_MS = 20_000;

interface TurnTimerProps {
  turnStartedAt: number;
  turnTimeLimitMs: number;
}

export function TurnTimer({ turnStartedAt, turnTimeLimitMs }: TurnTimerProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const remaining = remainingTurnMs(turnStartedAt, turnTimeLimitMs, now);

  return (
    <div className={`turn-timer${remaining <= LOW_TIME_THRESHOLD_MS ? " turn-timer--low" : ""}`}>
      <span className="turn-timer__label">Turn clock</span>
      <span className="turn-timer__clock">{formatClock(remaining)}</span>
    </div>
  );
}
