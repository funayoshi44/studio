
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
}
