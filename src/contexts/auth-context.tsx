
"use client";

import { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { uploadProfileImage } from '@/lib/firestore';
import type { MockUser } from '@/lib/types';


type UpdateUserInput = {
  displayName: string;
  bio: string;
  profileImage?: File | null;
}

type AuthContextType = {
  user: MockUser | null;
  loading: boolean;
  logIn: (username: string, profileImage?: File | null) => Promise<void>;
  logOut: () => void;
  updateUser: (data: UpdateUserInput) => Promise<void>;
};

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logIn: async () => {},
  logOut: () => {},
  updateUser: async () => {},
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

    setLoading(true);
    // Use a more robust UID, e.g., combining username and timestamp
    const userId = `${username.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
    let photoURL = `https://i.pravatar.cc/150?u=${userId}`; 

    try {
        if (profileImage) {
            photoURL = await uploadProfileImage(userId, profileImage);
        }

        const mockUser: MockUser = {
            uid: userId,
            displayName: username,
            email: `${username.toLowerCase().replace(/\s+/g, '.')}@example.com`,
            photoURL: photoURL,
            bio: '',
        };
    
        localStorage.setItem('mockUser', JSON.stringify(mockUser));
        setUser(mockUser);
        router.push('/');
    } catch (error) {
        console.error("Failed to login or upload image", error);
    } finally {
        setLoading(false);
    }
  };

  const updateUser = async (data: UpdateUserInput) => {
    if (!user) return;

    setLoading(true);
    let newPhotoURL = user.photoURL;

    try {
        if (data.profileImage) {
            // Use the existing UID for the upload to overwrite the old image if necessary
            newPhotoURL = await uploadProfileImage(user.uid, data.profileImage);
        }

        const updatedUser: MockUser = {
            ...user,
            displayName: data.displayName,
            photoURL: newPhotoURL,
            bio: data.bio,
        };

        localStorage.setItem('mockUser', JSON.stringify(updatedUser));
        setUser(updatedUser);

    } catch (error) {
        console.error("Failed to update user:", error);
        throw error; // Re-throw to be caught in the component
    } finally {
        setLoading(false);
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
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};
