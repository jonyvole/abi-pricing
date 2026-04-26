import React from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

const PALETTE = [
  "#FFB300", "#4CAF50", "#FF3B30", "#3DA9FC", "#B388FF", "#FFFFFF", "#00BCD4", "#FF9800",
  "#F472B6", "#FACC15", "#A3E635", "#94A3B8", "#FB923C", "#2DD4BF", "#C084FC",
];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      style={{
        background: "#08090A",
        border: "1px solid #FFB300",
        padding: "10px 12px",
        fontFamily: "IBM Plex Mono, monospace",
        fontSize: "12px",
      }}
    >
      <div style={{ color: "#8A8F98", marginBottom: 6, letterSpacing: "0.1em", textTransform: "uppercase", fontSize: 10 }}>
        {label}
      </div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color, display: "flex", justifyContent: "space-between", gap: 16 }}>
          <span>{p.name}</span>
          <span style={{ color: "#FFFFFF", fontWeight: 600 }}>
            {Number(p.value).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function PriceChart({ items, rows }) {
  if (!items || items.length === 0) {
    return (
      <div
        data-testid="chart-empty"
        className="tac-card flex items-center justify-center"
        style={{ height: 360 }}
      >
        <div className="text-center px-6">
          <div className="data-label mb-2">No Items</div>
          <div className="text-muted-tac text-sm">Add items and price points in the Admin panel to populate this chart.</div>
        </div>
      </div>
    );
  }
  if (!rows || rows.length === 0) {
    return (
      <div
        data-testid="chart-empty-rows"
        className="tac-card flex items-center justify-center"
        style={{ height: 360 }}
      >
        <div className="text-center px-6">
          <div className="data-label mb-2">Awaiting Data</div>
          <div className="text-muted-tac text-sm">No price points recorded yet for these items.</div>
        </div>
      </div>
    );
  }
  return (
    <div className="tac-card p-3 sm:p-5" data-testid="price-chart">
      <ResponsiveContainer width="100%" height={420}>
        <LineChart data={rows} margin={{ top: 12, right: 24, left: 4, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 6" stroke="#272A30" />
          <XAxis
            dataKey="date"
            stroke="#8A8F98"
            tick={{ fontFamily: "IBM Plex Mono", fontSize: 11 }}
            tickLine={{ stroke: "#272A30" }}
            axisLine={{ stroke: "#272A30" }}
          />
          <YAxis
            stroke="#8A8F98"
            tick={{ fontFamily: "IBM Plex Mono", fontSize: 11 }}
            tickLine={{ stroke: "#272A30" }}
            axisLine={{ stroke: "#272A30" }}
            tickFormatter={(v) => v.toLocaleString()}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#FFB300", strokeOpacity: 0.3 }} />
          <Legend
            wrapperStyle={{
              fontFamily: "IBM Plex Mono",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              paddingTop: 12,
            }}
          />
          {items.map((it, idx) => (
            <Line
              key={it.id}
              type="monotone"
              dataKey={it.id}
              name={it.name}
              stroke={it.color || PALETTE[idx % PALETTE.length]}
              strokeWidth={2}
              dot={{ r: 3, strokeWidth: 1 }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
