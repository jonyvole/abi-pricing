import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/apiClient";
import PriceChart from "../components/PriceChart";
import JonyVoleBanner from "../components/JonyVoleBanner";
import { Crosshair, Settings, ExternalLink } from "lucide-react";

export default function Dashboard() {
  const [categories, setCategories] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [chartData, setChartData] = useState({ items: [], rows: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/categories");
        setCategories(res.data);
        if (res.data.length > 0) setActiveId(res.data[0].id);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!activeId) return;
    (async () => {
      try {
        const res = await api.get(`/chart-data/${activeId}`);
        setChartData(res.data);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [activeId]);

  const activeCategory = categories.find((c) => c.id === activeId);

  return (
    <div className="min-h-screen bg-bg" data-testid="dashboard">
      {/* Top bar */}
      <header className="border-b border-tac" style={{ borderColor: "#272A30" }}>
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Crosshair size={22} color="#FFB300" />
            <div>
              <div className="font-heading uppercase text-lg sm:text-xl font-black tracking-tighter leading-none">
                ABI Pricing
              </div>
              <div className="data-label leading-none mt-1">Through Time</div>
            </div>
          </div>
          <Link
            to="/admin"
            data-testid="nav-admin-link"
            className="tac-btn-secondary text-xs flex items-center gap-2"
          >
            <Settings size={14} /> Admin
          </Link>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        {/* JonyVole banner pinned top */}
        <div className="mb-6">
          <JonyVoleBanner />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6">
          {/* Sidebar */}
          <aside className="md:col-span-3 lg:col-span-3 tac-card p-0" data-testid="category-sidebar">
            <div className="px-4 py-3 border-b" style={{ borderColor: "#272A30" }}>
              <div className="data-label">Categories</div>
            </div>
            <nav className="flex md:block overflow-x-auto md:overflow-visible">
              {loading && (
                <div className="px-4 py-3 text-muted-tac text-sm">Loading...</div>
              )}
              {!loading && categories.length === 0 && (
                <div className="px-4 py-3 text-muted-tac text-sm">No categories. Add some in Admin.</div>
              )}
              {categories.map((c) => (
                <button
                  key={c.id}
                  data-testid={`category-tab-${c.slug}`}
                  onClick={() => setActiveId(c.id)}
                  className={`sidebar-tab whitespace-nowrap w-full text-left ${activeId === c.id ? "active" : ""}`}
                >
                  {c.name}
                </button>
              ))}
            </nav>
          </aside>

          {/* Chart area */}
          <main className="md:col-span-9 lg:col-span-9 space-y-4">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div>
                <div className="data-label">Market Price Chart</div>
                <h1
                  data-testid="active-category-title"
                  className="font-heading uppercase text-3xl sm:text-4xl font-black tracking-tighter mt-1"
                >
                  {activeCategory ? activeCategory.name : "—"}
                </h1>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono text-muted-tac">
                <span>Tracked Items: <span className="text-white">{chartData.items.length}</span></span>
                <span className="opacity-40">|</span>
                <span>Data Points: <span className="text-white">{chartData.rows.length}</span></span>
              </div>
            </div>

            <PriceChart items={chartData.items} rows={chartData.rows} />

            {/* Items legend / table */}
            {chartData.items.length > 0 && (
              <div className="tac-card p-0 overflow-hidden" data-testid="items-table">
                <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "#272A30" }}>
                  <div className="data-label">Items in {activeCategory?.name}</div>
                  <Link to="/admin" className="text-xs font-mono tac-link flex items-center gap-1">
                    Add data <ExternalLink size={12} />
                  </Link>
                </div>
                <div className="divide-y" style={{ borderColor: "#272A30" }}>
                  {chartData.items.map((it, idx) => {
                    const last = [...chartData.rows].reverse().find((r) => r[it.id] !== undefined);
                    const first = chartData.rows.find((r) => r[it.id] !== undefined);
                    const lastVal = last ? last[it.id] : null;
                    const firstVal = first ? first[it.id] : null;
                    const delta = lastVal != null && firstVal != null ? lastVal - firstVal : null;
                    const pct = lastVal != null && firstVal != null && firstVal !== 0
                      ? ((lastVal - firstVal) / firstVal) * 100
                      : null;
                    return (
                      <div
                        key={it.id}
                        className="grid grid-cols-12 items-center px-4 py-3 hover:bg-surface-2 transition-colors"
                        style={{ borderColor: "#272A30" }}
                      >
                        <div className="col-span-1 flex items-center">
                          <span
                            className="inline-block w-3 h-3"
                            style={{ background: it.color || "#FFB300" }}
                          />
                        </div>
                        <div className="col-span-5 sm:col-span-6 font-body font-semibold text-sm sm:text-base">
                          {it.name}
                        </div>
                        <div className="col-span-3 sm:col-span-3 font-mono text-right text-sm">
                          {lastVal != null ? lastVal.toLocaleString() : <span className="text-muted-tac">—</span>}
                        </div>
                        <div className="col-span-3 sm:col-span-2 font-mono text-right text-xs">
                          {pct != null ? (
                            <span style={{ color: pct >= 0 ? "#4CAF50" : "#FF3B30" }}>
                              {pct >= 0 ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-muted-tac">—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </main>
        </div>

        <footer className="mt-12 pt-6 border-t text-center" style={{ borderColor: "#272A30" }}>
          <div className="data-label">ABI Pricing Through Time</div>
          <div className="text-muted-tac text-xs mt-2 font-mono">
            Track in-game prices. Stay informed. Use creator code{" "}
            <a
              href="https://www.arenabreakoutinfinite.com/creatorcode/index.html?codeid=JonyVole"
              target="_blank"
              rel="noopener noreferrer"
              className="tac-link"
            >
              JonyVole
            </a>
            .
          </div>
        </footer>
      </div>
    </div>
  );
}
