

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
import type { Game, GameType, MockUser, Post, CardData, ChatRoom, ChatMessage, Announcement, JankenAction, CardSeries } from './types';
import { createPokerDeck, evaluatePokerHand } from './game-logic/poker';


const CARDS_COLLECTION = process.env.NEXT_PUBLIC_CARDS_COLLECTION_NAME || 'cards';
const SERIES_COLLECTION = 'series';


// --- Point System ---
export const awardPoints = async (userId: string, amount: number) => {
    if (!userId || !db) return;
    // This function should ideally be a server-side Cloud Function
    // to prevent client-side manipulation. For now, it's here.
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
        points: increment(amount)
    });
};

// Listen for game updates (deprecated for sharded model)
export const subscribeToGame = (gameId: string, callback: (game: Game | null) => void) => {
  if (!db) return () => {};
  const gameRef = doc(db, 'games', gameId);
  return onSnapshot(gameRef, (docSnap) => {
    if (docSnap.exists()) {
      callback({ id: docSnap.id, ...docSnap.data() } as Game);
    } else {
      callback(null);
    }
  });
};

// Update a single document
export const updateGameState = async (gameId: string, updates: any): Promise<void> => {
  if (!db) return;
  const gameRef = doc(db, 'games', gameId);
  await updateDoc(gameRef, { gameState: updates });
};

// Update multiple sharded state documents
export const updateShardedGameState = async (gameId: string, payload: any) => {
    if (!db) return;
    const batch = writeBatch(db);
    
    for (const key in payload) {
        if (key === 'hands' || key === 'moves') {
             for (const playerId in payload[key]) {
                const subDocRef = doc(db, 'games', gameId, key, playerId);
                if (payload[key][playerId] === null) {
                    batch.set(subDocRef, { card: null });
                } else if (Array.isArray(payload[key][playerId])) {
                    batch.set(subDocRef, { cards: payload[key][playerId] });
                } else {
                    batch.set(subDocRef, { card: payload[key][playerId] });
                }
            }
        } else {
             const stateSubDocRef = doc(db, 'games', gameId, 'state', key);
             batch.set(stateSubDocRef, payload[key], { merge: true });
        }
    }
    await batch.commit();
}


// Submit a move to its own document
export const submitMove = async (gameId: string, userId: string, move: any) => {
    if (!db) return;
    const moveDocRef = doc(db, 'games', gameId, 'moves', userId);
    await setDoc(moveDocRef, { card: move });
    
    const mainStateRef = doc(db, 'games', gameId, 'state', 'main');
    await updateDoc(mainStateRef, { lastMoveBy: userId });
};

