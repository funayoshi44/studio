
"use client";

import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/use-translation";
import { Button } from "@/components/ui/button";
import { Copy, Loader2 } from "lucide-react";

type WaitingScreenProps = {
  gameId: string;
};

export function OnlineGameWaitingScreen({ gameId }: WaitingScreenProps) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const handleCopyGameId = () => {
    navigator.clipboard.writeText(gameId);
    toast({ title: t("gameIdCopied") });
  };

  return (
    <div className="text-center py-10">
      <h2 className="text-2xl font-bold mb-4">{t("waitingForPlayer")}</h2>
      <p className="mb-4 text-muted-foreground">{t("shareGameId")}</p>
      <div className="flex items-center justify-center gap-2 mb-6">
        <code className="p-2 bg-muted rounded-md">{gameId}</code>
        <Button onClick={handleCopyGameId} size="icon" variant="ghost">
          <Copy className="h-4 w-4" />
        </Button>
      </div>
      <p className="mb-4">{t("orShareUrl")}</p>
      <Loader2 className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-8" />
    </div>
  );
}
