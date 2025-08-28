
"use client";

import { useState, useContext, useEffect, useCallback } from 'react';
import { GameContext } from '@/contexts/game-context';
import { useTranslation } from '@/hooks/use-translation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAIMove } from '../actions';
import type { AdjustDifficultyInput } from '@/ai/flows/ai-opponent-difficulty-adjustment';
import Link from 'next/link';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Lightbulb, Loader2 } from 'lucide-react';
import { PokerCard as GameCardComponent } from '@/components/ui/poker-card';
import { getCards } from '@/lib/firestore';
import type { CardData } from '@/lib/types';
import { useVictorySound } from '@/hooks/use-victory-sound';
import { VictoryAnimation } from '@/components/victory-animation';


const TOTAL_ROUNDS = 13;

type DuelState = {
  currentRound: number;
  playerCards: CardData[];
  cpuCards: CardData[];
  playerScore: number;
  cpuScore: number;
  playerKyuso: number;
  cpuKyuso: number;
  playerOnly: number;
  cpuOnly: number;
  gameEnded: boolean;
  playerCard: CardData | null;
  cpuCard: CardData | null;
  resultText: string;
  resultDetail: string;
  finalResult: string;
  finalDetail: string;
  history: { player: number; cpu: number }[];
  aiRationale: string | null;
  isLoading: boolean;
};

const initialDuelState: Omit<DuelState, 'playerCards' | 'cpuCards'> = {
  currentRound: 1,
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
  isLoading: true,
};

const createDefaultDeck = (count = 13): CardData[] => {
    return Array.from({ length: count }, (_, i) => ({
        id: `default-${i + 1}`,
        gameType: 'common',
        suit: 'default',
        number: i + 1,
        value: i + 1,
        name: `Default Card ${i + 1}`,
        artist: 'System',
        imageUrl: `https://picsum.photos/seed/card-default-${i+1}/200/300`,
        rarity: 'common',
        tags: []
    }));
};

const createRandomDeck = (allCards: CardData[]): CardData[] => {
    let deck = [...allCards];
    // If not enough registered cards, supplement with default cards
    if (deck.length < 13) {
        const needed = 13 - deck.length;
        const defaultCards = createDefaultDeck(13); // Create a full default deck
        // Get unique default cards that don't clash with registered ones
        const uniqueDefaults = defaultCards.filter(dc => !deck.some(rc => rc.number === dc.number));
        deck.push(...uniqueDefaults.slice(0, needed));
    }
    
    // Shuffle and pick 13
    const shuffled = deck.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 13);
};

