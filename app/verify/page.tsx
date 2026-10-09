import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function VerifyPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Check your inbox 📬</CardTitle>
          <CardDescription>
            We just sent you a login link. Click it and you&apos;ll be signed in.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Running locally? The link is printed in your terminal instead.
        </CardContent>
      </Card>
    </div>
  );
}