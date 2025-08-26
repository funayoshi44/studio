"use client";

import Link from "next/link"
import { useContext } from "react";
import { AuthContext } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function RegisterPage() {
  const { googleSignIn, user } = useContext(AuthContext);
  const router = useRouter();
  const { toast } = useToast();

  const handleGoogleSignIn = async () => {
    try {
      await googleSignIn();
    } catch (error) {
      console.error("Google Sign In failed", error);
      toast({ title: "Sign Up Failed", description: "Could not sign up with Google.", variant: "destructive" });
    }
  };

  if (user) {
    router.push('/');
    return null;
  }

  return (
    <div className="flex items-center justify-center py-12">
      <Card className="mx-auto max-w-sm w-full">
        <CardHeader>
          <CardTitle className="text-xl">Sign Up</CardTitle>
          <CardDescription>
            Create an account using one of the providers below.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="grid gap-4">
                 <Button variant="outline" className="w-full" onClick={handleGoogleSignIn}>
                    Sign up with Google
                </Button>
            </div>
          <div className="mt-4 text-center text-sm">
            Already have an account?{" "}
            <Link href="/login" className="underline">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
