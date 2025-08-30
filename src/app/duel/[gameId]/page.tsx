
"use client";

import { useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation } from '@/hooks/use-translation';
import { Loader2 } from 'lucide-react';
import { PokerCard } from '@/components/ui/poker-card';
import { useDuelGame } from '@/hooks/use-duel-game';
import { OnlineGamePlayerInfo } from '@/components/online-game/player-info';
import { OnlineGameScoreDisplay } from '@/components/online-game/score-display';
import { OnlineGameWaitingScreen } from '@/components/online-game/waiting-screen';
import { OnlineGameResultScreen } from '@/components/online-game/result-screen';
import { OnlineGameForfeitButton } from '@/components/online-game/forfeit-button';

const TOTAL_ROUNDS = 13;

export default function OnlineDuelPage() {
  const { user } = useAuth();
  const { gameId, gameState, loading, error } = useDuelGame();
  const { t } = useTranslation();

  const {
    status,
    players,
    playerIds,
    winner,
    currentRound,
    scores,
    kyuso,
    only,
    moves,
    roundWinner,
    roundResultText,
    roundResultDetail,
    myFullHand,
    handleSelectCard,
    isSubmittingMove,
  } = gameState;

  const opponentId = useMemo(() => playerIds.find(p => p !== user?.uid), [playerIds, user]);
  const myMove = useMemo(() => moves?.[user?.uid ?? ''], [moves, user]);
  const opponentMove = useMemo(() => (opponentId ? moves?.[opponentId] : null), [moves, opponentId]);

  if (loading || !user) {
    return <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin" /> Loading game...</div>;
  }

  if (status === 'waiting') {
    return <OnlineGameWaitingScreen gameId={gameId} />;
  }
  
  if (error) {
    return <div className="text-center text-destructive py-10">{error}</div>
  }

  if (status === 'finished') {
    return <OnlineGameResultScreen gameType="duel" winner={winner} players={players} />;
  }

  return (
    <div className="text-center">
      <div className="flex justify-between items-center mb-2">
        <div className="w-1/3"></div>
        <div className="w-1/3 text-center">
            <h2 className="text-3xl font-bold">{t('duelTitle')} - Online</h2>
        </div>
        <div className="w-1/3 flex justify-end">
            <OnlineGameForfeitButton gameType="duel" gameId={gameId} />
        </div>
      </div>

      <div className="mb-4 text-muted-foreground">
        <span>{t('round')} {currentRound > TOTAL_ROUNDS ? TOTAL_ROUNDS : currentRound} / {TOTAL_ROUNDS}</span>
      </div>
      <OnlineGameScoreDisplay
        players={players}
        playerIds={playerIds}
        scores={scores}
        details={{ kyuso, only }}
        detailLabels={{ kyuso: t('kyuso'), only: t('onlyOne') }}
      />
      
      <>
        {!roundWinner && (
          <div className="my-8">
              {myMove == null ? (
                  <>
                      <h3 className="text-xl font-bold mb-4">{t('selectCard')}</h3>
                      <div className="flex flex-wrap justify-center gap-2 max-w-4xl mx-auto">
                          {myFullHand.sort((a,b) => a.number - b.number).map(card => (
                            <button key={card.id} onClick={() => handleSelectCard(card)} disabled={isSubmittingMove} className="transition-transform hover:scale-105">
                                <PokerCard card={card} revealed={true} />
                            </button>
                          ))}
                      </div>
                  </>
              ) : (
                  <p className="text-xl font-semibold text-muted-foreground animate-pulse">{t('waitingForOpponentMove')}</p>
              )}
          </div>
        )}

        {(myMove != null) && (
          <div className="my-8">
            <div className="flex justify-around items-center">
              <div className="text-center">
                <OnlineGamePlayerInfo uid={user.uid} players={players} />
                <div className="mt-2"><PokerCard card={myMove} revealed={true}/></div>
              </div>
              <div className="text-2xl font-bold">VS</div>
              <div className="text-center">
                {opponentId && <OnlineGamePlayerInfo uid={opponentId} players={players} />}
                <div className="mt-2"><PokerCard card={opponentMove} revealed={opponentMove !== null}/></div>
              </div>
            </div>
          </div>
        )}

        {roundWinner && (
          <div className="my-6">
            <p className="text-2xl font-bold mb-2">{roundResultText}</p>
            <p className="text-lg text-muted-foreground">{roundResultDetail}</p>
          </div>
        )}
      </>

    </div>
  );
}
