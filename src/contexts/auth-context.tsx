
"use client";

import { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db, googleProvider } from '@/lib/firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  type User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { uploadProfileImage, awardPoints } from '@/lib/firestore';
import type { MockUser } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Timestamp } from 'firebase/firestore';


type EmailPassCredentials = {
  email: string;
  password?: string; // Password is required for sign-up, optional for sign-in if not used.
  displayName?: string; // Display name is for sign-up
};


type UpdateUserInput = {
  displayName: string;
  bio: string;
  profileImage?: File | null;
}

type AuthContextType = {
  user: MockUser | null;
  loading: boolean;
  logInWithGoogle: () => Promise<void>;
  logInWithEmail: (credentials: EmailPassCredentials) => Promise<void>;
  signUpWithEmail: (credentials: EmailPassCredentials) => Promise<void>;
  logInAsGuest: () => Promise<void>;
  logOut: () => void;
  updateUser: (data: UpdateUserInput) => Promise<void>;
};

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logInWithGoogle: async () => {},
  logInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  logInAsGuest: async () => {},
  logOut: () => {},
  updateUser: async () => {},
});

const isSameDay = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
}


export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<MockUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialAuthChecked, setInitialAuthChecked] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!auth || !db) {
        setLoading(false);
        setInitialAuthChecked(true);
        return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setInitialAuthChecked(false);
      if (fbUser) {
        const userDocRef = doc(db, 'users', fbUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
        let userData: MockUser;
        const isCurrentlyAdmin = fbUser.email === adminEmail;

        if (userDocSnap.exists()) {
            userData = userDocSnap.data() as MockUser;
            if (userData.isAdmin !== isCurrentlyAdmin) {
                await updateDoc(userDocRef, { isAdmin: isCurrentlyAdmin });
                userData.isAdmin = isCurrentlyAdmin;
            }
        } else {
            userData = {
                uid: fbUser.uid,
                displayName: fbUser.displayName || (fbUser.isAnonymous ? 'Guest' : 'Anonymous'),
                email: fbUser.email || '',
                photoURL: fbUser.photoURL || `https://i.pravatar.cc/150?u=${fbUser.uid}`,
                bio: fbUser.isAnonymous ? 'A guest user.' : '',
                isGuest: fbUser.isAnonymous,
                isAdmin: isCurrentlyAdmin,
                points: 0,
                lastLogin: serverTimestamp() as Timestamp,
            };
            await setDoc(userDocRef, { ...userData, createdAt: serverTimestamp() });
        }
        
        const today = new Date();
        const lastLoginDate = userData.lastLogin?.toDate();
        
        if (!lastLoginDate || !isSameDay(lastLoginDate, today)) {
             if (!userData.isGuest) {
                await awardPoints(fbUser.uid, 1);
                userData.points = (userData.points || 0) + 1;
                toast({ title: "Login Bonus!", description: "You've received 1 point for your daily login." });
             }
        }
        
        await updateDoc(userDocRef, { lastLogin: serverTimestamp() });
        userData.lastLogin = Timestamp.now();
        
        setUser(userData);
      } else {
        setUser(null);
      }
      setLoading(false);
      setInitialAuthChecked(true);
    });

    return () => unsubscribe();
  }, [toast]);
  
  const handleAuthSuccess = (message: string) => {
      router.push('/');
      toast({ title: message, description: "Welcome to CardVerse!" });
  }

  const handleAuthError = (error: any, message: string) => {
      console.error(`${message} failed:`, error);
      toast({ title: `${message} Failed`, description: error.message || `Could not complete the action.`, variant: 'destructive' });
  }

  const logInWithGoogle = async () => {
    if (!auth || !googleProvider) return;
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      handleAuthError(error, "Google Login");
    } finally {
       setLoading(false);
    }
  };
  
  const logInWithEmail = async ({ email, password }: EmailPassCredentials) => {
    if(!password || !auth) return;
    setLoading(true);
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        handleAuthError(error, "Email/Password Login");
    } finally {
        setLoading(false);
    }
  }

  const signUpWithEmail = async ({ email, password, displayName }: EmailPassCredentials) => {
      if(!password || !displayName || !auth || !db) return;
      setLoading(true);
      try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const fbUser = userCredential.user;
          const isAdmin = fbUser.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;

          const newUserProfile: MockUser = {
            uid: fbUser.uid,
            displayName: displayName,
            email: fbUser.email || '',
            photoURL: `https://i.pravatar.cc/150?u=${fbUser.uid}`,
            bio: '',
            isGuest: false,
            isAdmin: isAdmin,
            points: 0,
            lastLogin: serverTimestamp() as Timestamp,
          };
          await setDoc(doc(db, 'users', fbUser.uid), { ...newUserProfile, createdAt: serverTimestamp() });
          
          setUser(newUserProfile);
          handleAuthSuccess("Sign-up Successful");
      } catch (error) {
          handleAuthError(error, "Email/Password Sign-up");
      } finally {
        setLoading(false);
      }
  }

  const logInAsGuest = async () => {
      if (!auth) return;
      setLoading(true);
      try {
          await signInAnonymously(auth);
      } catch (error) {
          handleAuthError(error, "Guest Login");
      } finally {
        setLoading(false);
      }
  }


  const updateUser = async (data: UpdateUserInput) => {
    if (!user || !db) return;

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
    if (!auth) return;
    const wasGuest = user?.isGuest;
    const userToDelete = auth.currentUser;
    try {
        await signOut(auth);
        if (wasGuest && userToDelete) {
        }
        router.push('/login');
    } catch (error) {
        console.error("Failed to log out", error);
    }
  };

  const value = {
    user,
    loading: loading || !initialAuthChecked, // The context is loading if the initial check hasn't completed
    logInWithGoogle,
    logInWithEmail,
    signUpWithEmail,
    logInAsGuest,
    logOut,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};
