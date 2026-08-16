import MonitorModeNav from "./monitor-mode-nav";

export default function SnookerMonitorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#f7f6fa" }}>
      <MonitorModeNav />
      {children}
    </div>
  );
}
