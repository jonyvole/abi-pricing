import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/apiClient";
import { Plus, Trash2, ArrowLeft, LogOut, Save, Settings as SettingsIcon } from "lucide-react";

const PALETTE = ["#FFB300", "#4CAF50", "#FF3B30", "#3DA9FC", "#B388FF", "#FFFFFF", "#00BCD4", "#FF9800"];

function Login({ onSuccess }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const res = await api.post("/admin/login", { password: pw });
      localStorage.setItem("admin_token", res.data.token);
      onSuccess();
    } catch {
      setErr("Invalid password.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <form
        onSubmit={submit}
        className="tac-card p-6 sm:p-8 w-full max-w-md"
        data-testid="admin-login-form"
      >
        <div className="data-label mb-2">Restricted Access</div>
        <h2 className="font-heading uppercase text-3xl font-black tracking-tighter mb-6">
          Operator Login
        </h2>
        <label className="data-label block mb-2">Password</label>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          className="tac-input mb-4"
          placeholder="••••••••"
          data-testid="admin-password-input"
          autoFocus
        />
        {err && <div className="text-[#FF3B30] text-sm font-mono mb-4" data-testid="admin-login-error">{err}</div>}
        <div className="flex items-center gap-3">
          <button type="submit" className="tac-btn-primary flex-1" disabled={busy} data-testid="admin-login-submit">
            {busy ? "..." : "Authenticate"}
          </button>
          <Link to="/" className="tac-btn-secondary text-xs">Cancel</Link>
        </div>
      </form>
    </div>
  );
}

