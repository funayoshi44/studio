
"use client";

import Link from 'next/link';
import { useAuth } from "@/contexts/auth-context";
import { useTranslation } from "@/hooks/use-translation";
import { Button } from "@/components/ui/button";
import { VictoryAnimation } from "@/components/victory-animation";

type ResultScreenProps = {
  gameType: string;
  winner?: string | 'draw' | null;
  players: { [uid: string]: { displayName?: string } };
};

export function OnlineGameResultScreen({ gameType, winner, players }: ResultScreenProps) {
  const { user } = useAuth();
  const { t } = useTranslation();

  const isWinner = winner && user && (Array.isArray(winner) ? winner.includes(user.uid) : winner === user.uid);

  return (
    <div className="my-8 text-center">
      {isWinner && <VictoryAnimation />}
      <p className="text-4xl font-bold mb-4">
        {winner === "draw"
          ? t("duelFinalResultDraw")
          : winner
          ? `${players[winner as string]?.displayName ?? "Player"} ${t(
              "winsTheGame"
            )}!`
          : "Game Over"}
      </p>
      <div className="space-x-4 mt-6">
        <Link href="/online" passHref>
          <Button size="lg">{t("backToMenu")}</Button>
        </Link>
      </div>
    </div>
  );
}
