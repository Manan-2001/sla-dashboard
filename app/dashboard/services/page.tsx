"use client";

import { useEffect, useState } from "react";
import {
    getServices,
    createService,
    updateService,
    deleteService,
    checkService,
} from "@/lib/api";
import { getAuthToken } from "@/lib/auth";

type Service = {
    id: number;
    name: string;
    url: string;
    description?: string;
    enabled: number;
    status?: string;
    created_at?: string;
    updated_at?: string;
};

type ServiceForm = {
    name: string;
    url: string;
    description: string;
    enabled: number;
};

export default function ServicesPage() {
    const [services, setServices] =
        useState<Service[]>([]);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState<string | null>(null);

    const [showForm, setShowForm] =
        useState(false);

    const [editingService, setEditingService] =
        useState<Service | null>(null);

    const [checkingId, setCheckingId] =
        useState<number | null>(null);

    const [deletingId, setDeletingId] =
        useState<number | null>(null);

    const [form, setForm] =
        useState<ServiceForm>({
            name: "",
            url: "",
            description: "",
            enabled: 1,
        });

    async function loadServices() {
        try {
            setLoading(true);
            setError(null);

            const result =
                (await getServices()) as any;

            if (result.success === false) {
                throw new Error(
                    result.message ||
                        "Failed to load services"
                );
            }

            setServices(
                result.data || []
            );
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to load services"
            );
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadServices();
    }, []);

    function openCreateForm() {
        setEditingService(null);

        setForm({
            name: "",
            url: "",
            description: "",
            enabled: 1,
        });

        setShowForm(true);
    }

    function openEditForm(
        service: Service
    ) {
        setEditingService(service);

        setForm({
            name: service.name,
            url: service.url,
            description:
                service.description || "",
            enabled: service.enabled,
        });

        setShowForm(true);
    }

    function closeForm() {
        setShowForm(false);
        setEditingService(null);
    }

    async function handleSubmit(
        event: React.FormEvent
    ) {
        event.preventDefault();

        const token = getAuthToken();

        if (!token) {
            setError(
                "Your session has expired. Please login again."
            );
            return;
        }

        if (
            !form.name.trim() ||
            !form.url.trim()
        ) {
            setError(
                "Service name and URL are required."
            );
            return;
        }

        try {
            setError(null);

            if (editingService) {
                await updateService(
                    editingService.id,
                    {
                        name: form.name,
                        url: form.url,
                        description:
                            form.description,
                        enabled:
                            form.enabled,
                    },
                    token
                );
            } else {
                await createService(
                    {
                        name: form.name,
                        url: form.url,
                        description:
                            form.description,
                        enabled:
                            form.enabled,
                    },
                    token
                );
            }

            closeForm();
            await loadServices();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to save service"
            );
        }
    }

    async function handleDelete(
        service: Service
    ) {
        const confirmed =
            window.confirm(
                `Are you sure you want to delete "${service.name}"?`
            );

        if (!confirmed) {
            return;
        }

        const token = getAuthToken();

        if (!token) {
            setError(
                "Your session has expired. Please login again."
            );
            return;
        }

        try {
            setDeletingId(service.id);
            setError(null);

            await deleteService(
                service.id,
                token
            );

            await loadServices();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to delete service"
            );
        } finally {
            setDeletingId(null);
        }
    }

    async function handleCheck(
        service: Service
    ) {
        const token = getAuthToken();

        if (!token) {
            setError(
                "Your session has expired. Please login again."
            );
            return;
        }

        try {
            setCheckingId(service.id);
            setError(null);

            await checkService(
                service.id,
                token
            );

            await loadServices();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Service check failed"
            );
        } finally {
            setCheckingId(null);
        }
    }

    return (
        <main>
            <div className="page-header">
                <div>
                    <h1>Services</h1>

                    <p>
                        Manage and monitor your
                        registered services.
                    </p>
                </div>

                <button
                    className="primary-button"
                    onClick={
                        openCreateForm
                    }
                >
                    + Add Service
                </button>
            </div>

            {error && (
                <div className="error-box">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="loading">
                    Loading services...
                </div>
            ) : services.length === 0 ? (
                <div className="empty-state">
                    <h3>
                        No services found
                    </h3>

                    <p>
                        Add your first service
                        to start monitoring it.
                    </p>

                    <button
                        className="primary-button"
                        onClick={
                            openCreateForm
                        }
                    >
                        Add Service
                    </button>
                </div>
            ) : (
                <div className="services-grid">
                    {services.map(
                        (service) => (
                            <ServiceCard
                                key={
                                    service.id
                                }
                                service={
                                    service
                                }
                                checking={
                                    checkingId ===
                                    service.id
                                }
                                deleting={
                                    deletingId ===
                                    service.id
                                }
                                onEdit={
                                    openEditForm
                                }
                                onDelete={
                                    handleDelete
                                }
                                onCheck={
                                    handleCheck
                                }
                            />
                        )
                    )}
                </div>
            )}

            {showForm && (
                <div
                    className="modal-backdrop"
                    onMouseDown={(event) => {
                        if (
                            event.target ===
                            event.currentTarget
                        ) {
                            closeForm();
                        }
                    }}
                >
                    <div className="modal">
                        <div className="modal-header">
                            <div>
                                <h2>
                                    {editingService
                                        ? "Edit Service"
                                        : "Add Service"}
                                </h2>

                                <p>
                                    Configure the
                                    service you want
                                    to monitor.
                                </p>
                            </div>

                            <button
                                className="close-button"
                                onClick={
                                    closeForm
                                }
                            >
                                ×
                            </button>
                        </div>

                        <form
                            onSubmit={
                                handleSubmit
                            }
                        >
                            <div className="form-group">
                                <label>
                                    Service Name
                                </label>

                                <input
                                    type="text"
                                    value={
                                        form.name
                                    }
                                    onChange={(
                                        event
                                    ) =>
                                        setForm({
                                            ...form,
                                            name: event
                                                .target
                                                .value,
                                        })
                                    }
                                    placeholder="Example Website"
                                />
                            </div>

                            <div className="form-group">
                                <label>
                                    Service URL
                                </label>

                                <input
                                    type="url"
                                    value={
                                        form.url
                                    }
                                    onChange={(
                                        event
                                    ) =>
                                        setForm({
                                            ...form,
                                            url: event
                                                .target
                                                .value,
                                        })
                                    }
                                    placeholder="https://example.com"
                                />
                            </div>

                            <div className="form-group">
                                <label>
                                    Description
                                </label>

                                <textarea
                                    value={
                                        form.description
                                    }
                                    onChange={(
                                        event
                                    ) =>
                                        setForm({
                                            ...form,
                                            description:
                                                event
                                                    .target
                                                    .value,
                                        })
                                    }
                                    placeholder="Optional description"
                                    rows={4}
                                />
                            </div>

                            <div className="form-group">
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={
                                            form.enabled ===
                                            1
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            setForm({
                                                ...form,
                                                enabled:
                                                    event
                                                        .target
                                                        .checked
                                                        ? 1
                                                        : 0,
                                            })
                                        }
                                    />

                                    Enable monitoring
                                </label>
                            </div>

                            <div className="form-actions">
                                <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={
                                        closeForm
                                    }
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="primary-button"
                                >
                                    {editingService
                                        ? "Update Service"
                                        : "Create Service"}
                                </button>
                            </div>
                        </form>
                    </div>
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

                .primary-button,
                .secondary-button {
                    border: none;
                    border-radius: 8px;
                    padding: 11px 18px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                }

                .primary-button {
                    background: #2563eb;
                    color: white;
                }

                .primary-button:hover {
                    background: #1d4ed8;
                }

                .secondary-button {
                    background: #e5e7eb;
                    color: #374151;
                }

                .error-box {
                    padding: 14px 16px;
                    margin-bottom: 20px;
                    background: #fef2f2;
                    color: #b91c1c;
                    border: 1px solid #fecaca;
                    border-radius: 8px;
                }

                .loading {
                    padding: 50px;
                    text-align: center;
                    color: #6b7280;
                }

                .empty-state {
                    background: white;
                    border-radius: 12px;
                    padding: 60px 30px;
                    text-align: center;
                    border: 1px solid #e5e7eb;
                }

                .empty-state h3 {
                    margin: 0 0 8px;
                }

                .empty-state p {
                    color: #6b7280;
                    margin-bottom: 20px;
                }

                .services-grid {
                    display: grid;
                    grid-template-columns:
                        repeat(
                            auto-fill,
                            minmax(280px, 1fr)
                        );
                    gap: 20px;
                }

                .service-card {
                    background: white;
                    border: 1px solid #e5e7eb;
                    border-radius: 12px;
                    padding: 22px;
                }

                .service-top {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 12px;
                }

                .service-name {
                    margin: 0;
                    font-size: 18px;
                }

                .service-url {
                    margin-top: 7px;
                    color: #6b7280;
                    font-size: 13px;
                    word-break: break-all;
                }

                .status-badge {
                    padding: 5px 9px;
                    border-radius: 20px;
                    font-size: 11px;
                    font-weight: 700;
                    white-space: nowrap;
                }

                .status-up {
                    background: #dcfce7;
                    color: #15803d;
                }

                .status-down {
                    background: #fee2e2;
                    color: #b91c1c;
                }

                .status-unknown {
                    background: #f3f4f6;
                    color: #6b7280;
                }

                .service-description {
                    min-height: 42px;
                    margin: 20px 0;
                    color: #6b7280;
                    font-size: 14px;
                }

                .service-actions {
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                }

                .action-button {
                    flex: 1;
                    border: 1px solid #d1d5db;
                    background: white;
                    color: #374151;
                    padding: 9px 12px;
                    border-radius: 7px;
                    cursor: pointer;
                    font-size: 13px;
                }

                .action-button:hover {
                    background: #f9fafb;
                }

                .delete-button {
                    color: #dc2626;
                    border-color: #fecaca;
                }

                .modal-backdrop {
                    position: fixed;
                    inset: 0;
                    background: rgba(
                        0,
                        0,
                        0,
                        0.5
                    );
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                    z-index: 2000;
                }

                .modal {
                    width: 100%;
                    max-width: 520px;
                    max-height: 90vh;
                    overflow-y: auto;
                    background: white;
                    border-radius: 14px;
                    padding: 25px;
                }

                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    gap: 20px;
                    margin-bottom: 25px;
                }

                .modal-header h2 {
                    margin: 0;
                }

                .modal-header p {
                    margin: 6px 0 0;
                    color: #6b7280;
                    font-size: 14px;
                }

                .close-button {
                    width: 32px;
                    height: 32px;
                    border: none;
                    background: #f3f4f6;
                    border-radius: 50%;
                    font-size: 22px;
                    cursor: pointer;
                }

                .form-group {
                    margin-bottom: 18px;
                }

                .form-group label {
                    display: block;
                    margin-bottom: 7px;
                    font-size: 14px;
                    font-weight: 600;
                }

                .form-group input[type="text"],
                .form-group input[type="url"],
                .form-group textarea {
                    width: 100%;
                    padding: 11px 12px;
                    border: 1px solid #d1d5db;
                    border-radius: 8px;
                    font-size: 14px;
                    font-family: inherit;
                    outline: none;
                }

                .form-group input:focus,
                .form-group textarea:focus {
                    border-color: #2563eb;
                }

                .checkbox-label {
                    display: flex !important;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                }

                .checkbox-label input {
                    width: 16px;
                    height: 16px;
                }

                .form-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                    margin-top: 25px;
                }

                @media (max-width: 600px) {
                    .page-header {
                        align-items: flex-start;
                        flex-direction: column;
                    }

                    .services-grid {
                        grid-template-columns: 1fr;
                    }

                    .form-actions {
                        flex-direction: column-reverse;
                    }

                    .form-actions button {
                        width: 100%;
                    }
                }
            `}</style>
        </main>
    );
}

function ServiceCard({
    service,
    checking,
    deleting,
    onEdit,
    onDelete,
    onCheck,
}: {
    service: Service;
    checking: boolean;
    deleting: boolean;
    onEdit: (service: Service) => void;
    onDelete: (service: Service) => void;
    onCheck: (service: Service) => void;
}) {
    const status =
        service.status?.toLowerCase();

    let statusClass =
        "status-unknown";

    let statusText =
        "Unknown";

    if (
        status === "up" ||
        status === "success"
    ) {
        statusClass = "status-up";
        statusText = "Up";
    } else if (
        status === "down" ||
        status === "failure"
    ) {
        statusClass = "status-down";
        statusText = "Down";
    }

    return (
        <div className="service-card">
            <div className="service-top">
                <div>
                    <h3 className="service-name">
                        {service.name}
                    </h3>

                    <div className="service-url">
                        {service.url}
                    </div>
                </div>

                <span
                    className={`status-badge ${statusClass}`}
                >
                    {statusText}
                </span>
            </div>

            <p className="service-description">
                {service.description ||
                    "No description provided."}
            </p>

            <div className="service-actions">
                <button
                    className="action-button"
                    onClick={() =>
                        onCheck(service)
                    }
                    disabled={
                        checking ||
                        deleting
                    }
                >
                    {checking
                        ? "Checking..."
                        : "Check Now"}
                </button>

                <button
                    className="action-button"
                    onClick={() =>
                        onEdit(service)
                    }
                    disabled={
                        checking ||
                        deleting
                    }
                >
                    Edit
                </button>

                <button
                    className="action-button delete-button"
                    onClick={() =>
                        onDelete(service)
                    }
                    disabled={
                        checking ||
                        deleting
                    }
                >
                    {deleting
                        ? "Deleting..."
                        : "Delete"}
                </button>
            </div>
        </div>
    );
}