
import type { Timestamp } from 'firebase/firestore';

export type Difficulty = "easy" | "normal" | "hard";
export type Language = "en" | "ja";
export type GameType = "duel" | "janken" | "poker";

export type HistoryStats = {
  wins: number;
  losses: number;
};

export type GameHistory = {
  [game in GameType]: {
    [diff in Difficulty]: HistoryStats;
  };
};

// Represents the user profile stored in Firestore
export type MockUser = {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  bio?: string; // Optional bio field
  isAdmin: boolean; // Admin flag
  isGuest?: boolean; // Guest flag
  myCards?: string[]; // Array of Card IDs
  points?: number; // User points
  lastLogin?: Timestamp; // For daily login bonus
};

// Represents a custom janken action created by a user
export type JankenAction = {
    id: string;
    userId: string;
    type: 'rock' | 'paper' | 'scissors';
    title: string;
    comment: string;
    imageUrl: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// Represents a post on the bulletin board
export type Post = {
    id: string;
    author: {
        uid: string;
        displayName: string;
        photoURL: string;
    };
    content: string;
    createdAt: Timestamp;
    likes: string[]; // Array of user UIDs who liked it
    likeCount: number;
    // parentId: string | null;
    // replyCount: number;
};

// Represents a single announcement from admins
export type Announcement = {
    id:string;
    author: {
        uid: string;
        displayName: string;
    };
    title: string;
    content: string;
    createdAt: Timestamp;
    updatedAt?: Timestamp;
}

// Represents a single card's data stored in Firestore, based on user's detailed spec
export type CardData = {
    id: string;
    frontImageUrl: string;
    backImageUrl?: string;
    suit: string;
    rank: number | string; // 1-13 or 'Joker'
    title: string;
    caption: string;
    hashtags: string[];
    seriesName: string;
    authorName: string;
    authorId: string;
    detailPageUrl?: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    
    // Optional, for future extension
    isPublic?: boolean;
    likesCount?: number;
    commentsCount?: number;
    ownedByUserIds?: string[];
    viewsCount?: number;
    tagsForSearch?: string[];

    // --- Deprecated fields for compatibility ---
    // These fields will be phased out.
    // For now, they can be derived from the new fields.
    number: number; // Will be derived from 'rank'
    value: number; // Will be derived from 'rank'
    name: string; // Will be derived from 'title'
    artist: string; // Will be derived from 'authorName'
    imageUrl: string; // Will be derived from 'frontImageUrl'
    rarity: 'common' | 'uncommon' | 'rare' | 'legendary'; // This might be a separate concept now
    tags: string[]; // will be derived from 'hashtags'
    gameType: GameType | 'common'; // can be derived or set based on series
};

// Represents a single Card Series' data stored in Firestore
export type CardSeries = {
    id: string;
    name: string;
    createdAt: Timestamp;
    // description?: string; // Optional for future use
}


// --- Online Game Types ---

export interface Game {
  id: string;
  gameType: GameType;
  players: { [uid: string]: Partial<MockUser> };
  playerIds: string[];
  status: 'waiting' | 'in-progress' | 'finished';
  createdAt: Timestamp;
  gameState: any;
  winner?: string | 'draw' | null;
  maxPlayers?: number;
}

export type OnlineGameRecord = {
    id: string;
    gameType: GameType;
    opponent: {
        uid: string;
        displayName: string;
        photoURL: string;
    };
    result: 'win' | 'loss' | 'draw';
    playedAt: Date;
}


// --- Chat Types ---

export type ChatRoom = {
    id: string;
    participantIds: string[];
    participantsInfo: {
        [uid: string]: {
            displayName: string;
            photoURL: string;
        }
    };
    lastMessage: string;
    updatedAt: Timestamp;
};

export type ChatMessage = {
    id: string;
    senderId: string;
    text: string;
    createdAt: Timestamp;
};
