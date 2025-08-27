
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

// Represents a single card's data stored in Firestore
export type CardData = {
    id: string;
    name: string; // e.g., "Ace of Spades"
    gameType: GameType | 'common'; // Which game this card belongs to, or 'common'
    suit: string; // '♠️', '♥️', '♦️', '♣️', '⭐' or 'duel'
    rank: string; // 'A', '2', 'K' or '1' to '13'
    value: number;
    imageUrl: string;
};
