
"use client";

import { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db, googleProvider } from '@/lib/firebase';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { uploadProfileImage } from '@/lib/firestore';
import type { MockUser } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

type UpdateUserInput = {
  displayName: string;
  bio: string;
  profileImage?: File | null;
}

type AuthContextType = {
  user: MockUser | null;
  firebaseUser: User | null;
  loading: boolean;
  logInWithGoogle: () => Promise<void>;
  logOut: () => void;
  updateUser: (data: UpdateUserInput) => Promise<void>;
};

export const AuthContext = createContext<AuthContextType>({
  user: null,
  firebaseUser: null,
  loading: true,
  logInWithGoogle: async () => {},
  logOut: () => {},
  updateUser: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [user, setUser] = useState<MockUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setFirebaseUser(user);
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          setUser(userDocSnap.data() as MockUser);
        } else {
          // Create a new user profile in Firestore if it doesn't exist
          const newUserProfile: MockUser = {
            uid: user.uid,
            displayName: user.displayName || 'Anonymous',
            email: user.email || '',
            photoURL: user.photoURL || `https://i.pravatar.cc/150?u=${user.uid}`,
            bio: '',
            isAdmin: false, // Default value
          };
          await setDoc(userDocRef, { ...newUserProfile, createdAt: serverTimestamp() });
          setUser(newUserProfile);
        }
      } else {
        setFirebaseUser(null);
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);
  
  const logInWithGoogle = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged will handle the rest
      router.push('/');
      toast({ title: "Login Successful", description: "Welcome back!" });
    } catch (error) {
      console.error("Google login failed:", error);
      toast({ title: "Login Failed", description: "Could not log in with Google.", variant: 'destructive' });
      setLoading(false);
    }
  };

  const updateUser = async (data: UpdateUserInput) => {
    if (!user) return;

    setLoading(true);
    let newPhotoURL = user.photoURL;

    try {
        if (data.profileImage) {
            newPhotoURL = await uploadProfileImage(user.uid, data.profileImage);
        }

        const updatedUser: MockUser = {
            ...user,
            displayName: data.displayName,
            photoURL: newPhotoURL,
            bio: data.bio,
        };
        
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, updatedUser, { merge: true });
        setUser(updatedUser);

    } catch (error) {
        console.error("Failed to update user:", error);
        throw error;
    } finally {
        setLoading(false);
    }
  };


  const logOut = async () => {
    try {
        await signOut(auth);
        router.push('/login');
    } catch (error) {
        console.error("Failed to log out", error);
    }
  };

  const value = {
    user,
    firebaseUser,
    loading,
    logInWithGoogle,
    logOut,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};