function CategoryManager({ categories, refresh, activeId, setActiveId }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const order = categories.length;
      await api.post("/categories", { name: name.trim(), order });
      setName("");
      await refresh();
    } catch (e) { alert("Failed: " + (e.response?.data?.detail || e.message)); }
    finally { setBusy(false); }
  };
  const del = async (id) => {
    if (!window.confirm("Delete this category and all its items/prices?")) return;
    try {
      await api.delete(`/categories/${id}`);
      if (activeId === id) setActiveId(null);
      await refresh();
    } catch (e) { alert("Failed: " + (e.response?.data?.detail || e.message)); }
  };
  return (
    <div className="tac-card p-4 sm:p-5" data-testid="category-manager">
      <div className="data-label mb-3">Categories</div>
      <div className="flex gap-2 mb-3">
        <input
          className="tac-input"
          placeholder="New category name (e.g., Pistols)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          data-testid="new-category-input"
        />
        <button className="tac-btn-primary" onClick={add} disabled={busy} data-testid="add-category-btn">
          <Plus size={16} className="inline" />
        </button>
      </div>
      <div className="space-y-1 max-h-[480px] overflow-y-auto">
        {categories.map((c) => (
          <div
            key={c.id}
            className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors ${
              activeId === c.id ? "bg-surface-2" : "hover:bg-surface-2"
            }`}
            style={{ borderLeft: activeId === c.id ? "2px solid #FFB300" : "2px solid transparent" }}
            onClick={() => setActiveId(c.id)}
            data-testid={`admin-category-${c.slug}`}
          >
            <span className={`text-sm ${activeId === c.id ? "text-primary-amber" : ""}`}>{c.name}</span>
            <button
              className="tac-btn-danger"
              onClick={(e) => { e.stopPropagation(); del(c.id); }}
              data-testid={`delete-category-${c.slug}`}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ItemManager({ activeCategory, items, refresh }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(PALETTE[0]);
  const [busy, setBusy] = useState(false);
  const add = async () => {
    if (!activeCategory || !name.trim()) return;
    setBusy(true);
    try {
      await api.post("/items", { category_id: activeCategory.id, name: name.trim(), color });
      setName("");
      await refresh();
    } catch (e) { alert("Failed: " + (e.response?.data?.detail || e.message)); }
    finally { setBusy(false); }
  };
  const del = async (id) => {
    if (!window.confirm("Delete this item and all its price history?")) return;
    try {
      await api.delete(`/items/${id}`);
      await refresh();
    } catch (e) { alert("Failed: " + (e.response?.data?.detail || e.message)); }
  };
  if (!activeCategory) {
    return (
      <div className="tac-card p-5 text-muted-tac text-sm">
        Select a category on the left to manage its items.
      </div>
    );
  }
  return (
    <div className="tac-card p-4 sm:p-5" data-testid="item-manager">
      <div className="data-label mb-3">Items in {activeCategory.name}</div>
      <div className="flex gap-2 mb-3 flex-wrap sm:flex-nowrap">
        <input
          className="tac-input flex-1 min-w-[180px]"
          placeholder="New item name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          data-testid="new-item-input"
        />
        <div className="flex items-center gap-1">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="w-7 h-7 transition-transform"
              style={{
                background: c,
                outline: color === c ? "2px solid #FFB300" : "1px solid #272A30",
                outlineOffset: color === c ? "2px" : "0",
              }}
              data-testid={`color-${c.replace("#", "")}`}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>
        <button className="tac-btn-primary" onClick={add} disabled={busy} data-testid="add-item-btn">
          <Plus size={16} className="inline mr-1" /> Add
        </button>
      </div>
      <div className="space-y-1 max-h-[300px] overflow-y-auto">
        {items.length === 0 && <div className="text-muted-tac text-sm py-3">No items yet. Add one above.</div>}
        {items.map((it) => (
          <div
            key={it.id}
            className="flex items-center justify-between px-3 py-2 hover:bg-surface-2"
            data-testid={`admin-item-row-${it.id}`}
          >
            <div className="flex items-center gap-3">
              <span className="inline-block w-3 h-3" style={{ background: it.color || "#FFB300" }} />
              <span className="text-sm">{it.name}</span>
            </div>
            <button className="tac-btn-danger" onClick={() => del(it.id)} data-testid={`delete-item-${it.id}`}>
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PriceEditor({ activeCategory, items, chartRows, refresh }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [prices, setPrices] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setPrices({});
    setMsg("");
  }, [activeCategory?.id]);

  const submit = async () => {
    if (!activeCategory) return;
    if (!date) { alert("Pick a date"); return; }
    const filled = Object.fromEntries(Object.entries(prices).filter(([_, v]) => v !== "" && v != null));
    if (Object.keys(filled).length === 0) { alert("Enter at least one price"); return; }
    setBusy(true);
    setMsg("");
    try {
      const res = await api.post("/price-points/bulk", {
        category_id: activeCategory.id,
        date,
        prices: filled,
      });
      setMsg(`Saved ${res.data.created} price point(s) for ${date}.`);
      setPrices({});
      await refresh();
    } catch (e) {
      alert("Failed: " + (e.response?.data?.detail || e.message));
    } finally { setBusy(false); }
  };

  const delPoint = async (pid) => {
    if (!window.confirm("Delete this price point?")) return;
    try {
      await api.delete(`/price-points/${pid}`);
      await refresh();
    } catch (e) { alert("Failed: " + (e.response?.data?.detail || e.message)); }
  };

  if (!activeCategory) return null;

  return (
    <div className="tac-card p-4 sm:p-5" data-testid="price-editor">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="data-label">Add Price Snapshot</div>
        <div className="flex items-center gap-2">
          <label className="data-label">Date</label>
          <input
            type="date"
            className="tac-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ width: "auto" }}
            data-testid="snapshot-date"
          />
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-muted-tac text-sm">Add items first to record prices.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {items.map((it) => (
              <div key={it.id} className="flex items-center gap-3">
                <span className="inline-block w-3 h-3 flex-shrink-0" style={{ background: it.color || "#FFB300" }} />
                <span className="text-sm flex-1 truncate">{it.name}</span>
                <input
                  type="number"
                  step="any"
                  className="tac-input"
                  style={{ width: 140 }}
                  placeholder="price"
                  value={prices[it.id] ?? ""}
                  onChange={(e) => setPrices({ ...prices, [it.id]: e.target.value })}
                  data-testid={`price-input-${it.id}`}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button className="tac-btn-primary" onClick={submit} disabled={busy} data-testid="save-snapshot-btn">
              <Save size={14} className="inline mr-1" /> {busy ? "Saving..." : "Save Snapshot"}
            </button>
            {msg && <span className="text-[#4CAF50] font-mono text-xs" data-testid="snapshot-msg">{msg}</span>}
          </div>
        </>
      )}

      {/* History table */}
      <div className="mt-6">
        <div className="data-label mb-2">History (latest 30)</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-left text-muted-tac">
                <th className="py-2 pr-3">Date</th>
                {items.map((it) => (
                  <th key={it.id} className="py-2 pr-3 text-right">{it.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chartRows.slice(-30).reverse().map((r) => (
                <tr key={r.date} className="border-t" style={{ borderColor: "#272A30" }} data-testid={`history-row-${r.date}`}>
                  <td className="py-2 pr-3 text-white">{r.date}</td>
                  {items.map((it) => (
                    <td key={it.id} className="py-2 pr-3 text-right">
                      {r[it.id] != null ? Number(r[it.id]).toLocaleString() : <span className="text-muted-tac">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
              {chartRows.length === 0 && (
                <tr><td colSpan={items.length + 1} className="py-4 text-center text-muted-tac">No history yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function Admin() {
  const [authed, setAuthed] = useState(!!localStorage.getItem("admin_token"));
  const [categories, setCategories] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [items, setItems] = useState([]);
  const [chartRows, setChartRows] = useState([]);
  const [settings, setSettings] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState("");

  const loadCategories = async () => {
    const r = await api.get("/categories");
    setCategories(r.data);
    if (!activeId && r.data.length > 0) setActiveId(r.data[0].id);
  };

  const loadSettings = async () => {
    try {
      const r = await api.get("/settings");
      setSettings(r.data);
    } catch (e) { console.error(e); }
  };

  const loadItemsAndChart = async (cid) => {
    if (!cid) { setItems([]); setChartRows([]); return; }
    const r = await api.get(`/chart-data/${cid}`);
    setItems(r.data.items);
    setChartRows(r.data.rows);
  };

  useEffect(() => { if (authed) { loadCategories(); loadSettings(); } }, [authed]);
  useEffect(() => { if (authed && activeId) loadItemsAndChart(activeId); }, [authed, activeId]);

  if (!authed) return <Login onSuccess={() => setAuthed(true)} />;

  const activeCategory = categories.find((c) => c.id === activeId);

  const refreshAll = async () => {
    await loadCategories();
    if (activeId) await loadItemsAndChart(activeId);
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSavingSettings(true);
    setSettingsMsg("");
    try {
      const r = await api.put("/settings", settings);
      setSettings(r.data);
      setSettingsMsg("Saved. Public site updated.");
      setTimeout(() => setSettingsMsg(""), 3000);
    } catch (e) {
      alert("Failed: " + (e.response?.data?.detail || e.message));
    } finally { setSavingSettings(false); }
  };

  return (
    <div className="min-h-screen bg-bg" data-testid="admin-page">
      <header className="border-b" style={{ borderColor: "#272A30" }}>
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="tac-btn-secondary text-xs flex items-center gap-2" data-testid="back-to-dashboard">
              <ArrowLeft size={14} /> Dashboard
            </Link>
            <div>
              <div className="data-label">Operator Console</div>
              <div className="font-heading uppercase text-lg sm:text-xl font-black tracking-tighter">
                Admin Panel
              </div>
            </div>
          </div>
          <button
            className="tac-btn-secondary text-xs flex items-center gap-2"
            onClick={() => { localStorage.removeItem("admin_token"); setAuthed(false); }}
            data-testid="admin-logout"
          >
            <LogOut size={14} /> Logout
          </button>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        <div className="lg:col-span-4 space-y-4 sm:space-y-6">
          <CategoryManager
            categories={categories}
            refresh={loadCategories}
            activeId={activeId}
            setActiveId={(id) => setActiveId(id)}
          />
          {/* Site Settings */}
          <div className="tac-card p-4 sm:p-5" data-testid="site-settings">
            <div className="flex items-center gap-2 mb-3">
              <SettingsIcon size={14} color="#FFB300" />
              <div className="data-label">Site Settings (Footer)</div>
            </div>
            {!settings ? (
              <div className="text-muted-tac text-sm">Loading…</div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="data-label block mb-1">Footer Title (small label)</label>
                  <input
                    className="tac-input"
                    value={settings.footer_title || ""}
                    onChange={(e) => setSettings({ ...settings, footer_title: e.target.value })}
                    data-testid="settings-footer-title"
                  />
                </div>
                <div>
                  <label className="data-label block mb-1">Text Before Link</label>
                  <input
                    className="tac-input"
                    value={settings.footer_text_before || ""}
                    onChange={(e) => setSettings({ ...settings, footer_text_before: e.target.value })}
                    data-testid="settings-footer-before"
                  />
                </div>
                <div>
                  <label className="data-label block mb-1">Link Label</label>
                  <input
                    className="tac-input"
                    value={settings.footer_link_label || ""}
                    onChange={(e) => setSettings({ ...settings, footer_link_label: e.target.value })}
                    data-testid="settings-footer-link-label"
                  />
                </div>
                <div>
                  <label className="data-label block mb-1">Link URL</label>
                  <input
                    className="tac-input"
                    value={settings.footer_link_url || ""}
                    onChange={(e) => setSettings({ ...settings, footer_link_url: e.target.value })}
                    data-testid="settings-footer-link-url"
                  />
                </div>
                <div>
                  <label className="data-label block mb-1">Text After Link</label>
                  <input
                    className="tac-input"
                    value={settings.footer_text_after || ""}
                    onChange={(e) => setSettings({ ...settings, footer_text_after: e.target.value })}
                    data-testid="settings-footer-after"
                  />
                </div>
                <div className="text-xs font-mono text-muted-tac border-t pt-3" style={{ borderColor: "#272A30" }}>
                  Preview: <span className="text-white">{settings.footer_text_before}<span className="text-primary-amber">{settings.footer_link_label}</span>{settings.footer_text_after}</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    className="tac-btn-primary"
                    onClick={saveSettings}
                    disabled={savingSettings}
                    data-testid="save-settings-btn"
                  >
                    <Save size={14} className="inline mr-1" /> {savingSettings ? "Saving..." : "Save Footer"}
                  </button>
                  {settingsMsg && <span className="text-[#4CAF50] font-mono text-xs" data-testid="settings-msg">{settingsMsg}</span>}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="lg:col-span-8 space-y-4 sm:space-y-6">
          <ItemManager
            activeCategory={activeCategory}
            items={items}
            refresh={refreshAll}
          />
          <PriceEditor
            activeCategory={activeCategory}
            items={items}
            chartRows={chartRows}
            refresh={refreshAll}
          />
        </div>
      </div>
    </div>
  );
}