export default function DuelPage() {
  const { difficulty, recordGameResult } = useContext(GameContext);
  const { t } = useTranslation();
  const [state, setState] = useState<DuelState>({ ...initialDuelState, playerCards: [], cpuCards: [], isLoading: true });
  const [loading, setLoading] = useState(false);
  const playVictorySound = useVictorySound();

  const initializeDecks = useCallback(async () => {
    setState(prevState => ({ ...prevState, isLoading: true }));
    try {
        const allCards = await getCards(true); // Force refresh
        
        // createRandomDeck will handle the logic of falling back to default cards
        const playerDeck = createRandomDeck(allCards);
        const cpuDeck = createRandomDeck(allCards);

        setState(prevState => ({
            ...prevState,
            ...initialDuelState,
            round: 1, // Always reset round
            playerScore: 0, // Always reset score
            cpuScore: 0, // Always reset score
            playerCards: playerDeck,
            cpuCards: cpuDeck,
            isLoading: false,
        }));
    } catch (error) {
        console.error("Failed to initialize decks:", error);
        const playerDeck = createDefaultDeck(13);
        const cpuDeck = createDefaultDeck(13);
        setState(prevState => ({
             ...prevState,
             ...initialDuelState,
             playerCards: playerDeck,
             cpuCards: cpuDeck,
             isLoading: false,
             gameEnded: true, 
             finalResult: "Error initializing game."
        }));
    }
  }, []);

  useEffect(() => {
    initializeDecks();
  }, [initializeDecks]);

  const restartGame = useCallback(() => {
    initializeDecks();
  }, [initializeDecks]);

  const selectPlayerCard = async (card: CardData) => {
    if (loading || state.gameEnded || state.isLoading) return;
    setLoading(true);

    const newPlayerCards = state.playerCards.filter((c) => c.id !== card.id);
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
      availableMoves: state.cpuCards.map(c => String(c.number)),
      playerPreviousMove: prevPlayerMove?.toString(),
      cpuPreviousMove: prevCpuMove?.toString(),
    };

    const aiResponse = await getAIMove(aiInput);
    let cpuCardNumber = parseInt(aiResponse.move, 10);
    let cpuCard = state.cpuCards.find(c => c.number === cpuCardNumber);

    if (!cpuCard) {
        cpuCard = state.cpuCards[Math.floor(Math.random() * state.cpuCards.length)];
    }
    
    const newCpuCards = state.cpuCards.filter((c) => c.id !== cpuCard!.id);
    
    setTimeout(() => {
        setState(prev => ({ ...prev, cpuCard, aiRationale: aiResponse.rationale }));
        setTimeout(() => evaluateRound(card, cpuCard!, newCpuCards), 500);
    }, 300);
  };
  
  const evaluateRound = (playerCard: CardData, cpuCard: CardData, newCpuCards: CardData[]) => {
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

    const pNum = playerCard.number;
    const cNum = cpuCard.number;

    if (pNum === 1 && cNum === 13) {
      winner = 'player';
      resultDetail = t('duelResultOnlyOne');
      newPlayerOnly++;
      isSpecialWin = true; winType = 'only';
    } else if (cNum === 1 && pNum === 13) {
      winner = 'cpu';
      resultDetail = t('duelResultOnlyOne');
      newCpuOnly++;
      isSpecialWin = true; winType = 'only';
    } else if (pNum === cNum - 1) {
      winner = 'player';
      resultDetail = t('duelResultKyuso');
      newPlayerKyuso++;
      isSpecialWin = true; winType = 'kyuso';
    } else if (cNum === pNum - 1) {
      winner = 'cpu';
      resultDetail = t('duelResultKyuso');
      newCpuKyuso++;
      isSpecialWin = true; winType = 'kyuso';
    } else if (pNum > cNum) {
      winner = 'player';
      resultDetail = `${pNum} vs ${cNum}`;
    } else if (cNum > pNum) {
        winner = 'cpu';
        resultDetail = `${cNum} vs ${pNum}`;
    } else {
        winner = 'draw';
        resultDetail = `${pNum} vs ${cNum}`;
    }

    if (winner === 'player') {
        resultText = t('youWin');
        newPlayerScore++;
        playVictorySound();
    } else if (winner === 'cpu') {
        resultText = t('cpuWins');
        newCpuScore++;
    } else {
        resultText = t('draw');
    }

    const newHistory = [...state.history, { player: pNum, cpu: cNum }];
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
        if(winner === 'player') playVictorySound();
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
    <div className="flex flex-col md:flex-row justify-center gap-2 md:gap-8 text-base mb-4">
      <Card className="p-3 md:p-4 bg-blue-100 dark:bg-blue-900/50">
        <p className="font-bold">{t('you')}: {state.playerScore} {t('wins')}</p>
        <div className="text-sm opacity-80">
          <span>{t('kyuso')}: {state.playerKyuso} | </span>
          <span>{t('onlyOne')}: {state.playerOnly}</span>
        </div>
      </Card>
      <Card className="p-3 md:p-4 bg-red-100 dark:bg-red-900/50">
        <p className="font-bold">{t('cpu')}: {state.cpuScore} {t('wins')}</p>
        <div className="text-sm opacity-80">
          <span>{t('kyuso')}: {state.cpuKyuso} | </span>
          <span>{t('onlyOne')}: {state.cpuOnly}</span>
        </div>
      </Card>
    </div>
  );

  if (state.isLoading) {
      return (
          <div className="text-center py-20">
              <Loader2 className="w-12 h-12 mx-auto animate-spin" />
              <p className="mt-4 text-lg text-muted-foreground">Loading cards from database...</p>
          </div>
      )
  }

  return (
    <div className="text-center">
      {state.resultText === t('youWin') && <VictoryAnimation />}
      {state.finalResult === t('duelFinalResultWin') && <VictoryAnimation />}
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
                {state.playerCards.sort((a, b) => a.number - b.number).map(card => (
                  <button key={card.id} onClick={() => selectPlayerCard(card)} disabled={loading} className="transition-transform hover:scale-105">
                     <GameCardComponent card={card} revealed={true} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {(state.playerCard !== null) && (
            <div className={`my-8 ${state.resultText ? '' : 'pulse-animation'}`}>
              <div className="flex justify-center space-x-8">
                <div className="text-center">
                  <h4 className="text-lg font-bold mb-2">{t('you')}</h4>
                   <GameCardComponent card={state.playerCard} revealed={true} />
                </div>
                <div className="text-center">
                  <h4 className="text-lg font-bold mb-2">{t('cpu')}</h4>
                  <GameCardComponent card={state.cpuCard} revealed={state.cpuCard !== null} />
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
