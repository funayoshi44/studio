"use client";

import { useState, useContext, useEffect, useMemo, useCallback } from 'react';
import { GameContext } from '@/contexts/game-context';
import { useTranslation } from '@/hooks/use-translation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAIMove } from '../actions';
import type { AdjustDifficultyInput } from '@/ai/flows/ai-opponent-difficulty-adjustment';
import Link from 'next/link';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Lightbulb } from 'lucide-react';

const TOTAL_ROUNDS = 13;

type DuelState = {
  currentRound: number;
  playerCards: number[];
  cpuCards: number[];
  playerScore: number;
  cpuScore: number;
  playerKyuso: number;
  cpuKyuso: number;
  playerOnly: number;
  cpuOnly: number;
  gameEnded: boolean;
  playerCard: number | null;
  cpuCard: number | null;
  resultText: string;
  resultDetail: string;
  finalResult: string;
  finalDetail: string;
  history: { player: number; cpu: number }[];
  aiRationale: string | null;
};

const initialDuelState: DuelState = {
  currentRound: 1,
  playerCards: Array.from({ length: TOTAL_ROUNDS }, (_, i) => i + 1),
  cpuCards: Array.from({ length: TOTAL_ROUNDS }, (_, i) => i + 1),
  playerScore: 0,
  cpuScore: 0,
  playerKyuso: 0,
  cpuKyuso: 0,
  playerOnly: 0,
  cpuOnly: 0,
  gameEnded: false,
  playerCard: null,
  cpuCard: null,
  resultText: '',
  resultDetail: '',
  finalResult: '',
  finalDetail: '',
  history: [],
  aiRationale: null,
};

