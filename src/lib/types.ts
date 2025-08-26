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
