import Navbar from "@/components/layout/Navbar";
import Hero from "@/components/marketing/Hero";
import Features from "@/components/marketing/Features";
import DashboardPreview from "@/components/marketing/DashboardPreview";
import CTA from "@/components/marketing/CTA";
import Footer from "@/components/layout/Footer";

export default function Home() {
  return (
    <>
      <Navbar />

      <main>
        <Hero />

        <Features />

        <DashboardPreview />

        <CTA />
      </main>

      <Footer />
    </>
  );
}