"use client";

import Link from "next/link"
import { useState, useContext, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const { logIn, user } = useContext(AuthContext);
  const [username, setUsername] = useState('');
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
     if (!username.trim()) {
      toast({
        title: "Registration Failed",
        description: "Please enter a username.",
        variant: "destructive",
      });
      return;
    }
    logIn(username);
  };
  
  if (user) {
    return null;
  }

  return (
    <div className="flex items-center justify-center py-12">
      <Card className="mx-auto max-w-sm w-full">
        <CardHeader>
          <CardTitle className="text-xl">Sign Up</CardTitle>
          <CardDescription>
            Enter a username to create an account.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <form onSubmit={handleRegister} className="grid gap-4">
                 <div className="grid gap-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                        id="username"
                        placeholder="Your name"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                    />
                </div>
                <Button type="submit" className="w-full">
                    Sign Up
                </Button>
            </form>
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
