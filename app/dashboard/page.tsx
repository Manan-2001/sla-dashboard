"use client";

import { useEffect, useMemo, useState } from "react";
import { getDashboardSummary } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";

type ServiceStats = {
  total: number;
  up: number;
  down: number;
  degraded: number;
  unknown: number;
};

type IncidentStats = {
  total: number;
  active: number;
  resolved: number;
};

type MonitoringStats = {
  period: string;
  total_checks: number;
  successful_checks: number;
  failed_checks: number;
  uptime_percentage: number;
  average_response_time_ms: number;
};

type Incident = {
  id: number;
  service_id: number;
  service_name: string;
  title: string;
  description: string;
  status: string;
  started_at: string;
  resolved_at?: string | null;
};

type Check = {
  id: number;
  service_id: number;
  service_name: string;
  status: string;
  response_time_ms: number;
  status_code?: number | null;
  error_message?: string | null;
  checked_at: string;
};

type DashboardData = {
  services: ServiceStats;
  incidents: IncidentStats;
  monitoring: MonitoringStats;
  recent_incidents: Incident[];
  recent_checks: Check[];
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      const token = getAuthToken();

      if (!token) {
        window.location.href = "/login";
        return;
      }

      const result: any = await getDashboardSummary();

      if (!result?.data) {
        throw new Error("Invalid dashboard response.");
      }

      setData(result.data);
    } catch (err: any) {
      setError(err?.message || "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }

  const availabilityProgress = useMemo(() => {
    if (!data) return 0;

    return Math.min(
      100,
      Math.max(0, Number(data.monitoring.uptime_percentage) || 0),
    );
  }, [data]);

  function formatDate(value?: string | null) {
    if (!value) return "—";

    const date = new Date(value.replace(" ", "T"));

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString();
  }

  function getStatusClass(status: string) {
    const normalized = status.toLowerCase();

    if (
      normalized === "success" ||
      normalized === "up" ||
      normalized === "resolved"
    ) {
      return "success";
    }

    if (
      normalized === "failure" ||
      normalized === "down" ||
      normalized === "failed" ||
      normalized === "active"
    ) {
      return "danger";
    }

    if (normalized === "degraded" || normalized === "pending") {
      return "warning";
    }

    return "neutral";
  }

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="loading-screen">
          <div className="loader" />
          <p>Loading monitoring dashboard...</p>
        </div>

        <style jsx>{`
          .dashboard-page {
            min-height: 70vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .loading-screen {
            text-align: center;
            color: #667085;
          }

          .loader {
            width: 34px;
            height: 34px;
            margin: 0 auto 14px;
            border: 3px solid #e4e7ec;
            border-top-color: #3157c8;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          .loading-screen p {
            margin: 0;
            font-size: 14px;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="dashboard-page">
        <div className="error-state">
          <div className="error-icon">!</div>

          <h2>Unable to load dashboard</h2>

          <p>{error || "Something went wrong."}</p>

          <button onClick={loadDashboard}>Try Again</button>
        </div>

        <style jsx>{`
          .dashboard-page {
            min-height: 70vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .error-state {
            text-align: center;
            max-width: 420px;
            padding: 30px;
          }

          .error-icon {
            width: 50px;
            height: 50px;
            margin: 0 auto 15px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            background: #fff1f2;
            color: #b42318;
            font-size: 22px;
            font-weight: 800;
          }

          .error-state h2 {
            margin: 0;
            color: #172033;
          }

          .error-state p {
            color: #667085;
            font-size: 14px;
            line-height: 1.5;
          }

          .error-state button {
            border: 0;
            border-radius: 8px;
            background: #3157c8;
            color: white;
            padding: 10px 18px;
            cursor: pointer;
            font-weight: 600;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <h1>Monitoring Overview</h1>
          <p>Monitor service health, SLA performance and incidents.</p>
        </div>

        <button className="refresh-btn" onClick={loadDashboard}>
          ↻ Refresh
        </button>
      </div>

      {/* ========================= */}
      {/* TOP STAT CARDS */}
      {/* ========================= */}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-top">
            <div className="stat-icon blue">◉</div>

            <span className="stat-label">Services</span>
          </div>

          <div className="stat-value">{data.services.total}</div>

          <div className="stat-footer">
            <span className="up-text">{data.services.up} up</span>

            <span>{data.services.down} down</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <div className="stat-icon green">✓</div>

            <span className="stat-label">Availability</span>
          </div>

          <div className="stat-value">{data.monitoring.uptime_percentage}%</div>

          <div className="progress">
            <div
              className="progress-bar"
              style={{
                width: `${availabilityProgress}%`,
              }}
            />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <div className="stat-icon purple">◷</div>

            <span className="stat-label">Avg Response</span>
          </div>

          <div className="stat-value">
            {data.monitoring.average_response_time_ms}
            <small>ms</small>
          </div>

          <div className="stat-footer">
            <span>Last 24 hours</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <div className="stat-icon orange">!</div>

            <span className="stat-label">Incidents</span>
          </div>

          <div className="stat-value">{data.incidents.total}</div>

          <div className="stat-footer">
            <span>{data.incidents.active} active</span>

            <span>{data.incidents.resolved} resolved</span>
          </div>
        </div>
      </div>

      {/* ========================= */}
      {/* HEALTH OVERVIEW */}
      {/* ========================= */}

      <div className="main-grid">
        <section className="card health-card">
          <div className="card-header">
            <div>
              <h2>Service Health</h2>

              <p>Current status of all monitored services.</p>
            </div>

            <span className="live-badge">
              <span />
              Live
            </span>
          </div>

          <div className="health-content">
            <div
              className="health-circle"
              style={
                {
                  "--health-percent":
                    data.services.total > 0
                      ? (
                          (data.services.up / data.services.total) *
                          100
                        ).toFixed(1)
                      : "0",
                } as React.CSSProperties
              }
            >
              <div>
                <strong>
                  {data.services.up}/{data.services.total}
                </strong>

                <span>Services Up</span>
              </div>
            </div>

            <div className="health-legend">
              <div>
                <span className="legend-dot up" />
                <span>Operational</span>
                <strong>{data.services.up}</strong>
              </div>

              <div>
                <span className="legend-dot degraded" />
                <span>Degraded</span>
                <strong>{data.services.degraded}</strong>
              </div>

              <div>
                <span className="legend-dot down" />
                <span>Down</span>
                <strong>{data.services.down}</strong>
              </div>

              <div>
                <span className="legend-dot unknown" />
                <span>Unknown</span>
                <strong>{data.services.unknown}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="card checks-card">
          <div className="card-header">
            <div>
              <h2>Recent Checks</h2>

              <p>Latest monitoring activity.</p>
            </div>
          </div>

          {data.recent_checks.length === 0 ? (
            <div className="empty-small">No checks available.</div>
          ) : (
            <div className="checks-list">
              {data.recent_checks.slice(0, 5).map((check) => (
                <div className="check-row" key={check.id}>
                  <div
                    className={`check-status ${getStatusClass(check.status)}`}
                  >
                    {check.status === "success" ? "✓" : "!"}
                  </div>

                  <div className="check-info">
                    <strong>{check.service_name}</strong>

                    <span>{formatDate(check.checked_at)}</span>
                  </div>

                  <div className="check-response">
                    <strong>
                      {check.response_time_ms}
                      ms
                    </strong>

                    <span>
                      {check.status_code
                        ? `HTTP ${check.status_code}`
                        : check.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ========================= */}
      {/* INCIDENTS */}
      {/* ========================= */}

      <section className="card incidents-card">
        <div className="card-header">
          <div>
            <h2>Recent Incidents</h2>

            <p>Latest service incidents and their resolution status.</p>
          </div>

          <a href="/dashboard/incidents" className="view-all">
            View all →
          </a>
        </div>

        {data.recent_incidents.length === 0 ? (
          <div className="empty-small">No recent incidents.</div>
        ) : (
          <div className="incidents-table">
            <div className="table-header">
              <span>Incident</span>
              <span>Service</span>
              <span>Status</span>
              <span>Started</span>
              <span>Resolved</span>
            </div>

            {data.recent_incidents.slice(0, 5).map((incident) => (
              <div className="table-row" key={incident.id}>
                <div>
                  <strong>{incident.title}</strong>

                  <span>Incident #{incident.id}</span>
                </div>

                <span>{incident.service_name}</span>

                <span>
                  <b
                    className={`status-badge ${getStatusClass(
                      incident.status,
                    )}`}
                  >
                    {incident.status}
                  </b>
                </span>

                <span>{formatDate(incident.started_at)}</span>

                <span>{formatDate(incident.resolved_at)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ========================= */}
      {/* MONITORING SUMMARY */}
      {/* ========================= */}

      <section className="monitoring-summary">
        <div>
          <span>Monitoring Period</span>

          <strong>Last 24 Hours</strong>
        </div>

        <div>
          <span>Total Checks</span>

          <strong>{data.monitoring.total_checks}</strong>
        </div>

        <div>
          <span>Successful Checks</span>

          <strong className="green-text">
            {data.monitoring.successful_checks}
          </strong>
        </div>

        <div>
          <span>Failed Checks</span>

          <strong className="red-text">{data.monitoring.failed_checks}</strong>
        </div>
      </section>

      <style jsx>{`
        .dashboard-page {
          width: 100%;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 24px;
        }

        .page-header h1 {
          margin: 0;
          color: #172033;
          font-size: 28px;
          font-weight: 700;
        }

        .page-header p {
          margin: 7px 0 0;
          color: #718096;
          font-size: 14px;
        }

        .refresh-btn {
          border: 1px solid #dbe2ea;
          background: #fff;
          color: #344054;
          border-radius: 9px;
          padding: 10px 16px;
          cursor: pointer;
          font-weight: 600;
        }

        .refresh-btn:hover {
          background: #f8fafc;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }

        .stat-card {
          background: #fff;
          border: 1px solid #e6eaf0;
          border-radius: 14px;
          padding: 18px;
          box-shadow: 0 2px 8px rgba(16, 24, 40, 0.04);
        }

        .stat-top {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .stat-icon {
          width: 38px;
          height: 38px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
        }

        .stat-icon.blue {
          background: #eef4ff;
          color: #3157c8;
        }

        .stat-icon.green {
          background: #ecfdf3;
          color: #027a48;
        }

        .stat-icon.purple {
          background: #f4f3ff;
          color: #6941c6;
        }

        .stat-icon.orange {
          background: #fffaeb;
          color: #b54708;
        }

        .stat-label {
          color: #667085;
          font-size: 13px;
          font-weight: 600;
        }

        .stat-value {
          margin-top: 15px;
          color: #172033;
          font-size: 27px;
          font-weight: 700;
        }

        .stat-value small {
          margin-left: 4px;
          color: #667085;
          font-size: 13px;
          font-weight: 500;
        }

        .stat-footer {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          margin-top: 8px;
          color: #98a2b3;
          font-size: 11px;
        }

        .up-text,
        .green-text {
          color: #027a48;
        }

        .red-text {
          color: #b42318;
        }

        .progress {
          height: 6px;
          overflow: hidden;
          background: #edf0f4;
          border-radius: 999px;
          margin-top: 13px;
        }

        .progress-bar {
          height: 100%;
          background: #12b76a;
          border-radius: inherit;
          transition: width 0.4s ease;
        }

        .main-grid {
          display: grid;
          grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
          gap: 20px;
          margin-bottom: 20px;
        }

        .card {
          background: #fff;
          border: 1px solid #e6eaf0;
          border-radius: 14px;
          box-shadow: 0 2px 8px rgba(16, 24, 40, 0.04);
          overflow: hidden;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 15px;
          padding: 20px;
          border-bottom: 1px solid #edf0f4;
        }

        .card-header h2 {
          margin: 0;
          color: #172033;
          font-size: 16px;
        }

        .card-header p {
          margin: 5px 0 0;
          color: #98a2b3;
          font-size: 12px;
        }

        .live-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 5px 9px;
          border-radius: 999px;
          background: #ecfdf3;
          color: #027a48;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .live-badge span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #12b76a;
        }

        .health-content {
          display: flex;
          align-items: center;
          gap: 35px;
          padding: 28px;
        }

        .health-circle {
          width: 145px;
          height: 145px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: conic-gradient(
            #12b76a 0deg,
            #12b76a calc((var(--health-percent, 100) * 3.6deg)),
            #edf0f4 calc((var(--health-percent, 100) * 3.6deg))
          );
          position: relative;
        }

        .health-circle::before {
          content: "";
          position: absolute;
          inset: 9px;
          background: #fff;
          border-radius: 50%;
        }

        .health-circle > div {
          position: relative;
          z-index: 1;
          text-align: center;
        }

        .health-circle strong {
          display: block;
          color: #172033;
          font-size: 25px;
        }

        .health-circle span {
          display: block;
          margin-top: 3px;
          color: #98a2b3;
          font-size: 10px;
        }

        .health-legend {
          flex: 1;
        }

        .health-legend > div {
          display: grid;
          grid-template-columns: 9px 1fr auto;
          align-items: center;
          gap: 9px;
          padding: 9px 0;
          border-bottom: 1px solid #f0f2f5;
          font-size: 12px;
        }

        .health-legend > div:last-child {
          border-bottom: 0;
        }

        .health-legend strong {
          color: #344054;
        }

        .legend-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .legend-dot.up {
          background: #12b76a;
        }

        .legend-dot.degraded {
          background: #f79009;
        }

        .legend-dot.down {
          background: #f04438;
        }

        .legend-dot.unknown {
          background: #98a2b3;
        }

        .checks-list {
          padding: 8px 20px;
        }

        .check-row {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 12px 0;
          border-bottom: 1px solid #f0f2f5;
        }

        .check-row:last-child {
          border-bottom: 0;
        }

        .check-status {
          width: 31px;
          height: 31px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          font-weight: 700;
          font-size: 13px;
        }

        .check-status.success {
          background: #ecfdf3;
          color: #027a48;
        }

        .check-status.danger {
          background: #fff1f2;
          color: #b42318;
        }

        .check-status.warning {
          background: #fffaeb;
          color: #b54708;
        }

        .check-status.neutral {
          background: #f2f4f7;
          color: #667085;
        }

        .check-info {
          flex: 1;
          min-width: 0;
        }

        .check-info strong {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #344054;
          font-size: 12px;
        }

        .check-info span {
          display: block;
          margin-top: 3px;
          color: #98a2b3;
          font-size: 10px;
        }

        .check-response {
          text-align: right;
        }

        .check-response strong {
          display: block;
          color: #344054;
          font-size: 12px;
        }

        .check-response span {
          display: block;
          margin-top: 3px;
          color: #98a2b3;
          font-size: 10px;
        }

        .incidents-card {
          margin-bottom: 20px;
        }

        .view-all {
          color: #3157c8;
          font-size: 12px;
          font-weight: 600;
          text-decoration: none;
        }

        .incidents-table {
          width: 100%;
        }

        .table-header,
        .table-row {
          display: grid;
          grid-template-columns:
            2fr 1.2fr 0.8fr 1.4fr
            1.4fr;
          gap: 15px;
          align-items: center;
          padding: 13px 20px;
        }

        .table-header {
          background: #f9fafb;
          color: #98a2b3;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .table-row {
          border-top: 1px solid #f0f2f5;
          color: #667085;
          font-size: 11px;
        }

        .table-row > div:first-child strong {
          display: block;
          color: #344054;
          font-size: 12px;
        }

        .table-row > div:first-child span {
          display: block;
          margin-top: 3px;
          color: #98a2b3;
          font-size: 10px;
        }

        .status-badge {
          display: inline-block;
          border-radius: 999px;
          padding: 5px 8px;
          font-size: 9px;
          text-transform: uppercase;
        }

        .status-badge.success {
          background: #ecfdf3;
          color: #027a48;
        }

        .status-badge.danger {
          background: #fff1f2;
          color: #b42318;
        }

        .status-badge.warning {
          background: #fffaeb;
          color: #b54708;
        }

        .status-badge.neutral {
          background: #f2f4f7;
          color: #667085;
        }

        .monitoring-summary {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          background: #fff;
          border: 1px solid #e6eaf0;
          border-radius: 14px;
          overflow: hidden;
        }

        .monitoring-summary > div {
          padding: 18px 20px;
          border-right: 1px solid #edf0f4;
        }

        .monitoring-summary > div:last-child {
          border-right: 0;
        }

        .monitoring-summary span {
          display: block;
          color: #98a2b3;
          font-size: 11px;
        }

        .monitoring-summary strong {
          display: block;
          margin-top: 6px;
          color: #172033;
          font-size: 17px;
        }

        .empty-small {
          padding: 35px 20px;
          text-align: center;
          color: #98a2b3;
          font-size: 13px;
        }

        @media (max-width: 1100px) {
          .stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .main-grid {
            grid-template-columns: 1fr;
          }

          .monitoring-summary {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .monitoring-summary > div:nth-child(2) {
            border-right: 0;
          }

          .monitoring-summary > div:nth-child(-n + 2) {
            border-bottom: 1px solid #edf0f4;
          }
        }

        @media (max-width: 700px) {
          .page-header {
            flex-direction: column;
          }

          .refresh-btn {
            width: 100%;
          }

          .health-content {
            flex-direction: column;
            align-items: stretch;
          }

          .health-circle {
            margin: 0 auto;
          }

          .table-header {
            display: none;
          }

          .table-row {
            grid-template-columns: 1fr 1fr;
            padding: 15px;
          }

          .table-row > span:nth-child(4),
          .table-row > span:nth-child(5) {
            font-size: 10px;
          }

          .monitoring-summary {
            grid-template-columns: 1fr;
          }

          .monitoring-summary > div {
            border-right: 0 !important;
            border-bottom: 1px solid #edf0f4;
          }

          .monitoring-summary > div:last-child {
            border-bottom: 0;
          }
        }

        @media (max-width: 500px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }

          .health-content {
            padding: 20px;
          }
        }
      `}</style>
    </div>
  );
}
