
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

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<MockUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const userDocRef = doc(db, 'users', fbUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data() as MockUser;
          // Ensure isAdmin status is correctly updated on login
          const isAdmin = userData.email === adminEmail;
          if (userData.isAdmin !== isAdmin) {
            await setDoc(userDocRef, { isAdmin }, { merge: true });
            setUser({ ...userData, isAdmin });
          } else {
            setUser(userData);
          }
        } else {
          // New user (or guest) profile creation
          let newUserProfile: MockUser;
          const isAdmin = fbUser.email === adminEmail;

          if (fbUser.isAnonymous) {
             newUserProfile = {
              uid: fbUser.uid,
              displayName: 'Guest',
              email: '',
              photoURL: `https://i.pravatar.cc/150?u=${fbUser.uid}`,
              bio: 'A guest user.',
              isGuest: true,
              isAdmin: false, // Guests can't be admins
            };
          } else {
             newUserProfile = {
              uid: fbUser.uid,
              displayName: fbUser.displayName || 'Anonymous',
              email: fbUser.email || '',
              photoURL: fbUser.photoURL || `https://i.pravatar.cc/150?u=${fbUser.uid}`,
              bio: '',
              isGuest: false,
              isAdmin: isAdmin,
            };
          }
          await setDoc(userDocRef, { ...newUserProfile, createdAt: serverTimestamp() });
          setUser(newUserProfile);
        }
      } else {
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
      handleAuthSuccess("Logged in with Google");
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
        handleAuthSuccess("Logged In");
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
          
          const isAdmin = fbUser.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;

          // Create user profile in Firestore
          const newUserProfile: MockUser = {
            uid: fbUser.uid,
            displayName: displayName,
            email: fbUser.email || '',
            photoURL: `https://i.pravatar.cc/150?u=${fbUser.uid}`, // Default avatar
            bio: '',
            isGuest: false,
            isAdmin: isAdmin,
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
        setLoading(false);
    }
  };


  const logOut = async () => {
    const wasGuest = user?.isGuest;
    const userToDelete = auth.currentUser; // Capture before state changes
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
