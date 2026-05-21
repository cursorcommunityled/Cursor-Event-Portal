"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, AlertTriangle, Clock, Eye, MousePointerClick, RefreshCw, Users } from "lucide-react";
import type { UXMonitorMetrics } from "@/lib/supabase/queries";

interface UXMonitorClientProps {
  metrics: UXMonitorMetrics;
}

const tooltipStyle = {
  backgroundColor: "rgba(0,0,0,0.88)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "12px",
  color: "#fff",
};

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDetails(details: Record<string, unknown> | null) {
  if (!details) return "-";
  const cleanDetails = Object.fromEntries(
    Object.entries(details).filter(([, value]) => value !== null && value !== undefined && value !== "")
  );
  return Object.keys(cleanDetails).length > 0 ? JSON.stringify(cleanDetails) : "-";
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof Eye;
}) {
  return (
    <div className="glass rounded-[32px] p-6 border-white/[0.04]">
      <div className="flex items-center justify-between mb-5">
        <p className="text-[10px] uppercase tracking-[0.22em] text-gray-600 font-bold">{label}</p>
        <Icon className="w-4 h-4 text-white/40" />
      </div>
      <p className="text-4xl font-light tracking-tight tabular-nums text-white">{value}</p>
    </div>
  );
}

export function UXMonitorClient({ metrics }: UXMonitorClientProps) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => {
      router.refresh();
    }, 60_000);

    return () => window.clearInterval(interval);
  }, [router]);

  const refreshNow = () => {
    setIsRefreshing(true);
    router.refresh();
    window.setTimeout(() => setIsRefreshing(false), 700);
  };

  return (
    <div className="space-y-10 animate-fade-in">
      <div className="glass rounded-[40px] p-8 border-white/[0.03] flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-gray-600 font-bold mb-3">
            Refreshes every 60 seconds
          </p>
          <h2 className="text-3xl font-light tracking-tight text-white">UX Monitor</h2>
          <p className="text-sm text-gray-500 mt-2">
            Watch page views, sessions, actions, and client-side errors across this event.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <p className="text-xs text-gray-500">
            Last updated <span className="text-white/70">{formatTime(metrics.lastUpdated)}</span>
          </p>
          <button
            type="button"
            onClick={refreshNow}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh now
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-5">
        <StatCard label="Page views today" value={metrics.pageViewsToday} icon={Eye} />
        <StatCard label="Sessions today" value={metrics.sessionsToday} icon={Users} />
        <StatCard label="Top module today" value={metrics.topModuleToday} icon={Activity} />
        <StatCard label="Errors today" value={metrics.errorsToday} icon={AlertTriangle} />
      </div>

      <div className="grid xl:grid-cols-2 gap-8">
        <div className="glass rounded-[40px] p-8 border-white/[0.03] space-y-6">
          <div>
            <h3 className="text-xl font-light tracking-tight text-white">Module Visits</h3>
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600 font-bold mt-1">
              Last 7 days
            </p>
          </div>
          {metrics.moduleVisits.length > 0 ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.moduleVisits} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis type="number" stroke="rgba(255,255,255,0.35)" style={{ fontSize: "11px" }} />
                  <YAxis
                    dataKey="module"
                    type="category"
                    width={100}
                    stroke="rgba(255,255,255,0.4)"
                    style={{ fontSize: "11px" }}
                  />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                  <Bar dataKey="visits" fill="#fff" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-80 flex items-center justify-center text-gray-600 text-sm">
              No module visits recorded yet
            </div>
          )}
        </div>

        <div className="glass rounded-[40px] p-8 border-white/[0.03] space-y-6">
          <div>
            <h3 className="text-xl font-light tracking-tight text-white">Hourly Page Views</h3>
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600 font-bold mt-1">
              Today
            </p>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.hourlyPageViews}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis
                  dataKey="hour"
                  interval={3}
                  stroke="rgba(255,255,255,0.35)"
                  style={{ fontSize: "11px" }}
                />
                <YAxis stroke="rgba(255,255,255,0.35)" style={{ fontSize: "11px" }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="views"
                  stroke="#fff"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "#fff" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid xl:grid-cols-[0.85fr_1.15fr] gap-8">
        <div className="glass rounded-[40px] p-8 border-white/[0.03] space-y-6">
          <div className="flex items-center gap-3">
            <MousePointerClick className="w-5 h-5 text-white/50" />
            <div>
              <h3 className="text-xl font-light tracking-tight text-white">Top Actions</h3>
              <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600 font-bold mt-1">
                Last 7 days
              </p>
            </div>
          </div>
          {metrics.topActions.length > 0 ? (
            <div className="space-y-3">
              {metrics.topActions.map((action) => (
                <div
                  key={action.action}
                  className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-white/[0.025] border border-white/[0.05]"
                >
                  <p className="text-sm text-white/80 leading-relaxed line-clamp-2">{action.action}</p>
                  <span className="text-xl font-light tabular-nums text-white">{action.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center text-gray-600 text-sm">
              No actions recorded yet. Run the SQL migration, then clicks will appear here.
            </div>
          )}
        </div>

        <div className="glass rounded-[40px] p-8 border-white/[0.03] space-y-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-white/50" />
            <div>
              <h3 className="text-xl font-light tracking-tight text-white">Recent Errors / 404s</h3>
              <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600 font-bold mt-1">
                Client errors, failed resources, and logged API issues
              </p>
            </div>
          </div>
          {metrics.recentErrors.length > 0 ? (
            <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
              {metrics.recentErrors.map((error) => (
                <div key={error.id} className="p-4 rounded-2xl bg-red-500/[0.04] border border-red-500/15">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm text-white/85 line-clamp-2">{error.message}</p>
                      <p className="text-xs text-gray-500 mt-2">{error.path || "Unknown path"}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-red-300/80">{error.type}</p>
                      <p className="text-xs text-gray-500 mt-1">{formatTime(error.time)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center text-gray-600 text-sm">No errors recorded</div>
          )}
        </div>
      </div>

      <div className="glass rounded-[40px] p-8 border-white/[0.03] space-y-6">
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-white/50" />
          <div>
            <h3 className="text-xl font-light tracking-tight text-white">Recent Activity</h3>
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600 font-bold mt-1">
              Last 120 events across sessions
            </p>
          </div>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.18em] text-gray-600">
                <th className="py-3 pr-4 font-bold">Time</th>
                <th className="py-3 pr-4 font-bold">Type</th>
                <th className="py-3 pr-4 font-bold">Module</th>
                <th className="py-3 pr-4 font-bold">Path</th>
                <th className="py-3 font-bold">Details</th>
              </tr>
            </thead>
            <tbody>
              {metrics.recentActivity.length > 0 ? (
                metrics.recentActivity.map((activity) => (
                  <tr key={`${activity.type}-${activity.id}`} className="border-b border-white/[0.04]">
                    <td className="py-3 pr-4 whitespace-nowrap text-gray-500">{formatTime(activity.time)}</td>
                    <td className="py-3 pr-4 whitespace-nowrap text-white/75">{activity.type}</td>
                    <td className="py-3 pr-4 whitespace-nowrap text-white/75">{activity.module}</td>
                    <td className="py-3 pr-4 min-w-[180px] text-gray-500">{activity.path || "-"}</td>
                    <td className="py-3 min-w-[280px] max-w-[440px] text-gray-500 truncate">
                      {formatDetails(activity.details)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-gray-600">
                    No activity recorded yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
