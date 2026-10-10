import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { googleLogin, login } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Sign in to Recall</CardTitle>
          <CardDescription>
            One click with Google, or a magic link — no passwords, ever.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={googleLogin}>
            <Button variant="outline" type="submit" className="w-full">
              Continue with Google
            </Button>
          </form>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or with email</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form action={login} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>
            <Button type="submit" className="w-full">Send magic link</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}