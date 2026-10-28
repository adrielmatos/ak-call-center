"use client";

import { useState } from "react";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import MetricsBar from "@/components/landing/MetricsBar";
import RoiCalculator from "@/components/landing/RoiCalculator";
import FeaturesGrid from "@/components/landing/FeaturesGrid";
import ComparisonTable from "@/components/landing/ComparisonTable";
import Pricing from "@/components/landing/Pricing";
import FaqAccordion from "@/components/landing/FaqAccordion";
import Footer from "@/components/landing/Footer";
import DemoModal from "@/components/landing/DemoModal";

export default function RootLandingPage() {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [modalDefaultMessage, setModalDefaultMessage] = useState<string | undefined>();

  const handleOpenDemoModal = (customMessage?: string) => {
    setModalDefaultMessage(customMessage);
    setIsDemoModalOpen(true);
  };

  const handleCloseDemoModal = () => {
    setIsDemoModalOpen(false);
    setModalDefaultMessage(undefined);
  };

  return (
    <main className="min-h-screen bg-[#040814] text-slate-100 flex flex-col justify-between selection:bg-amber-400 selection:text-slate-950 font-sans">
      <Navbar onOpenDemoModal={() => handleOpenDemoModal()} />
      
      <div className="flex-1">
        <Hero onOpenDemoModal={() => handleOpenDemoModal()} />
        <MetricsBar />
        <RoiCalculator onOpenDemoModal={handleOpenDemoModal} />
        <FeaturesGrid onOpenDemoModal={() => handleOpenDemoModal()} />
        <ComparisonTable onOpenDemoModal={() => handleOpenDemoModal()} />
        <Pricing onOpenDemoModal={handleOpenDemoModal} />
        <FaqAccordion onOpenDemoModal={() => handleOpenDemoModal()} />
      </div>

      <Footer />

      <DemoModal
        isOpen={isDemoModalOpen}
        onClose={handleCloseDemoModal}
        defaultMessage={modalDefaultMessage}
      />
    </main>
  );
}
