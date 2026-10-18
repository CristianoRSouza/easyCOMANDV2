import { redirect } from "next/navigation";

/** `/` → `/dashboard`, como o `beforeLoad` de `easyCONTROL/src/routes/index.tsx`. */
export default function Home() {
  redirect("/dashboard");
}
