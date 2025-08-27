"use client";

import { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { uploadProfileImage } from '@/lib/firestore';

// 仮のユーザー情報の型
type MockUser = {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
};

type AuthContextType = {
  user: MockUser | null;
  loading: boolean;
  logIn: (username: string, profileImage?: File | null) => Promise<void>;
  logOut: () => void;
};

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logIn: async () => {},
  logOut: () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<MockUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // localStorageからユーザー情報を読み込む
    try {
      const storedUser = localStorage.getItem('mockUser');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error("Failed to parse user from localStorage", error);
      localStorage.removeItem('mockUser');
    }
    setLoading(false);
  }, []);

  const logIn = async (username: string, profileImage: File | null = null) => {
    if (!username.trim()) return;

    const userId = `${username.toLowerCase()}-${Date.now()}`; // 簡単な一意のID
    let photoURL = `https://i.pravatar.cc/150?u=${userId}`; // デフォルトアバター

    try {
        if (profileImage) {
            photoURL = await uploadProfileImage(userId, profileImage);
        }

        const mockUser: MockUser = {
            uid: userId,
            displayName: username,
            email: `${username.toLowerCase()}@example.com`,
            photoURL: photoURL,
        };
    
        localStorage.setItem('mockUser', JSON.stringify(mockUser));
        setUser(mockUser);
        router.push('/');
    } catch (error) {
        console.error("Failed to login or upload image", error);
    }
  };

  const logOut = () => {
    try {
        localStorage.removeItem('mockUser');
        setUser(null);
        router.push('/login');
    } catch (error) {
        console.error("Failed to remove user from localStorage", error);
    }
  };

  const value = {
    user,
    loading,
    logIn,
    logOut,
  };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};
