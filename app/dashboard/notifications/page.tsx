"use client";

import { useEffect, useState } from "react";
import {
    getNotifications,
    updateNotification,
} from "@/lib/api";
import { getAuthToken } from "@/lib/auth";

type NotificationStatus =
    | "pending"
    | "sent"
    | "failed";

type Notification = {
    id: number;
    service_id?: number;
    service_name?: string;
    incident_id?: number;
    type?: string;
    title?: string;
    message?: string;
    status: NotificationStatus;
    created_at?: string;
    sent_at?: string | null;
};

type Filter =
    | "all"
    | "pending"
    | "sent"
    | "failed";

export default function NotificationsPage() {
    const [notifications, setNotifications] =
        useState<Notification[]>([]);

    const [filter, setFilter] =
        useState<Filter>("all");

    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] =
        useState<number | null>(null);

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        loadNotifications();
    }, [filter]);

    async function loadNotifications() {
        try {
            setLoading(true);
            setError("");
            setSuccess("");

            const result: any =
                await getNotifications(
                    filter === "all"
                        ? undefined
                        : {
                            status: filter,
                        }
                );

            const data =
                Array.isArray(result?.data)
                    ? result.data
                    : Array.isArray(
                        result?.data?.notifications
                    )
                        ? result.data.notifications
                        : Array.isArray(
                            result?.notifications
                        )
                            ? result.notifications
                            : Array.isArray(result)
                                ? result
                                : [];

            setNotifications(data);
        } catch (err: any) {
            setError(
                err?.message ||
                "Failed to load notifications."
            );
        } finally {
            setLoading(false);
        }
    }

    async function handleStatusUpdate(
        notificationId: number,
        status: NotificationStatus
    ) {
        try {
            const token = getAuthToken();

            if (!token) {
                setError(
                    "Authentication required. Please login again."
                );
                return;
            }

            setUpdatingId(notificationId);
            setError("");
            setSuccess("");

            await updateNotification(
                notificationId,
                status,
                token
            );

            setSuccess(
                `Notification marked as ${status}.`
            );

            await loadNotifications();
        } catch (err: any) {
            setError(
                err?.message ||
                "Failed to update notification."
            );
        } finally {
            setUpdatingId(null);
        }
    }

    function getStatusClass(
        status: NotificationStatus
    ) {
        return status;
    }

    function getNotificationIcon(
        type?: string
    ) {
        const value =
            type?.toLowerCase() || "";

        if (
            value.includes("incident") ||
            value.includes("alert")
        ) {
            return "⚠";
        }

        if (
            value.includes("resolved") ||
            value.includes("success")
        ) {
            return "✓";
        }

        if (
            value.includes("failure") ||
            value.includes("failed")
        ) {
            return "!";
        }

        return "●";
    }

    function formatDate(
        value?: string | null
    ) {
        if (!value) {
            return "—";
        }

        const date = new Date(
            value.replace(" ", "T")
        );

        if (Number.isNaN(date.getTime())) {
            return value;
        }

        return date.toLocaleString();
    }

    const pendingCount =
        notifications.filter(
            (item) => item.status === "pending"
        ).length;

    const sentCount =
        notifications.filter(
            (item) => item.status === "sent"
        ).length;

    const failedCount =
        notifications.filter(
            (item) => item.status === "failed"
        ).length;

    return (
        <div className="notifications-page">
            <div className="page-header">
                <div>
                    <h1>Notifications</h1>
                    <p>
                        Monitor and manage SLA and
                        incident notifications.
                    </p>
                </div>

                <button
                    className="refresh-btn"
                    onClick={loadNotifications}
                    disabled={loading}
                >
                    ↻ Refresh
                </button>
            </div>

            {error && (
                <div className="alert error">
                    {error}
                </div>
            )}

            {success && (
                <div className="alert success">
                    {success}
                </div>
            )}

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon pending">
                        ◷
                    </div>

                    <div>
                        <span>Pending</span>
                        <strong>{pendingCount}</strong>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon sent">
                        ✓
                    </div>

                    <div>
                        <span>Sent</span>
                        <strong>{sentCount}</strong>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon failed">
                        !
                    </div>

                    <div>
                        <span>Failed</span>
                        <strong>{failedCount}</strong>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon total">
                        ●
                    </div>

                    <div>
                        <span>Total</span>
                        <strong>
                            {notifications.length}
                        </strong>
                    </div>
                </div>
            </div>

            <div className="toolbar">
                <div className="filters">
                    {(
                        [
                            "all",
                            "pending",
                            "sent",
                            "failed",
                        ] as Filter[]
                    ).map((item) => (
                        <button
                            key={item}
                            className={
                                filter === item
                                    ? "filter active"
                                    : "filter"
                            }
                            onClick={() =>
                                setFilter(item)
                            }
                        >
                            {item === "all"
                                ? "All"
                                : item
                                    .charAt(0)
                                    .toUpperCase() +
                                item.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="loading">
                    Loading notifications...
                </div>
            ) : notifications.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">
                        ✓
                    </div>

                    <h2>
                        No notifications found
                    </h2>

                    <p>
                        There are no notifications
                        matching the selected filter.
                    </p>
                </div>
            ) : (
                <div className="notification-list">
                    {notifications.map(
                        (notification) => (
                            <div
                                className="notification-card"
                                key={notification.id}
                            >
                                <div
                                    className={`notification-icon ${getStatusClass(
                                        notification.status
                                    )}`}
                                >
                                    {getNotificationIcon(
                                        notification.type
                                    )}
                                </div>

                                <div className="notification-content">
                                    <div className="notification-top">
                                        <div>
                                            <h2>
                                                {notification.title ||
                                                    notification.type ||
                                                    "Notification"}
                                            </h2>

                                            <div className="meta">
                                                {notification.service_name && (
                                                    <span>
                                                        {
                                                            notification.service_name
                                                        }
                                                    </span>
                                                )}

                                                {notification.incident_id && (
                                                    <span>
                                                        Incident #
                                                        {
                                                            notification.incident_id
                                                        }
                                                    </span>
                                                )}

                                                {notification.type && (
                                                    <span>
                                                        {
                                                            notification.type
                                                        }
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <span
                                            className={`status ${notification.status}`}
                                        >
                                            {
                                                notification.status
                                            }
                                        </span>
                                    </div>

                                    {notification.message && (
                                        <p className="message">
                                            {
                                                notification.message
                                            }
                                        </p>
                                    )}

                                    <div className="notification-bottom">
                                        <div className="dates">
                                            <span>
                                                Created:{" "}
                                                {formatDate(
                                                    notification.created_at
                                                )}
                                            </span>

                                            {notification.sent_at && (
                                                <span>
                                                    Sent:{" "}
                                                    {formatDate(
                                                        notification.sent_at
                                                    )}
                                                </span>
                                            )}
                                        </div>

                                        <div className="actions">
                                            {notification.status ===
                                                "pending" && (
                                                    <>
                                                        <button
                                                            className="action-btn sent-btn"
                                                            disabled={
                                                                updatingId ===
                                                                notification.id
                                                            }
                                                            onClick={() =>
                                                                handleStatusUpdate(
                                                                    notification.id,
                                                                    "sent"
                                                                )
                                                            }
                                                        >
                                                            {updatingId ===
                                                                notification.id
                                                                ? "Updating..."
                                                                : "Mark Sent"}
                                                        </button>

                                                        <button
                                                            className="action-btn failed-btn"
                                                            disabled={
                                                                updatingId ===
                                                                notification.id
                                                            }
                                                            onClick={() =>
                                                                handleStatusUpdate(
                                                                    notification.id,
                                                                    "failed"
                                                                )
                                                            }
                                                        >
                                                            Mark Failed
                                                        </button>
                                                    </>
                                                )}

                                            {notification.status ===
                                                "failed" && (
                                                    <button
                                                        className="action-btn pending-btn"
                                                        disabled={
                                                            updatingId ===
                                                            notification.id
                                                        }
                                                        onClick={() =>
                                                            handleStatusUpdate(
                                                                notification.id,
                                                                "pending"
                                                            )
                                                        }
                                                    >
                                                        Retry
                                                    </button>
                                                )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    )}
                </div>
            )}

            <style jsx>{`
                .notifications-page {
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
                    font-size: 28px;
                    font-weight: 700;
                    color: #172033;
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

                .refresh-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .alert {
                    border-radius: 10px;
                    padding: 13px 16px;
                    margin-bottom: 20px;
                    font-size: 14px;
                }

                .alert.error {
                    background: #fff1f2;
                    color: #b42318;
                    border: 1px solid #fecdd3;
                }

                .alert.success {
                    background: #ecfdf3;
                    color: #027a48;
                    border: 1px solid #abefc6;
                }

                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(
                        4,
                        minmax(0, 1fr)
                    );
                    gap: 16px;
                    margin-bottom: 22px;
                }

                .stat-card {
                    display: flex;
                    align-items: center;
                    gap: 13px;
                    background: #fff;
                    border: 1px solid #e6eaf0;
                    border-radius: 13px;
                    padding: 17px;
                    box-shadow: 0 2px 8px
                        rgba(16, 24, 40, 0.04);
                }

                .stat-icon {
                    width: 42px;
                    height: 42px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 10px;
                    font-size: 18px;
                    font-weight: 700;
                }

                .stat-icon.pending {
                    background: #fffaeb;
                    color: #b54708;
                }

                .stat-icon.sent {
                    background: #ecfdf3;
                    color: #027a48;
                }

                .stat-icon.failed {
                    background: #fff1f2;
                    color: #b42318;
                }

                .stat-icon.total {
                    background: #eef4ff;
                    color: #3157c8;
                }

                .stat-card span {
                    display: block;
                    color: #667085;
                    font-size: 12px;
                    margin-bottom: 4px;
                }

                .stat-card strong {
                    display: block;
                    color: #172033;
                    font-size: 21px;
                }

                .toolbar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: #fff;
                    border: 1px solid #e6eaf0;
                    border-radius: 12px;
                    padding: 10px;
                    margin-bottom: 16px;
                }

                .filters {
                    display: flex;
                    gap: 5px;
                    flex-wrap: wrap;
                }

                .filter {
                    border: 0;
                    background: transparent;
                    color: #667085;
                    padding: 9px 15px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 600;
                }

                .filter:hover {
                    background: #f8fafc;
                }

                .filter.active {
                    background: #eef4ff;
                    color: #3157c8;
                }

                .notification-list {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .notification-card {
                    display: flex;
                    gap: 15px;
                    background: #fff;
                    border: 1px solid #e6eaf0;
                    border-radius: 13px;
                    padding: 18px;
                    box-shadow: 0 2px 8px
                        rgba(16, 24, 40, 0.035);
                }

                .notification-icon {
                    width: 42px;
                    height: 42px;
                    flex-shrink: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 10px;
                    font-weight: 800;
                    font-size: 17px;
                }

                .notification-icon.pending {
                    background: #fffaeb;
                    color: #b54708;
                }

                .notification-icon.sent {
                    background: #ecfdf3;
                    color: #027a48;
                }

                .notification-icon.failed {
                    background: #fff1f2;
                    color: #b42318;
                }

                .notification-content {
                    flex: 1;
                    min-width: 0;
                }

                .notification-top {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 15px;
                }

                .notification-top h2 {
                    margin: 0;
                    font-size: 15px;
                    color: #172033;
                }

                .meta {
                    display: flex;
                    gap: 10px;
                    flex-wrap: wrap;
                    margin-top: 7px;
                }

                .meta span {
                    color: #667085;
                    font-size: 11px;
                }

                .meta span:not(:last-child)::after {
                    content: "•";
                    margin-left: 10px;
                    color: #c5cbd3;
                }

                .status {
                    flex-shrink: 0;
                    border-radius: 999px;
                    padding: 5px 9px;
                    font-size: 10px;
                    font-weight: 700;
                    text-transform: uppercase;
                }

                .status.pending {
                    background: #fffaeb;
                    color: #b54708;
                }

                .status.sent {
                    background: #ecfdf3;
                    color: #027a48;
                }

                .status.failed {
                    background: #fff1f2;
                    color: #b42318;
                }

                .message {
                    margin: 13px 0;
                    color: #475467;
                    font-size: 13px;
                    line-height: 1.55;
                }

                .notification-bottom {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 15px;
                    padding-top: 13px;
                    border-top: 1px solid #f0f2f5;
                }

                .dates {
                    display: flex;
                    gap: 14px;
                    flex-wrap: wrap;
                    color: #98a2b3;
                    font-size: 11px;
                }

                .actions {
                    display: flex;
                    gap: 7px;
                    flex-wrap: wrap;
                }

                .action-btn {
                    border: 1px solid #d0d5dd;
                    background: #fff;
                    border-radius: 7px;
                    padding: 7px 11px;
                    cursor: pointer;
                    font-size: 11px;
                    font-weight: 600;
                }

                .action-btn:disabled {
                    opacity: 0.55;
                    cursor: not-allowed;
                }

                .sent-btn {
                    color: #027a48;
                    border-color: #abefc6;
                }

                .failed-btn {
                    color: #b42318;
                    border-color: #fecdd3;
                }

                .pending-btn {
                    color: #3157c8;
                    border-color: #bfd1ff;
                }

                .loading,
                .empty-state {
                    background: #fff;
                    border: 1px solid #e6eaf0;
                    border-radius: 14px;
                    padding: 55px 20px;
                    text-align: center;
                }

                .loading {
                    color: #667085;
                }

                .empty-icon {
                    width: 52px;
                    height: 52px;
                    margin: 0 auto 15px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 14px;
                    background: #ecfdf3;
                    color: #027a48;
                    font-size: 22px;
                    font-weight: 700;
                }

                .empty-state h2 {
                    margin: 0;
                    color: #172033;
                    font-size: 18px;
                }

                .empty-state p {
                    margin: 7px 0 0;
                    color: #667085;
                    font-size: 14px;
                }

                @media (max-width: 900px) {
                    .stats-grid {
                        grid-template-columns: repeat(
                            2,
                            minmax(0, 1fr)
                        );
                    }
                }

                @media (max-width: 600px) {
                    .page-header {
                        flex-direction: column;
                    }

                    .refresh-btn {
                        width: 100%;
                    }

                    .stats-grid {
                        grid-template-columns: 1fr;
                    }

                    .notification-card {
                        padding: 14px;
                    }

                    .notification-top {
                        flex-direction: column;
                    }

                    .notification-bottom {
                        align-items: flex-start;
                        flex-direction: column;
                    }

                    .actions {
                        width: 100%;
                    }

                    .action-btn {
                        flex: 1;
                    }
                }
            `}</style>
        </div>
    );
}