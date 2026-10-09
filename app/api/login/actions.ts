"use server";

import { signIn } from "@/auth";

export async function login(formData: FormData) {
  await signIn("email", {
    email: formData.get("email") as string,
    redirectTo: "/",
  });
}