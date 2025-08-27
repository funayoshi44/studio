
"use client";

import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user?.isAdmin) {
      // If not loading and user is not an admin, redirect to home
      router.replace("/");
    }
  }, [user, loading, router]);

  if (loading || !user?.isAdmin) {
    // Show a loading indicator or a blank screen while checking auth
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  // If user is an admin, render the children
  return <>{children}</>;
}
