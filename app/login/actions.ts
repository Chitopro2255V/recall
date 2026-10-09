"use server";

import { signIn } from "@/auth";
import { redirect } from "next/navigation";

export async function login(formData: FormData) {
  await signIn("email", {
    email: formData.get("email") as string,
    redirect: false, // don't follow Auth.js's redirect suggestion…
  });
  redirect("/verify"); // …we decide where the user goes instead
}