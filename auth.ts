import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import {
  users, accounts, authenticators, sessions, verificationTokens,
} from "@/db/schema";
import type { EmailConfig } from "next-auth/providers/email";
import GoogleProvider from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    authenticatorsTable: authenticators,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
    // @auth/drizzle-adapter's bundled types lag behind drizzle-orm's generics.
    // Runtime shape verified against Auth.js defaults — TODO: remove cast
    // when the adapter ships updated types.
  } as any),
  providers: [
        GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Vincula la cuenta Google a un usuario existente con el mismo email
      // (ej: tu cuenta creada vía magic link). Seguro aquí: Google verifica
      // que el email realmente pertenece a quien inicia sesión.
      allowDangerousEmailAccountLinking: true,
    }),
    // Raw provider object instead of EmailProvider({...}).
    // Providers are plain config; the EmailProvider factory adds defaults
    // AND (in current versions) throws at construction unless an SMTP
    // `server` is configured — even when you supply your own
    // sendVerificationRequest. Defining the object directly bypasses
    // the factory entirely.
    {
      id: "email",
      name: "Email",
      type: "email",
      from: "Recall <onboarding@resend.dev>",
      maxAge: 60 * 60, // magic links valid for 1 hour
      async sendVerificationRequest({ identifier, url }) {
        const apiKey = process.env.RESEND_API_KEY;

        // DEV: no email service → print the link to the terminal instead
        if (!apiKey) {
          if (process.env.NODE_ENV === "production") {
            throw new Error("RESEND_API_KEY is not set — email delivery not configured");
          }
          console.log(`
────────────────── ✉️  MAGIC LINK ──────────────────
  To:   ${identifier}
  Link: ${url}
  (Ctrl+Click it — VS Code terminals make links clickable)
───────────────────────────────────────────────────`);
          return;
        }

        // PRODUCTION: send real email via Resend's REST API
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Recall <onboarding@resend.dev>",
            to: identifier,
            subject: "Your Recall login link",
            html: `
              <h2>Sign in to Recall</h2>
              <p><a href="${url}">Click here to sign in</a></p>
              <p style="color:#666">This link expires in 1 hour and only works once.</p>
            `,
          }),
        });

        if (!res.ok) {
          throw new Error(`Resend error ${res.status}: ${await res.text()}`);
        }
      },
    } satisfies EmailConfig,
  ],
  pages: {
    signIn: "/login",
    verifyRequest: "/verify",
  },
  trustHost: true,
});