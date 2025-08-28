
import { db, storage } from './firebase';
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  getDoc,
  setDoc,
  onSnapshot,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp,
  limit,
  runTransaction,
  orderBy,
  deleteDoc,
  writeBatch,
  increment,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import type { Game, GameType, MockUser, Post, CardData, ChatRoom, ChatMessage } from './types';
import { createPokerDeck, evaluatePokerHand } from './game-logic/poker';


const TOTAL_ROUNDS = 13;

// --- Point System ---
export const awardPoints = async (userId: string, amount: number) => {
    if (!userId) return;
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
        points: increment(amount)
    });
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
    if (allCards.length < 13) {
        return createDefaultDeck(13);
    }
    const shuffled = [...allCards].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 13);
};


const getInitialDuelGameState = async (playerIds: string[] = []) => {
    const allCards = await getCards();

    const gameState: any = {
        currentRound: 1,
        playerHands: {},
        scores: {},
        kyuso: {},
        only: {},
        moves: {}, // Stores the played card object
        lastMoveBy: null,
        history: {},
        roundWinner: null,
        roundResultText: '',
        roundResultDetail: '',
    };

    playerIds.forEach(uid => {
        // Each player gets a randomized 13-card deck
        gameState.playerHands[uid] = createRandomDeck(allCards);
        gameState.scores[uid] = 0;
        gameState.kyuso[uid] = 0;
        gameState.only[uid] = 0;
        gameState.moves[uid] = null;
    });
    return gameState;
};

const getInitialJankenGameState = (playerIds: string[] = []) => {
    const gameState: any = {
        currentRound: 1,
        scores: {},
        moves: {}, // { initial: { uid: move }, final: { uid: move } }
        phase: 'initial', // 'initial', 'final', 'result'
        roundWinner: null,
        roundResultText: '',
    };
    playerIds.forEach(uid => {
        gameState.scores[uid] = 0;
        gameState.moves[uid] = { initial: null, final: null };
    });
    return gameState;
};

const getInitialPokerGameState = async (playerIds: string[] = []) => {
    const deck = await createPokerDeck();
    const gameState: any = {
        phase: 'dealing', // dealing -> exchanging -> showdown -> finished
        deck: [],
        playerHands: {},
        selectedCards: {},
        exchangeCounts: {},
        playerRanks: {},
        turnOrder: playerIds.sort(() => Math.random() - 0.5), // Randomize turn order
        currentTurnIndex: 0,
        winners: null,
        resultText: '',
    };

    playerIds.forEach(uid => {
        gameState.playerHands[uid] = deck.splice(0, 5);
        gameState.exchangeCounts[uid] = 0;
        gameState.selectedCards[uid] = [];
        gameState.playerRanks[uid] = null;
    });

    gameState.deck = deck;
    gameState.phase = 'exchanging';

    return gameState;
};


const getInitialStateForGame = async (gameType: GameType, playerIds: string[]) => {
    switch (gameType) {
        case 'duel':
            return getInitialDuelGameState(playerIds);
        case 'janken':
            return getInitialJankenGameState(playerIds);
        case 'poker':
            return getInitialPokerGameState(playerIds);
        default:
            return getInitialDuelGameState(playerIds);
    }
}


