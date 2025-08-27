
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
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { uploadProfileImage } from '@/lib/firestore';
import type { MockUser } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

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
  firebaseUser: User | null;
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
  firebaseUser: null,
  loading: true,
  logInWithGoogle: async () => {},
  logInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  logInAsGuest: async () => {},
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
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setLoading(true);
      if (fbUser) {
        setFirebaseUser(fbUser);
        const userDocRef = doc(db, 'users', fbUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          setUser(userDocSnap.data() as MockUser);
        } else if (fbUser.isAnonymous) {
           const guestProfile: MockUser = {
            uid: fbUser.uid,
            displayName: 'Guest',
            email: '',
            photoURL: `https://i.pravatar.cc/150?u=${fbUser.uid}`,
            bio: 'A guest user.',
            isGuest: true,
            isAdmin: false,
          };
          await setDoc(userDocRef, { ...guestProfile, createdAt: serverTimestamp() });
          setUser(guestProfile);
        }
        // User is authenticated with a provider (e.g. Google) but doc doesn't exist.
        else if (fbUser.providerData.length > 0) {
           const newUserProfile: MockUser = {
            uid: fbUser.uid,
            displayName: fbUser.displayName || 'Anonymous',
            email: fbUser.email || '',
            photoURL: fbUser.photoURL || `https://i.pravatar.cc/150?u=${fbUser.uid}`,
            bio: '',
            isGuest: false,
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
  
  const handleAuthSuccess = (message: string) => {
      router.push('/');
      toast({ title: message, description: "Welcome to CardVerse!" });
  }

  const handleAuthError = (error: any, message: string) => {
      console.error(`${message} failed:`, error);
      toast({ title: `${message} Failed`, description: error.message || `Could not complete the action.`, variant: 'destructive' });
  }

  const logInWithGoogle = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged handles success
    } catch (error) {
      handleAuthError(error, "Google Login");
    } finally {
      setLoading(false);
    }
  };
  
  const logInWithEmail = async ({ email, password }: EmailPassCredentials) => {
    if(!password) return;
    setLoading(true);
    try {
        await signInWithEmailAndPassword(auth, email, password);
        handleAuthSuccess("Login Successful");
    } catch (error) {
        handleAuthError(error, "Email/Password Login");
    } finally {
        setLoading(false);
    }
  }

  const signUpWithEmail = async ({ email, password, displayName }: EmailPassCredentials) => {
      if(!password || !displayName) return;
      setLoading(true);
      try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const fbUser = userCredential.user;
          // Create user profile in Firestore
          const newUserProfile: MockUser = {
            uid: fbUser.uid,
            displayName: displayName,
            email: fbUser.email || '',
            photoURL: `https://i.pravatar.cc/150?u=${fbUser.uid}`, // Default avatar
            bio: '',
            isGuest: false,
            isAdmin: false,
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
      setLoading(true);
      try {
          await signInAnonymously(auth);
          // onAuthStateChanged will handle profile creation
          handleAuthSuccess("Logged in as Guest");
      } catch (error) {
          handleAuthError(error, "Guest Login");
      } finally {
          setLoading(false);
      }
  }


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
        setIsLoading(false);
    }
  };


  const logOut = async () => {
    const wasGuest = user?.isGuest;
    const userToDelete = firebaseUser; // Capture before state changes
    try {
        await signOut(auth);
        if (wasGuest && userToDelete) {
           // Optionally delete guest data from firestore upon logout
           // await deleteDoc(doc(db, 'users', userToDelete.uid));
           // await userToDelete.delete(); // This deletes the auth user
        }
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