// Upload a profile image and get the URL
export const uploadProfileImage = async (userId: string, file: File): Promise<string> => {
    if (!storage) throw new Error("Firebase Storage is not initialized.");
    const storageRef = ref(storage, `profileImages/${userId}/${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
};

// Get a single user's profile
export const getUserProfile = async (userId: string): Promise<MockUser | null> => {
    if (!db) return null;
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
        return userSnap.data() as MockUser;
    }
    return null;
}

// Update a user's myCards
export const updateMyCards = async (userId: string, cardIds: string[]): Promise<void> => {
    if (!db) return;
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
        myCards: cardIds,
    });
};

// --- Janken Actions ---
export const setJankenAction = async (
    userId: string, 
    type: 'rock' | 'paper' | 'scissors',
    data: { title: string, comment: string },
    imageFile: File | null
): Promise<void> => {
    if (!db || !storage) return;
    const docId = `${userId}_${type}`;
    const actionRef = doc(db, 'jankenActions', docId);

    const actionData: Partial<JankenAction> = {
        userId,
        type,
        title: data.title,
        comment: data.comment,
        updatedAt: serverTimestamp(),
    };

    if (imageFile) {
        const storageRef = ref(storage, `jankenActions/${userId}/${type}_${Date.now()}`);
        const snapshot = await uploadBytes(storageRef, imageFile);
        actionData.imageUrl = await getDownloadURL(snapshot.ref);
    }

    await setDoc(actionRef, actionData, { merge: true });
};

export const getJankenActions = async (userId: string): Promise<{ [key in 'rock' | 'paper' | 'scissors']?: JankenAction }> => {
    if (!db) return {};
    const actions: { [key in 'rock' | 'paper' | 'scissors']?: JankenAction } = {};
    const q = query(collection(db, 'jankenActions'), where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
        const data = doc.data() as JankenAction;
        actions[data.type] = { id: doc.id, ...data };
    });
    return actions;
};


// --- Posts (Bulletin Board) ---

export const createPost = async (author: MockUser, content: string): Promise<void> => {
    if (!db) return;
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
  if (!db) return () => {};
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
    if (!db) return () => {};
    const postsCollection = collection(db, 'posts');
    const q = query(
        postsCollection, 
        where('author.uid', '==', userId),
        limit(50)
    );

    return onSnapshot(q, (snapshot) => {
        const posts: Post[] = [];
        snapshot.forEach((doc) => {
            posts.push({ id: doc.id, ...doc.data() } as Post);
        });
        const sortedPosts = posts.sort((a, b) => {
            const timeA = a.createdAt?.toMillis() || 0;
            const timeB = b.createdAt?.toMillis() || 0;
            return timeB - timeA;
        });
        callback(sortedPosts);
    });
};


// Like/Unlike a post
export const togglePostLike = async (postId: string, userId: string): Promise<void> => {
    if (!db) return;
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
    if (!db) return;
    const postRef = doc(db, 'posts', postId);
    await deleteDoc(postRef);
};



// --- Card Management ---

const deriveCompatibilityFields = (card: Omit<CardData, 'id'>, id: string): CardData => {
    const rankNumber = typeof card.rank === 'number' ? card.rank : (card.rank === 'Joker' ? 0 : -1);
    return {
        ...card,
        id: id,
        number: rankNumber,
        value: rankNumber, // Assuming value is the same as number for now
        name: card.title,
        artist: card.authorName,
        imageUrl: card.frontImageUrl,
        rarity: 'common', // Default rarity, could be a field in the new structure later
        tags: card.hashtags,
        gameType: 'common', // Default gameType, can be derived or set based on series or tags later
    };
};

export const getCards = async (forceRefresh: boolean = false): Promise<CardData[]> => {
    if (!db) return [];
    const cardsCollection = collection(db, CARDS_COLLECTION);
    const querySnapshot = await getDocs(cardsCollection);
    const cards: CardData[] = [];
    querySnapshot.forEach((doc) => {
        const data = doc.data() as Omit<CardData, 'id'>;
        cards.push(deriveCompatibilityFields(data, doc.id));
    });
    return cards;
};

export const getCardById = async (id: string): Promise<CardData | null> => {
    if (!db) return null;
    const cardRef = doc(db, CARDS_COLLECTION, id);
    const docSnap = await getDoc(cardRef);

    if (docSnap.exists()) {
        return deriveCompatibilityFields(docSnap.data() as Omit<CardData, 'id'>, docSnap.id);
    }

    return null;
}


export const addCard = async (
  cardData: Omit<CardData, 'id' | 'frontImageUrl' | 'backImageUrl' | 'createdAt' | 'updatedAt' | 'authorId'>,
  imageFile: File,
  author: MockUser,
  backImageFile?: File | null
): Promise<void> => {
  if (!db || !storage) return;
  const filePath = `${CARDS_COLLECTION}/${Date.now()}_${imageFile.name}`;
  const imageRef = ref(storage, filePath);
  const uploadResult = await uploadBytes(imageRef, imageFile);
  const imageUrl = await getDownloadURL(uploadResult.ref);
  
  const cardToSave: any = {
    ...cardData,
    frontImageUrl: imageUrl,
    authorId: author.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (backImageFile) {
      const backFilePath = `${CARDS_COLLECTION}/backs/${Date.now()}_${backImageFile.name}`;
      const backImageRef = ref(storage, backFilePath);
      const backUploadResult = await uploadBytes(backImageRef, backImageFile);
      cardToSave.backImageUrl = await getDownloadURL(backUploadResult.ref);
  }

  const cardsCollection = collection(db, CARDS_COLLECTION);
  await addDoc(cardsCollection, cardToSave);

  await getCards(true);
};


export const deleteCard = async (card: CardData): Promise<void> => {
    if (!db || !storage) return;
    const cardRef = doc(db, CARDS_COLLECTION, card.id);
    await deleteDoc(cardRef);

    if (card.frontImageUrl && card.frontImageUrl.includes('firebasestorage.googleapis.com')) {
        try {
            const imageRef = ref(storage, card.frontImageUrl);
            await deleteObject(imageRef);
        } catch (error) {
            console.warn(`Could not delete image ${card.frontImageUrl} from Storage. It might not exist.`, error);
        }
    }
     if (card.backImageUrl && card.backImageUrl.includes('firebasestorage.googleapis.com')) {
        try {
            const imageRef = ref(storage, card.backImageUrl);
            await deleteObject(imageRef);
        } catch (error) {
            console.warn(`Could not delete image ${card.backImageUrl} from Storage. It might not exist.`, error);
        }
    }


    await getCards(true);
};

// --- Series Management ---

export const getSeries = async (forceRefresh: boolean = false): Promise<CardSeries[]> => {
    if (!db) return [];
    const seriesCollection = collection(db, SERIES_COLLECTION);
    const q = query(seriesCollection, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    const series: CardSeries[] = [];
    querySnapshot.forEach((doc) => {
        series.push({ id: doc.id, ...doc.data() } as CardSeries);
    });
    return series;
}

export const addSeries = async (name: string): Promise<string> => {
    if (!db) throw new Error("Firestore is not initialized.");
    // Check if series with the same name already exists to prevent duplicates
    const seriesCollection = collection(db, SERIES_COLLECTION);
    const q = query(seriesCollection, where("name", "==", name));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        throw new Error(`Series with name "${name}" already exists.`);
    }

    const docRef = await addDoc(seriesCollection, {
        name,
        createdAt: serverTimestamp(),
    });
    return docRef.id;
}

export const deleteSeries = async (id: string): Promise<void> => {
    if (!db) return;
    // Note: This does not delete cards within the series.
    // That logic could be added here if needed (e.g., using a transaction or batch write).
    const seriesRef = doc(db, SERIES_COLLECTION, id);
    await deleteDoc(seriesRef);
}


// --- Game History ---
export const getUserGameHistory = async (userId: string): Promise<Game[]> => {
    if (!db) return [];
    const gamesCollection = collection(db, 'games');
    const q = query(
        gamesCollection,
        where('playerIds', 'array-contains', userId),
        where('status', '==', 'finished'),
        orderBy('createdAt', 'desc'),
        limit(50) 
    );

    const querySnapshot = await getDocs(q);
    const history: Game[] = [];
    querySnapshot.forEach((doc) => {
        history.push({ id: doc.id, ...doc.data() } as Game);
    });
    return history;
};


// --- Announcements ---

export const createAnnouncement = async (author: MockUser, title: string, content: string): Promise<string> => {
    if (!db) throw new Error("Firestore is not initialized.");
    const announcementCollection = collection(db, 'announcements');
    const docRef = await addDoc(announcementCollection, {
        author: {
            uid: author.uid,
            displayName: author.displayName,
        },
        title,
        content,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return docRef.id;
};

export const updateAnnouncement = async (id: string, title: string, content: string): Promise<void> => {
    if (!db) return;
    const announcementRef = doc(db, 'announcements', id);
    await updateDoc(announcementRef, {
        title,
        content,
        updatedAt: serverTimestamp(),
    });
};

export const deleteAnnouncement = async (id: string): Promise<void> => {
    if (!db) return;
    const announcementRef = doc(db, 'announcements', id);
    await deleteDoc(announcementRef);
};

export const subscribeToAnnouncements = (callback: (announcements: Announcement[]) => void) => {
    if (!db) return () => {};
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (querySnapshot) => {
        const announcements: Announcement[] = [];
        querySnapshot.forEach((doc) => {
            announcements.push({ id: doc.id, ...doc.data() } as Announcement);
        });
        callback(announcements);
    });
};

export const subscribeToLatestAnnouncements = (callback: (announcements: Announcement[]) => void) => {
    if (!db) return () => {};
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(3));
    return onSnapshot(q, (querySnapshot) => {
        const announcements: Announcement[] = [];
        querySnapshot.forEach((doc) => {
            announcements.push({ id: doc.id, ...doc.data() } as Announcement);
        });
        callback(announcements);
    });
};


// --- Chat ---

// Create or get a chat room between two users
export const getOrCreateChatRoom = async (user1Id: string, user2Id: string): Promise<string> => {
    if (!db) throw new Error("Firestore is not initialized.");
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
    if (!db) return () => {};
    const q = query(
        collection(db, 'chatRooms'),
        where('participantIds', 'array-contains', userId)
    );

    return onSnapshot(q, (querySnapshot) => {
        const rooms: ChatRoom[] = [];
        querySnapshot.forEach((doc) => {
            rooms.push({ id: doc.id, ...doc.data() } as ChatRoom);
        });

        // Sort by 'updatedAt' in descending order on the client
        rooms.sort((a, b) => {
            const timeA = a.updatedAt?.toMillis() || 0;
            const timeB = b.updatedAt?.toMillis() || 0;
            return timeB - timeA;
        });

        callback(rooms);
    });
};

// Listen for messages in a specific chat room
export const subscribeToMessages = (chatRoomId: string, callback: (messages: ChatMessage[]) => void) => {
    if (!db) return () => {};
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
    if (!db) return;
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

    

    




