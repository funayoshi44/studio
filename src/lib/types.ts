
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
};

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

// Represents a single card's data stored in Firestore, based on user's detailed spec
export type CardData = {
    id: string;
    gameType: GameType | 'common'; // Which game this card belongs to
    suit: string;
    number: number;
    value: number; // For game logic, might be same as number
    name: string;
    artist: string;
    imageUrl: string;
    rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
    tags: string[];
    variations?: {
        designId: string;
        imageUrl: string;
    }[];
};

// --- Online Game Types ---

export interface Game {
  id: string;
  gameType: GameType;
  players: { [uid: string]: Partial<MockUser> };
  playerIds: string[];
  status: 'waiting' | 'in-progress' | 'finished';
  createdAt: Timestamp;
  gameState: any;
  winner?: string | null; // UID of the winner
  maxPlayers?: number;
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
