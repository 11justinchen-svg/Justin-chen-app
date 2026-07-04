import LegoHero from "./components/LegoHero";
import BrickCollage from "./components/BrickCollage";

export default function Home() {
  return (
    <>
      <LegoHero />
      <BrickCollage />
      {/* future content */}
      <section className="h-screen bg-[#0a0a0c]" />
    </>
  );
}
