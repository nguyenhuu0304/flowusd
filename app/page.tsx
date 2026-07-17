import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Hero from "@/components/marketing/Hero";
import Features from "@/components/marketing/Features";

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <Navbar />

      <Hero />

      <Features />

      <Footer />
    </main>
  );
}