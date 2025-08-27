

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

// Represents the user profile
export type MockUser = {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  bio?: string; // Optional bio field
  isAdmin?: boolean; // Admin flag
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
    createdAt: any; // Firestore Timestamp
    likes: string[]; // Array of user UIDs who liked it
    likeCount: number;
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
