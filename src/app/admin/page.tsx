
"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FilePlus2, List, Megaphone, Library } from "lucide-react";

export default function AdminPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Manage Announcements</CardTitle>
            <CardDescription>
              Create, edit, or delete announcements for all users.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/announcements">
              <Button className="w-full">
                <Megaphone className="mr-2 h-4 w-4" />
                Manage Announcements
              </Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Manage Series</CardTitle>
            <CardDescription>
              Add, edit, or delete card series.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/series">
              <Button className="w-full">
                <Library className="mr-2 h-4 w-4" />
                Manage Series
              </Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Add New Card</CardTitle>
            <CardDescription>
              Add a new card to the Firestore database.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/cards">
              <Button className="w-full" variant="secondary">
                <FilePlus2 className="mr-2 h-4 w-4" />
                Add Card
              </Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>View & Manage Cards</CardTitle>
            <CardDescription>
              View, edit, and delete existing cards.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/cards/list">
              <Button className="w-full" variant="secondary">
                <List className="mr-2 h-4 w-4" />
                View Card List
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
