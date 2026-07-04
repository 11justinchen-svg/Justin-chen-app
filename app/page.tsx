import LegoHero from "./components/LegoHero";
import LegoTear from "./components/LegoTear";

export default function Home() {
  return (
    <>
      {/* hero stays pinned while the lego tear climbs over it */}
      <div className="sticky top-0 h-screen">
        <LegoHero />
      </div>
      <LegoTear />
      {/* blank black page revealed by the tear (content comes later) */}
      <section className="relative z-20 min-h-screen bg-black" />
    </>
  );
}
