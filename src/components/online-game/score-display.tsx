
"use client";

import { Card } from "@/components/ui/card";
import { useTranslation } from "@/hooks/use-translation";

type ScoreDisplayProps = {
  players: { [uid: string]: { displayName?: string } };
  playerIds: string[];
  scores: { [uid: string]: number };
  details?: { [key: string]: { [uid: string]: number } };
  detailLabels?: { [key: string]: string };
};

export function OnlineGameScoreDisplay({
  players,
  playerIds,
  scores,
  details = {},
  detailLabels = {},
}: ScoreDisplayProps) {
  const { t } = useTranslation();

  if (!playerIds[0] || !playerIds[1] || !scores) {
    return null;
  }
  const p1Id = playerIds[0];
  const p2Id = playerIds[1];
  if (!players?.[p1Id] || !players?.[p2Id]) return null;

  const playerColors = {
    [p1Id]: "bg-blue-100 dark:bg-blue-900/50",
    [p2Id]: "bg-red-100 dark:bg-red-900/50",
  };

  return (
    <div className="flex flex-col md:flex-row justify-center gap-2 md:gap-8 text-base mb-4">
      {playerIds.map((pid) => (
        <Card key={pid} className={`p-3 md:p-4 ${playerColors[pid]}`}>
          <p className="font-bold">
            {players[pid].displayName}: {scores?.[pid] ?? 0} {t("wins")}
          </p>
          {Object.keys(details).length > 0 && (
            <div className="text-sm opacity-80">
              {Object.entries(details).map(([key, values], index) => (
                <span key={key}>
                  {detailLabels[key]}: {values?.[pid] ?? 0}
                  {index < Object.keys(details).length - 1 && " | "}
                </span>
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
