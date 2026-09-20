"use client";

import { useEffect, useState } from "react";
import { getIncidents } from "@/lib/api";

type Incident = {
    id: number;
    service_id: number;
    service_name?: string;
    title: string;
    description?: string;
    status: string;
    started_at?: string;
    resolved_at?: string | null;
};

export default function IncidentsPage() {
    const [incidents, setIncidents] =
        useState<Incident[]>([]);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState<string | null>(null);

    const [filter, setFilter] =
        useState("all");

    async function loadIncidents() {
        try {
            setLoading(true);
            setError(null);

            const result =
                (await getIncidents()) as any;

            if (result.success === false) {
                throw new Error(
                    result.message ||
                        "Failed to load incidents"
                );
            }

            setIncidents(
                result.data || []
            );
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to load incidents"
            );
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadIncidents();
    }, []);

    const filteredIncidents =
        filter === "all"
            ? incidents
            : incidents.filter(
                  (incident) =>
                      incident.status.toLowerCase() ===
                      filter
              );

    const activeCount =
        incidents.filter(
            (incident) =>
                incident.status.toLowerCase() ===
                "active"
        ).length;

    const resolvedCount =
        incidents.filter(
            (incident) =>
                incident.status.toLowerCase() ===
                "resolved"
        ).length;

    return (
        <main>
            <div className="page-header">
                <div>
                    <h1>Incidents</h1>

                    <p>
                        View and monitor service
                        incidents.
                    </p>
                </div>

                <button
                    className="refresh-button"
                    onClick={loadIncidents}
                    disabled={loading}
                >
                    {loading
                        ? "Refreshing..."
                        : "↻ Refresh"}
                </button>
            </div>

            {error && (
                <div className="error-box">
                    {error}
                </div>
            )}

            <div className="stats-grid">
                <StatCard
                    title="Total Incidents"
                    value={incidents.length}
                />

                <StatCard
                    title="Active"
                    value={activeCount}
                />

                <StatCard
                    title="Resolved"
                    value={resolvedCount}
                />
            </div>

            <div className="toolbar">
                <div className="filters">
                    <button
                        className={
                            filter === "all"
                                ? "filter-active"
                                : ""
                        }
                        onClick={() =>
                            setFilter("all")
                        }
                    >
                        All
                    </button>

                    <button
                        className={
                            filter === "active"
                                ? "filter-active"
                                : ""
                        }
                        onClick={() =>
                            setFilter("active")
                        }
                    >
                        Active
                    </button>

                    <button
                        className={
                            filter === "resolved"
                                ? "filter-active"
                                : ""
                        }
                        onClick={() =>
                            setFilter("resolved")
                        }
                    >
                        Resolved
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="loading">
                    Loading incidents...
                </div>
            ) : filteredIncidents.length ===
              0 ? (
                <div className="empty-state">
                    <div className="empty-icon">
                        ✓
                    </div>

                    <h3>
                        No incidents found
                    </h3>

                    <p>
                        There are no incidents
                        matching the selected
                        filter.
                    </p>
                </div>
            ) : (
                <div className="incident-list">
                    {filteredIncidents.map(
                        (incident) => (
                            <IncidentCard
                                key={incident.id}
                                incident={
                                    incident
                                }
                            />
                        )
                    )}
                </div>
            )}

            <style jsx>{`
                .page-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 20px;
                    margin-bottom: 30px;
                }

                h1 {
                    margin: 0;
                    font-size: 30px;
                }

                .page-header p {
                    margin: 7px 0 0;
                    color: #6b7280;
                }

                .refresh-button {
                    border: 1px solid #d1d5db;
                    background: white;
                    padding: 10px 16px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 600;
                    color: #374151;
                }

                .refresh-button:hover {
                    background: #f9fafb;
                }

                .refresh-button:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .error-box {
                    padding: 14px 16px;
                    margin-bottom: 20px;
                    background: #fef2f2;
                    color: #b91c1c;
                    border: 1px solid #fecaca;
                    border-radius: 8px;
                }

                .stats-grid {
                    display: grid;
                    grid-template-columns:
                        repeat(
                            3,
                            minmax(0, 1fr)
                        );
                    gap: 20px;
                    margin-bottom: 25px;
                }

                .stat-card {
                    background: white;
                    border: 1px solid #e5e7eb;
                    border-radius: 12px;
                    padding: 22px;
                }

                .stat-title {
                    color: #6b7280;
                    font-size: 14px;
                    margin: 0;
                }

                .stat-value {
                    font-size: 28px;
                    font-weight: 700;
                    margin: 8px 0 0;
                }

                .toolbar {
                    background: white;
                    border: 1px solid #e5e7eb;
                    border-radius: 10px;
                    padding: 10px;
                    margin-bottom: 20px;
                }

                .filters {
                    display: flex;
                    gap: 6px;
                }

                .filters button {
                    border: none;
                    background: transparent;
                    padding: 9px 16px;
                    border-radius: 7px;
                    cursor: pointer;
                    color: #6b7280;
                    font-weight: 600;
                }

                .filters button:hover {
                    background: #f3f4f6;
                }

                .filters .filter-active {
                    background: #2563eb;
                    color: white;
                }

                .loading {
                    padding: 50px;
                    text-align: center;
                    color: #6b7280;
                }

                .empty-state {
                    background: white;
                    border: 1px solid #e5e7eb;
                    border-radius: 12px;
                    padding: 60px 30px;
                    text-align: center;
                }

                .empty-icon {
                    width: 48px;
                    height: 48px;
                    margin: 0 auto 15px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #dcfce7;
                    color: #15803d;
                    font-size: 24px;
                    font-weight: 700;
                }

                .empty-state h3 {
                    margin: 0 0 8px;
                }

                .empty-state p {
                    margin: 0;
                    color: #6b7280;
                }

                .incident-list {
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                }

                .incident-card {
                    background: white;
                    border: 1px solid #e5e7eb;
                    border-radius: 12px;
                    padding: 22px;
                }

                .incident-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 15px;
                }

                .incident-title {
                    margin: 0;
                    font-size: 17px;
                }

                .service-name {
                    margin: 5px 0 0;
                    color: #6b7280;
                    font-size: 13px;
                }

                .status {
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 11px;
                    font-weight: 700;
                    text-transform: capitalize;
                }

                .status-active {
                    background: #fee2e2;
                    color: #b91c1c;
                }

                .status-resolved {
                    background: #dcfce7;
                    color: #15803d;
                }

                .status-default {
                    background: #f3f4f6;
                    color: #6b7280;
                }

                .description {
                    margin: 18px 0;
                    color: #4b5563;
                    font-size: 14px;
                    line-height: 1.5;
                }

                .incident-meta {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 20px;
                    color: #6b7280;
                    font-size: 12px;
                    border-top: 1px solid #f0f0f0;
                    padding-top: 15px;
                }

                @media (max-width: 700px) {
                    .page-header {
                        align-items: flex-start;
                        flex-direction: column;
                    }

                    .stats-grid {
                        grid-template-columns: 1fr;
                    }

                    .incident-header {
                        flex-direction: column;
                    }
                }
            `}</style>
        </main>
    );
}

