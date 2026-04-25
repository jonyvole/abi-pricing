import React from "react";

export default function JonyVoleBanner() {
  return (
    <a
      href="https://www.arenabreakoutinfinite.com/creatorcode/index.html?codeid=JonyVole"
      target="_blank"
      rel="noopener noreferrer"
      data-testid="jonyvole-banner"
      className="block tac-card p-0 overflow-hidden group hover:border-[#FFB300] transition-colors"
      style={{ borderColor: "#272A30" }}
    >
      <div className="relative">
        <img
          src="/assets/jonyvole-banner.png"
          alt="Use creator code JonyVole"
          className="w-full block"
          style={{ display: "block" }}
        />
        <div className="absolute inset-0 flex items-end justify-end p-3 sm:p-4 pointer-events-none">
          <div
            className="font-heading uppercase text-[10px] sm:text-xs tracking-[0.2em] font-black px-2 py-1"
            style={{ background: "#FFB300", color: "#08090A" }}
          >
            Click → Support With Code
          </div>
        </div>
      </div>
    </a>
  );
}
