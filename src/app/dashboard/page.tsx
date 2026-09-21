import type { Metadata } from "next";
import { Header } from "@/components/header";
import { Library } from "@/components/library";
export const metadata: Metadata = { title: "My library" };
export default function DashboardPage() {
  return (
    <>
      <Header />
      <Library />
    </>
  );
}
