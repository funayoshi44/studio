
"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FilePlus2 } from "lucide-react";

export default function AdminPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Card Management</CardTitle>
            <CardDescription>
              Add new cards to the Firestore database.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/cards">
              <Button className="w-full">
                <FilePlus2 className="mr-2 h-4 w-4" />
                Manage Cards
              </Button>
            </Link>
          </CardContent>
        </Card>
        {/* Future admin panels can be added here */}
      </div>
    </div>
  );
}