export default function DuelPage() {
  const { difficulty, recordGameResult } = useContext(GameContext);
  const t = useTranslation();
  const [state, setState] = useState<DuelState>(initialDuelState);
  const [loading, setLoading] = useState(false);

  const restartGame = useCallback(() => {
    setState(initialDuelState);
  }, []);

  const selectPlayerCard = async (card: number) => {
    if (loading || state.gameEnded) return;
    setLoading(true);

    const newPlayerCards = state.playerCards.filter((c) => c !== card);
    setState(prev => ({ ...prev, playerCard: card, playerCards: newPlayerCards, aiRationale: null }));

    const { player: prevPlayerMove, cpu: prevCpuMove } = state.history[state.history.length - 1] || {};

    const aiInput: AdjustDifficultyInput = {
      gameType: 'duel',
      difficulty: difficulty,
      gameState: {
        round: state.currentRound,
        playerScore: state.playerScore,
        cpuScore: state.cpuScore,
        playerKyuso: state.playerKyuso,
        cpuKyuso: state.cpuKyuso,
      },
      availableMoves: state.cpuCards.map(String),
      playerPreviousMove: prevPlayerMove?.toString(),
      cpuPreviousMove: prevCpuMove?.toString(),
    };

    const aiResponse = await getAIMove(aiInput);
    let cpuCard = parseInt(aiResponse.move, 10);
    if (isNaN(cpuCard) || !state.cpuCards.includes(cpuCard)) {
        cpuCard = state.cpuCards[Math.floor(Math.random() * state.cpuCards.length)];
    }
    
    const newCpuCards = state.cpuCards.filter((c) => c !== cpuCard);
    
    setTimeout(() => {
        setState(prev => ({ ...prev, cpuCard, aiRationale: aiResponse.rationale }));
        setTimeout(() => evaluateRound(card, cpuCard, newCpuCards), 500);
    }, 300);
  };
  
  const evaluateRound = (playerCard: number, cpuCard: number, newCpuCards: number[]) => {
    let winner: 'player' | 'cpu' | 'draw' = 'draw';
    let resultText = '';
    let resultDetail = '';
    let isSpecialWin = false;
    let winType = '';
    let newPlayerScore = state.playerScore;
    let newCpuScore = state.cpuScore;
    let newPlayerKyuso = state.playerKyuso;
    let newCpuKyuso = state.cpuKyuso;
    let newPlayerOnly = state.playerOnly;
    let newCpuOnly = state.cpuOnly;

    if (playerCard === 1 && cpuCard === 13) {
      winner = 'player';
      resultDetail = t('duelResultOnlyOne');
      newPlayerOnly++;
      isSpecialWin = true; winType = 'only';
    } else if (cpuCard === 1 && playerCard === 13) {
      winner = 'cpu';
      resultDetail = t('duelResultOnlyOne');
      newCpuOnly++;
      isSpecialWin = true; winType = 'only';
    } else if (playerCard === cpuCard - 1) {
      winner = 'player';
      resultDetail = t('duelResultKyuso');
      newPlayerKyuso++;
      isSpecialWin = true; winType = 'kyuso';
    } else if (cpuCard === playerCard - 1) {
      winner = 'cpu';
      resultDetail = t('duelResultKyuso');
      newCpuKyuso++;
      isSpecialWin = true; winType = 'kyuso';
    } else if (playerCard > cpuCard) {
      winner = 'player';
      resultDetail = `${playerCard} vs ${cpuCard}`;
    } else if (cpuCard > playerCard) {
        winner = 'cpu';
        resultDetail = `${cpuCard} vs ${playerCard}`;
    } else {
        winner = 'draw';
        resultDetail = `${playerCard} vs ${cpuCard}`;
    }

    if (winner === 'player') {
        resultText = t('youWin');
        newPlayerScore++;
    } else if (winner === 'cpu') {
        resultText = t('cpuWins');
        newCpuScore++;
    } else {
        resultText = t('draw');
    }

    const newHistory = [...state.history, { player: playerCard, cpu: cpuCard }];
    const nextRound = state.currentRound + 1;

    setState(prev => ({
        ...prev,
        resultText, resultDetail, cpuCards: newCpuCards,
        playerScore: newPlayerScore, cpuScore: newCpuScore,
        playerKyuso: newPlayerKyuso, cpuKyuso: newCpuKyuso,
        playerOnly: newPlayerOnly, cpuOnly: newCpuOnly,
        history: newHistory,
    }));

    checkGameEnd(nextRound, newPlayerScore, newCpuScore, newPlayerKyuso, newCpuKyuso, isSpecialWin, winType, winner);
    setLoading(false);
  };
  
  const checkGameEnd = (nextRound: number, pScore: number, cScore: number, pKyuso: number, cKyuso: number, isSpecial: boolean, winType: string, winner: string) => {
    let ended = false;
    let finalResult = '';
    let finalDetail = '';
    
    if (isSpecial && winType === 'only') {
      ended = true;
      if (winner === 'player') {
        finalResult = t('duelFinalResultWin');
        finalDetail = t('duelFinalDetailOnlyOneWin');
        recordGameResult('duel', 'win');
      } else {
        finalResult = t('duelFinalResultLoss');
        finalDetail = t('duelFinalDetailOnlyOneWin');
        recordGameResult('duel', 'loss');
      }
    } else if (pKyuso >= 3) {
      ended = true;
      finalResult = t('duelFinalResultWin');
      finalDetail = t('duelFinalDetailKyusoWin');
      recordGameResult('duel', 'win');
    } else if (cKyuso >= 3) {
      ended = true;
      finalResult = t('duelFinalResultLoss');
      finalDetail = t('duelFinalDetailKyusoWin');
      recordGameResult('duel', 'loss');
    } else if (nextRound > TOTAL_ROUNDS) {
      ended = true;
      if (pScore > cScore) {
        finalResult = t('duelFinalResultWin');
        recordGameResult('duel', 'win');
      } else if (cScore > pScore) {
        finalResult = t('duelFinalResultLoss');
        recordGameResult('duel', 'loss');
      } else {
        finalResult = t('duelFinalResultDraw');
      }
      finalDetail = `${t('finalScore')}: ${pScore} - ${cScore}`;
    }

    if(ended) {
        setState(prev => ({ ...prev, gameEnded: true, finalResult, finalDetail }));
    }
  };

  const advanceToNextRound = () => {
    setState(prev => ({
        ...prev,
        currentRound: prev.currentRound + 1,
        playerCard: null,
        cpuCard: null,
        resultText: '',
        aiRationale: null,
    }));
  }

  const ScoreDisplay = () => (
    <div className="flex justify-center space-x-4 md:space-x-8 text-lg mb-4">
      <Card className="p-4 bg-blue-100 dark:bg-blue-900/50">
        <p className="font-bold">{t('you')}: {state.playerScore} {t('wins')}</p>
        <div className="text-sm opacity-80">
          <span>{t('kyuso')}: {state.playerKyuso} | </span>
          <span>{t('onlyOne')}: {state.playerOnly}</span>
        </div>
      </Card>
      <Card className="p-4 bg-red-100 dark:bg-red-900/50">
        <p className="font-bold">{t('cpu')}: {state.cpuScore} {t('wins')}</p>
        <div className="text-sm opacity-80">
          <span>{t('kyuso')}: {state.cpuKyuso} | </span>
          <span>{t('onlyOne')}: {state.cpuOnly}</span>
        </div>
      </Card>
    </div>
  );

  return (
    <div className="text-center">
      <h2 className="text-3xl font-bold mb-2">{t('duelTitle')}</h2>
      <div className="mb-4 text-muted-foreground">
        <span>{t('round')} {state.currentRound > TOTAL_ROUNDS ? TOTAL_ROUNDS : state.currentRound} / {TOTAL_ROUNDS}</span>
        <span className="mx-2">|</span>
        <span>{t('cpu')}: <span className="font-semibold capitalize">{t(difficulty)}</span></span>
      </div>
      <ScoreDisplay />
      
      {!state.gameEnded && (
        <>
          {!state.resultText && (
            <div className="my-8">
              <h3 className="text-xl font-bold mb-4">{t('selectCard')}</h3>
              <div className="flex flex-wrap justify-center gap-2 max-w-4xl mx-auto">
                {state.playerCards.map(card => (
                  <Button key={card} onClick={() => selectPlayerCard(card)} disabled={loading} className="w-16 h-20 text-lg font-bold transition-transform hover:scale-110">
                    {card}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {(state.playerCard !== null) && (
            <div className={`my-8 ${state.resultText ? '' : 'pulse-animation'}`}>
              <div className="flex justify-center space-x-8">
                <div className="text-center">
                  <h4 className="text-lg font-bold mb-2">{t('you')}</h4>
                  <div className={`w-24 h-32 bg-blue-600 rounded-lg flex items-center justify-center text-3xl font-bold border-4 border-blue-400 ${state.cpuCard ? '' : 'card-flip'}`}>{state.playerCard}</div>
                </div>
                <div className="text-center">
                  <h4 className="text-lg font-bold mb-2">{t('cpu')}</h4>
                  <div className={`w-24 h-32 bg-red-600 rounded-lg flex items-center justify-center text-3xl font-bold border-4 border-red-400 ${state.cpuCard ? '' : 'card-flip'}`}>{state.cpuCard ?? '?'}</div>
                </div>
              </div>
            </div>
          )}

          {state.resultText && !state.gameEnded && (
            <div className="my-6">
              <p className="text-2xl font-bold mb-2">{state.resultText}</p>
              <p className="text-lg text-muted-foreground">{state.resultDetail}</p>
               {state.aiRationale && (
                <Accordion type="single" collapsible className="w-full max-w-md mx-auto mt-4">
                  <AccordionItem value="item-1">
                    <AccordionTrigger>
                      <span className="flex items-center gap-2"><Lightbulb className="w-4 h-4" /> AI's Rationale</span>
                    </AccordionTrigger>
                    <AccordionContent className="text-left text-sm text-muted-foreground bg-background/50 p-4 rounded-md">
                      {state.aiRationale}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}
              <Button onClick={advanceToNextRound} className="mt-4" size="lg">
                {t('nextRound')}
              </Button>
            </div>
          )}
        </>
      )}

      {state.gameEnded && (
        <div className="my-8">
          <p className="text-4xl font-bold mb-4">{state.finalResult}</p>
          <p className="text-xl mb-6 text-muted-foreground">{state.finalDetail}</p>
          <div className="space-x-4">
            <Button onClick={restartGame} size="lg">{t('playAgain')}</Button>
            <Link href="/" passHref>
              <Button variant="secondary" size="lg">{t('backToMenu')}</Button>
            </Link>
          </div>
        </div>
      )}

      <Card className="max-w-4xl mx-auto mt-12 text-left bg-card/50">
        <CardHeader><CardTitle>📖 {t('duelTitle')} Rules</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• {t('duelDescription')}</p>
          <p>• Higher number wins each round.</p>
          <p>• <strong>{t('kyuso')}:</strong> Win with a number exactly 1 smaller than the opponent's (e.g., 5 beats 6). 3 Kyuso wins result in an instant victory.</p>
          <p>• <strong>{t('onlyOne')}:</strong> 1 beats 13 for an instant victory.</p>
        </CardContent>
      </Card>
    </div>
  );
}
