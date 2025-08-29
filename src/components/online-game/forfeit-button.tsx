
"use client";

import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/hooks/use-translation";
import { GameType } from "@/lib/types";
import { leaveRTDBGame } from "@/lib/rtdb";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Flag } from "lucide-react";

type ForfeitButtonProps = {
  gameType: GameType;
  gameId: string;
};

export function OnlineGameForfeitButton({ gameType, gameId }: ForfeitButtonProps) {
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();

  const handleForfeit = async () => {
    if (user && gameId) {
      await leaveRTDBGame(gameType, gameId, user.uid);
      router.push("/online");
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Flag className="mr-2 h-4 w-4" />
          {t("forfeit")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("forfeitConfirmationTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("forfeitConfirmationBody")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={handleForfeit}>{t("forfeit")}</AlertDialogAction>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