// Upload a profile image and get the URL
export const uploadProfileImage = async (userId: string, file: File): Promise<string> => {
    const storageRef = ref(storage, `profileImages/${userId}/${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
};

// Create a new game
export const createGame = async (user: MockUser, gameType: GameType): Promise<string> => {
  const gameCollection = collection(db, 'games');
  
  const docRef = await addDoc(gameCollection, {
    gameType,
    players: {
      [user.uid]: {
        displayName: user.displayName,
        photoURL: user.photoURL,
        bio: user.bio || '',
      },
    },
    playerIds: [user.uid],
    status: 'waiting',
    createdAt: serverTimestamp(),
    maxPlayers: gameType === 'poker' ? 4 : 2,
    gameState: {}, // Initialize with an empty object
  });
  
  await awardPoints(user.uid, 1); // Award 1 point for creating a game
  return docRef.id;
};

// Join a game
export const joinGame = async (gameId: string, user: MockUser): Promise<void> => {
    const gameRef = doc(db, 'games', gameId);

    await runTransaction(db, async (transaction) => {
        const gameSnap = await transaction.get(gameRef);

        if (!gameSnap.exists()) {
            throw new Error('Game not found');
        }

        const gameData = gameSnap.data() as Game;
        const maxPlayers = gameData.maxPlayers || 2;
        
        // Prevent joining if game is full, or already started, or user is already in
        if (gameData.playerIds.length >= maxPlayers || gameData.status !== 'waiting' || gameData.playerIds.includes(user.uid)) {
            return;
        }
        
        const newPlayerIds = [...gameData.playerIds, user.uid];

        // For Duel and Janken, start the game when lobby is full
        const isGameStarting = (gameData.gameType === 'duel' || gameData.gameType === 'janken') && newPlayerIds.length === maxPlayers;
        
        const updates: any = {
             [`players.${user.uid}`]: {
                displayName: user.displayName,
                photoURL: user.photoURL,
                bio: user.bio || '',
            },
            playerIds: newPlayerIds,
        };

        if (isGameStarting) {
            updates.status = 'in-progress';
            updates.gameState = await getInitialStateForGame(gameData.gameType, newPlayerIds);
        }

        transaction.update(gameRef, updates);
        await awardPoints(user.uid, 1); // Award 1 point for joining
    });
};

// Manually start a game (for Poker)
export const startGame = async (gameId: string) => {
    const gameRef = doc(db, 'games', gameId);
    await runTransaction(db, async (transaction) => {
        const gameSnap = await transaction.get(gameRef);
        if (!gameSnap.exists()) {
            throw new Error("Game not found");
        }
        const gameData = gameSnap.data() as Game;
        if (gameData.status !== 'waiting' || gameData.playerIds.length < 2) {
            throw new Error("Game cannot be started.");
        }

        const initialGameState = await getInitialStateForGame(gameData.gameType, gameData.playerIds);

        transaction.update(gameRef, {
            status: 'in-progress',
            gameState: initialGameState
        });
    });
};


// Listen for game updates
export const subscribeToGame = (gameId: string, callback: (game: Game | null) => void) => {
  const gameRef = doc(db, 'games', gameId);
  return onSnapshot(gameRef, (docSnap) => {
    if (docSnap.exists()) {
      callback({ id: docSnap.id, ...docSnap.data() } as Game);
    } else {
      callback(null);
    }
  });
};

// Update game state
export const updateGameState = async (gameId: string, newGameState: any): Promise<void> => {
  const gameRef = doc(db, 'games', gameId);
  
  const updatePayload: { [key: string]: any } = {};

  if (newGameState !== undefined) {
    updatePayload.gameState = newGameState;
  }
  
  // Conditionally add status and winner to the payload if they exist in newGameState
  if (newGameState.status !== undefined) {
    updatePayload.status = newGameState.status;
  }
  if (newGameState.winner !== undefined) {
    updatePayload.winner = newGameState.winner;
  }

  if (Object.keys(updatePayload).length > 0) {
    await updateDoc(gameRef, updatePayload);
  }
};


// Submit a move
export const submitMove = async (gameId: string, userId: string, move: any, phase?: 'initial' | 'final') => {
    const gameRef = doc(db, 'games', gameId);
    await runTransaction(db, async (transaction) => {
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) throw new Error("Game not found!");

        const gameData = gameDoc.data() as Game;
        let newGameState = { ...gameData.gameState };

        if (gameData.gameType === 'janken' && phase) {
            newGameState.moves[userId][phase] = move;
        } else if (gameData.gameType === 'poker') {
            if (move.action === 'exchange') {
                const { indices } = move;
                let playerHand = [...newGameState.playerHands[userId]];
                let deck = [...newGameState.deck];
                indices.forEach((index: number) => {
                    if (deck.length > 0) {
                        playerHand[index] = deck.pop()!;
                    }
                });
                newGameState.playerHands[userId] = playerHand;
                newGameState.deck = deck;
                newGameState.exchangeCounts[userId]++;
            }
            
            // Advance turn or go to showdown
            const currentIndex = newGameState.turnOrder.indexOf(userId);
            const nextIndex = (currentIndex + 1) % gameData.playerIds.length;
            newGameState.currentTurnIndex = nextIndex;

            // If it's back to the first player, or if showdown is triggered, evaluate.
            if (nextIndex === 0 || move.action === 'showdown' || newGameState.exchangeCounts[userId] >= 2) {
                newGameState.phase = 'showdown';
                // Evaluate all hands
                gameData.playerIds.forEach(pid => {
                    newGameState.playerRanks[pid] = evaluatePokerHand(newGameState.playerHands[pid]);
                });

                // Find winner(s)
                let highestRank = { name: '', value: 0 };
                let winners: string[] = [];
                gameData.playerIds.forEach(pid => {
                    const rank = newGameState.playerRanks[pid];
                    if (rank.value > highestRank.value) {
                        highestRank = rank;
                        winners = [pid];
                    } else if (rank.value === highestRank.value) {
                        winners.push(pid);
                    }
                });
                newGameState.winners = winners;
                newGameState.resultText = winners.length > 1 
                    ? `Draw between ${winners.map(w => gameData.players[w]?.displayName).join(', ')}!`
                    : `${gameData.players[winners[0]]?.displayName} wins with a ${highestRank.name}!`;
                newGameState.phase = 'finished';

                // Award points to winner(s)
                if (winners.length > 0) {
                    for (const winnerId of winners) {
                       awardPoints(winnerId, 1);
                    }
                }
            }

        } else { // Duel
            newGameState.moves[userId] = move;
            newGameState.lastMoveBy = userId;
        }
        
        transaction.update(gameRef, { gameState: newGameState });
    });
};



// Find available games
export const findAvailableGames = async (): Promise<Game[]> => {
  const gamesCollection = collection(db, 'games');
  const q = query(
    gamesCollection,
    where('status', '==', 'waiting'),
    limit(20)
  );
  const querySnapshot = await getDocs(q);
  const games: Game[] = [];
  querySnapshot.forEach((doc) => {
    games.push({ id: doc.id, ...doc.data() } as Game);
  });
  return games;
};

// --- Auto Matchmaking ---
export const findAndJoinGame = async (user: MockUser, gameType: GameType): Promise<string> => {
  const gamesRef = collection(db, 'games');
  const maxPlayers = gameType === 'poker' ? 4 : 2;
  
  return runTransaction(db, async (transaction) => {
    const q = query(
        gamesRef,
        where('gameType', '==', gameType),
        where('status', '==', 'waiting'),
        limit(10)
      );

    const querySnapshot = await getDocs(q);
    
    let suitableGame: Game | null = null;
    let suitableGameId: string | null = null;
    
    for (const doc of querySnapshot.docs) {
        const game = { id: doc.id, ...doc.data() } as Game;
        if (!game.playerIds.includes(user.uid) && game.playerIds.length < maxPlayers) {
            suitableGame = game;
            suitableGameId = doc.id;
            break;
        }
    }

    if (suitableGame && suitableGameId) {
      const gameRef = doc(db, 'games', suitableGameId);
      const newPlayerIds = [...suitableGame.playerIds, user.uid];
      const isGameStarting = (gameType === 'duel' || gameType === 'janken') && newPlayerIds.length === (suitableGame.maxPlayers || maxPlayers);
      
      const updates: any = {
        [`players.${user.uid}`]: { displayName: user.displayName, photoURL: user.photoURL, bio: user.bio || '' },
        playerIds: newPlayerIds
      };

      if (isGameStarting) {
        updates.status = 'in-progress';
        updates.gameState = await getInitialStateForGame(gameType, newPlayerIds);
      }
      
      transaction.update(gameRef, updates);
      await awardPoints(user.uid, 1);
      return suitableGameId;
    } else {
      // No suitable waiting games found, create a new one
      const newGameRef = doc(collection(db, "games"));
      
      transaction.set(newGameRef, {
        gameType,
        players: { [user.uid]: { displayName: user.displayName, photoURL: user.photoURL, bio: user.bio || '' } },
        playerIds: [user.uid],
        status: 'waiting',
        createdAt: serverTimestamp(),
        gameState: {},
        maxPlayers: maxPlayers,
      });
      await awardPoints(user.uid, 1);
      return newGameRef.id;
    }
  });
};

// Forfeit a game
export const leaveGame = async (gameId: string, leavingPlayerId: string): Promise<void> => {
    const gameRef = doc(db, 'games', gameId);
    try {
        await runTransaction(db, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) {
                console.log("Game not found, can't leave.");
                return;
            }

            const gameData = gameSnap.data() as Game;
            if (gameData.status === 'finished') return;

            const remainingPlayers = gameData.playerIds.filter(p => p !== leavingPlayerId);

            if (remainingPlayers.length < 2 && gameData.status === 'in-progress') {
                // If only one player is left, they are the winner.
                const winnerId = remainingPlayers[0] || null;
                if (winnerId) {
                    await awardPoints(winnerId, 1); // Award point for winning
                }
                transaction.update(gameRef, {
                    status: 'finished',
                    winner: winnerId,
                });
            } else if (remainingPlayers.length > 0) {
                 // The game continues with the remaining players
                 const newPlayerIds = remainingPlayers;
                 const newPlayersObject: { [uid: string]: any } = {};
                 newPlayerIds.forEach(pid => {
                     newPlayersObject[pid] = gameData.players[pid];
                 });
                 transaction.update(gameRef, {
                     playerIds: newPlayerIds,
                     players: newPlayersObject
                 })
            } else {
                // No players left, just mark as finished
                transaction.update(gameRef, { status: 'finished', winner: null });
            }
        });
    } catch (error) {
        console.error("Failed to leave game:", error);
    }
};

// Get a single user's profile
export const getUserProfile = async (userId: string): Promise<MockUser | null> => {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
        return userSnap.data() as MockUser;
    }
    return null;
}

// Update a user's myCards
export const updateMyCards = async (userId: string, cardIds: string[]): Promise<void> => {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
        myCards: cardIds,
    });
};

// --- Posts (Bulletin Board) ---

export const createPost = async (author: MockUser, content: string): Promise<void> => {
    if (!content.trim()) {
        throw new Error("Post content cannot be empty.");
    }
    const postData = {
        author: {
            uid: author.uid,
            displayName: author.displayName,
            photoURL: author.photoURL,
        },
        content,
        createdAt: serverTimestamp(),
        likes: [],
        likeCount: 0,
    };
    await addDoc(collection(db, 'posts'), postData);
};


export const subscribeToPosts = (callback: (posts: Post[]) => void) => {
  const postsCollection = collection(db, 'posts');
  const q = query(
    postsCollection, 
    orderBy('createdAt', 'desc'),
    limit(50)
  );

  return onSnapshot(q, (querySnapshot) => {
    const posts: Post[] = [];
    querySnapshot.forEach((doc) => {
      posts.push({ id: doc.id, ...doc.data() } as Post);
    });
    callback(posts);
  });
};

export const subscribeToUserPosts = (userId: string, callback: (posts: Post[]) => void) => {
    const postsCollection = collection(db, 'posts');
    const q = query(
        postsCollection, 
        where('author.uid', '==', userId),
        // orderBy('createdAt', 'desc'), // This requires a composite index
        limit(50)
    );

    return onSnapshot(q, (snapshot) => {
        const posts: Post[] = [];
        snapshot.forEach((doc) => {
            posts.push({ id: doc.id, ...doc.data() } as Post);
        });
        callback(posts);
    });
};


// Like/Unlike a post
export const togglePostLike = async (postId: string, userId: string): Promise<void> => {
    const postRef = doc(db, 'posts', postId);
    await runTransaction(db, async (transaction) => {
        const postSnap = await transaction.get(postRef);
        if (!postSnap.exists()) {
            throw new Error("Post not found");
        }

        const postData = postSnap.data();
        const likes = (postData.likes || []) as string[];
        let newLikes;

        if (likes.includes(userId)) {
            newLikes = likes.filter(uid => uid !== userId);
        } else {
            newLikes = [...likes, userId];
        }

        transaction.update(postRef, {
            likes: newLikes,
            likeCount: newLikes.length
        });
    });
};

export const deletePost = async (postId: string): Promise<void> => {
    const postRef = doc(db, 'posts', postId);
    await deleteDoc(postRef);
};



// --- Card Management ---

const CARD_CACHE_KEY = 'cardverse-card-cache';
const CACHE_EXPIRATION_MS = 1000 * 60 * 60; // 1 hour cache

export const getCards = async (forceRefresh: boolean = false): Promise<CardData[]> => {
    if (!forceRefresh) {
        try {
            const cachedItem = localStorage.getItem(CARD_CACHE_KEY);
            if (cachedItem) {
                const { timestamp, data } = JSON.parse(cachedItem);
                if (Date.now() - timestamp < CACHE_EXPIRATION_MS && data && data.length > 0) {
                    return data as CardData[];
                }
            }
        } catch (e) {
            console.error("Error reading from card cache", e);
        }
    }
    
    const cardsCollection = collection(db, 'cards');
    const querySnapshot = await getDocs(cardsCollection);
    const cards: CardData[] = [];
    querySnapshot.forEach((doc) => {
        cards.push({ id: doc.id, ...doc.data() } as CardData);
    });

    try {
        const cacheItem = { timestamp: Date.now(), data: cards };
        localStorage.setItem(CARD_CACHE_KEY, JSON.stringify(cacheItem));
    } catch (e) {
        console.error("Error writing to card cache", e);
    }

    return cards;
};


export const addCard = async (
  cardData: Omit<CardData, 'id' | 'imageUrl'>,
  imageFile: File
): Promise<void> => {
  const filePath = `cards/${Date.now()}_${imageFile.name}`;
  const imageRef = ref(storage, filePath);
  const uploadResult = await uploadBytes(imageRef, imageFile);
  const imageUrl = await getDownloadURL(uploadResult.ref);

  const cardsCollection = collection(db, 'cards');
  await addDoc(cardsCollection, {
    ...cardData,
    imageUrl: imageUrl,
    createdAt: serverTimestamp(),
  });

  await getCards(true);
};


export const deleteCard = async (card: CardData): Promise<void> => {
    const cardRef = doc(db, 'cards', card.id);
    await deleteDoc(cardRef);

    if (card.imageUrl && card.imageUrl.includes('firebasestorage.googleapis.com')) {
        try {
            const imageRef = ref(storage, card.imageUrl);
            await deleteObject(imageRef);
        } catch (error) {
            console.warn(`Could not delete image ${card.imageUrl} from Storage. It might not exist.`, error);
        }
    }

    await getCards(true);
};

// --- Chat ---

// Create or get a chat room between two users
export const getOrCreateChatRoom = async (user1Id: string, user2Id: string): Promise<string> => {
    const members = [user1Id, user2Id].sort();
    const chatRoomId = members.join('-');
    const chatRoomRef = doc(db, 'chatRooms', chatRoomId);
    const chatRoomSnap = await getDoc(chatRoomRef);

    if (!chatRoomSnap.exists()) {
        const user1Profile = await getUserProfile(user1Id);
        const user2Profile = await getUserProfile(user2Id);

        if (!user1Profile || !user2Profile) {
            throw new Error("One or more user profiles not found.");
        }

        await setDoc(chatRoomRef, {
            participantIds: members,
            participantsInfo: {
                [user1Id]: { displayName: user1Profile.displayName, photoURL: user1Profile.photoURL },
                [user2Id]: { displayName: user2Profile.displayName, photoURL: user2Profile.photoURL }
            },
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastMessage: '',
        });
    }

    return chatRoomId;
};

// Listen for a user's chat rooms
export const subscribeToChatRooms = (userId: string, callback: (rooms: ChatRoom[]) => void) => {
    const q = query(
        collection(db, 'chatRooms'),
        where('participantIds', 'array-contains', userId)
    );

    return onSnapshot(q, (querySnapshot) => {
        const rooms: ChatRoom[] = [];
        querySnapshot.forEach((doc) => {
            rooms.push({ id: doc.id, ...doc.data() } as ChatRoom);
        });
        // Sort rooms by updatedAt timestamp on the client-side
        const sortedRooms = rooms.sort((a, b) => {
            const timeA = a.updatedAt?.toMillis() || 0;
            const timeB = b.updatedAt?.toMillis() || 0;
            return timeB - timeA;
        });
        callback(sortedRooms);
    });
};

// Listen for messages in a specific chat room
export const subscribeToMessages = (chatRoomId: string, callback: (messages: ChatMessage[]) => void) => {
    const messagesRef = collection(db, 'chatRooms', chatRoomId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'), limit(100));

    return onSnapshot(q, (querySnapshot) => {
        const messages: ChatMessage[] = [];
        querySnapshot.forEach((doc) => {
            messages.push({ id: doc.id, ...doc.data() } as ChatMessage);
        });
        callback(messages);
    });
};

// Send a message
export const sendMessage = async (chatRoomId: string, senderId: string, text: string, senderInfo: { displayName: string, photoURL: string }) => {
    const messagesRef = collection(db, 'chatRooms', chatRoomId, 'messages');
    const chatRoomRef = doc(db, 'chatRooms', chatRoomId);

    const messageData = {
        senderId,
        text,
        createdAt: serverTimestamp(),
    };

    await addDoc(messagesRef, messageData);
    
    // Update the chat room's last message and timestamp
    await updateDoc(chatRoomRef, {
        lastMessage: text,
        updatedAt: serverTimestamp(),
        // Make sure participantsInfo is up-to-date
        [`participantsInfo.${senderId}`]: senderInfo
    });
};
