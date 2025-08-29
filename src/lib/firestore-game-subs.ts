
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function subscribeToGameSharded(opts: {
  gameId: string;
  myUid: string;
  oppUid?: string | null;
  onBase: (base: any) => void;
  onMain: (main: any) => void;
  onScores: (s: any) => void;
  onKyuso: (k: any) => void;
  onOnly: (o: any) => void;
  onMyHand: (h: any) => void;
  onOppMove: (m: any) => void;
  onMyMove: (m: any) => void;
  onLastHistory: (h: any) => void;
}) {
  const { gameId, myUid, oppUid } = opts;
  const unsubs: Array<() => void> = [];

  if (!db) return () => {};
  if (!gameId || !myUid) {
    console.error("gameId and myUid must be provided to subscribeToGameSharded");
    return () => {};
  }

  // Lightweight base document
  unsubs.push(onSnapshot(doc(db, 'games', gameId), s => opts.onBase(s.data())));

  // Lightweight state documents
  const stateRef = collection(db, 'games', gameId, 'state');
  unsubs.push(onSnapshot(doc(stateRef, 'main'), s => opts.onMain(s.data())));
  unsubs.push(onSnapshot(doc(stateRef, 'scores'), s => opts.onScores(s.data() ?? {})));
  unsubs.push(onSnapshot(doc(stateRef, 'kyuso'), s => opts.onKyuso(s.data() ?? {})));
  unsubs.push(onSnapshot(doc(stateRef, 'only'), s => opts.onOnly(s.data() ?? {})));
  unsubs.push(onSnapshot(doc(stateRef, 'lastHistory'), s => opts.onLastHistory(s.data() ?? null)));

  // My hand only
  unsubs.push(onSnapshot(doc(db, 'games', gameId, 'hands', myUid), s => opts.onMyHand(s.data()?.cards ?? [])));

  // My move
  unsubs.push(onSnapshot(doc(db, 'games', gameId, 'moves', myUid), s => opts.onMyMove(s.data()?.card ?? null)));

  // Opponent's move
  if (oppUid) {
    unsubs.push(onSnapshot(doc(db, 'games', gameId, 'moves', oppUid), s => opts.onOppMove(s.data()?.card ?? null)));
  } else {
      const unsubPlayerIds = onSnapshot(doc(db, 'games', gameId), (gameDoc) => {
          const gameData = gameDoc.data();
          if (gameData && gameData.playerIds) {
              const opponent = gameData.playerIds.find((pId: string) => pId !== myUid);
              if (opponent) {
                  unsubs.push(onSnapshot(doc(db, 'games', gameId, 'moves', opponent), s => opts.onOppMove(s.data()?.card ?? null)));
                  unsubPlayerIds(); // Unsubscribe once opponent is found
              }
          }
      });
      unsubs.push(unsubPlayerIds);
  }

  return () => unsubs.forEach(u => u());
}
