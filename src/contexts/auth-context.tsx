"use client";

import { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { onAuthStateChanged, User, GoogleAuthProvider, signInWithPopup, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, AuthCredential, EmailAuthProvider } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import type { EmailPasswordForm } from '@/app/login/page';
import type { RegisterForm } from '@/app/register/page';

type AuthContextType = {
  user: User | null;
  loading: boolean;
  googleSignIn: () => Promise<void>;
  logOut: () => Promise<void>;
  emailSignUp: (data: RegisterForm) => Promise<any>;
  emailSignIn: (data: EmailPasswordForm) => Promise<any>;
  updateDisplayName: (displayName: string) => Promise<void>;
};

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  googleSignIn: async () => {},
  logOut: async () => {},
  emailSignUp: async () => {},
  emailSignIn: async () => {},
  updateDisplayName: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const googleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      router.push('/');
    } catch (error) {
      console.error("Error during Google sign-in:", error);
      throw error;
    }
  };

  const emailSignUp = async (data: RegisterForm) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      await updateProfile(userCredential.user, { displayName: data.username });
       // Manually update the user state as onAuthStateChanged might not fire immediately
      setUser(auth.currentUser);
      router.push('/');
      return userCredential;
    } catch (error) {
       console.error("Error during email sign-up:", error);
       throw error;
    }
  }

  const emailSignIn = async (data: EmailPasswordForm) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
      router.push('/');
      return userCredential;
    } catch (error) {
        console.error("Error during email sign-in:", error);
        throw error;
    }
  }
  
  const updateDisplayName = async (displayName: string) => {
    if (auth.currentUser) {
      try {
        await updateProfile(auth.currentUser, { displayName });
        // Manually update the user state
        setUser({ ...auth.currentUser, displayName });
        router.push('/');
      } catch (error) {
         console.error("Error updating display name:", error);
         throw error;
      }
    }
  }

  const logOut = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser && !currentUser.displayName) {
        // router.push('/update-profile');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const value = {
    user,
    loading,
    googleSignIn,
    logOut,
    emailSignUp,
    emailSignIn,
    updateDisplayName,
  };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};