function StatCard({
    title,
    value,
}: {
    title: string;
    value: number;
}) {
    return (
        <div className="stat-card">
            <p className="stat-title">
                {title}
            </p>

            <p className="stat-value">
                {value}
            </p>
        </div>
    );
}

function IncidentCard({
    incident,
}: {
    incident: Incident;
}) {
    const status =
        incident.status.toLowerCase();

    let statusClass =
        "status-default";

    if (status === "active") {
        statusClass = "status-active";
    } else if (
        status === "resolved"
    ) {
        statusClass = "status-resolved";
    }

    return (
        <div className="incident-card">
            <div className="incident-header">
                <div>
                    <h3 className="incident-title">
                        {incident.title}
                    </h3>

                    <p className="service-name">
                        {incident.service_name ||
                            `Service #${incident.service_id}`}
                    </p>
                </div>

                <span
                    className={`status ${statusClass}`}
                >
                    {incident.status}
                </span>
            </div>

            {incident.description && (
                <p className="description">
                    {incident.description}
                </p>
            )}

            <div className="incident-meta">
                {incident.started_at && (
                    <span>
                        Started:{" "}
                        {incident.started_at}
                    </span>
                )}

                {incident.resolved_at && (
                    <span>
                        Resolved:{" "}
                        {incident.resolved_at}
                    </span>
                )}

                <span>
                    Incident #{incident.id}
                </span>
            </div>
        </div>
    );
}