"use server";

import { signIn } from "@/auth";
import { redirect } from "next/navigation";

export async function login(formData: FormData) {
  await signIn("email", {
    email: formData.get("email") as string,
    redirect: false,
  });
  redirect("/verify");
}

export async function googleLogin() {
  await signIn("google", { redirectTo: "/" });
}