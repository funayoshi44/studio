
"use client";

import { useAuth } from "@/contexts/auth-context";
import { useTranslation } from "@/hooks/use-translation";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

type PlayerInfoProps = {
  uid: string;
  players: {
    [uid: string]: {
      displayName?: string;
      photoURL?: string;
      online?: boolean;
    };
  };
};

export function OnlineGamePlayerInfo({ uid, players }: PlayerInfoProps) {
  const { user: currentUser } = useAuth();
  const { t } = useTranslation();
  const player = players?.[uid];

  if (!player) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <Avatar className="w-16 h-16">
          <AvatarImage src={player.photoURL ?? undefined} />
          <AvatarFallback className="text-2xl">
            {player.displayName?.[0]}
          </AvatarFallback>
        </Avatar>
        <span
          className={`absolute bottom-0 right-0 block h-4 w-4 rounded-full ${
            player.online ? "bg-green-500" : "bg-gray-400"
          } border-2 border-background`}
        />
      </div>
      <p className="font-bold text-lg">
        {uid === currentUser?.uid ? t("you") : player.displayName}
      </p>
    </div>
  );
}
