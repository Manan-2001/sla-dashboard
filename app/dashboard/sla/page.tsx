"use client";

import { useEffect, useState } from "react";
import {
    getServices,
    getSlaRule,
    createSlaRule,
    updateSlaRule,
} from "@/lib/api";
import { getAuthToken } from "@/lib/auth";

type Service = {
    id: number;
    name: string;
    url?: string;
};

type SlaRule = {
    id?: number;
    service_id?: number;
    target_percentage?: number;
    response_time_limit_ms?: number;
    evaluation_period_days?: number;
};

export default function SlaPage() {
    const [services, setServices] = useState<Service[]>([]);
    const [selectedServiceId, setSelectedServiceId] =
        useState<number | null>(null);

    const [slaRule, setSlaRule] = useState<SlaRule | null>(null);

    const [targetPercentage, setTargetPercentage] =
        useState("99.9");

    const [responseTimeLimit, setResponseTimeLimit] =
        useState("1000");

    const [evaluationPeriod, setEvaluationPeriod] =
        useState("30");

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        loadServices();
    }, []);

    useEffect(() => {
        if (selectedServiceId) {
            loadSlaRule(selectedServiceId);
        }
    }, [selectedServiceId]);

    async function loadServices() {
        try {
            setLoading(true);
            setError("");

            const result: any = await getServices();

            const serviceData =
                Array.isArray(result?.data)
                    ? result.data
                    : Array.isArray(result?.data?.services)
                        ? result.data.services
                        : Array.isArray(result)
                            ? result
                            : [];

            setServices(serviceData);

            if (serviceData.length > 0) {
                setSelectedServiceId(serviceData[0].id);
            }
        } catch (err: any) {
            setError(
                err?.message ||
                "Failed to load services"
            );
        } finally {
            setLoading(false);
        }
    }

    async function loadSlaRule(serviceId: number) {
        try {
            setError("");
            setSuccess("");

            const result: any =
                await getSlaRule(serviceId);

            const rule =
                result?.data?.rule ||
                result?.data ||
                result?.rule ||
                null;

            setSlaRule(rule);

            if (rule) {
                setTargetPercentage(
                    String(
                        rule.target_percentage ??
                        "99.9"
                    )
                );

                setResponseTimeLimit(
                    String(
                        rule.response_time_limit_ms ??
                        "1000"
                    )
                );

                setEvaluationPeriod(
                    String(
                        rule.evaluation_period_days ??
                        "30"
                    )
                );
            } else {
                setTargetPercentage("99.9");
                setResponseTimeLimit("1000");
                setEvaluationPeriod("30");
            }
        } catch (err: any) {
            /*
             * If no SLA rule exists yet, keep the
             * default values so the user can create one.
             */
            setSlaRule(null);
            setTargetPercentage("99.9");
            setResponseTimeLimit("1000");
            setEvaluationPeriod("30");

            if (
                err?.message &&
                !err.message
                    .toLowerCase()
                    .includes("not found")
            ) {
                setError(err.message);
            }
        }
    }

    async function handleSave() {
        if (!selectedServiceId) {
            setError("Please select a service.");
            return;
        }

        const target = Number(targetPercentage);
        const responseLimit = Number(responseTimeLimit);
        const period = Number(evaluationPeriod);

        if (
            !Number.isFinite(target) ||
            target <= 0 ||
            target > 100
        ) {
            setError(
                "Target percentage must be between 0 and 100."
            );
            return;
        }

        if (
            !Number.isFinite(responseLimit) ||
            responseLimit <= 0
        ) {
            setError(
                "Response time limit must be greater than 0."
            );
            return;
        }

        if (
            !Number.isFinite(period) ||
            period <= 0
        ) {
            setError(
                "Evaluation period must be greater than 0."
            );
            return;
        }

        try {
            setSaving(true);
            setError("");
            setSuccess("");

            const token = getAuthToken();

            if (!token) {
                setError(
                    "Authentication required. Please login again."
                );
                return;
            }

            const data = {
                target_percentage: target,
                response_time_limit_ms: responseLimit,
                evaluation_period_days: period,
            };

            if (slaRule) {
                await updateSlaRule(
                    selectedServiceId,
                    data,
                    token
                );

                setSuccess(
                    "SLA rule updated successfully."
                );
            } else {
                await createSlaRule(
                    selectedServiceId,
                    data,
                    token
                );

                setSuccess(
                    "SLA rule created successfully."
                );
            }

            await loadSlaRule(selectedServiceId);
        } catch (err: any) {
            setError(
                err?.message ||
                "Failed to save SLA rule."
            );
        } finally {
            setSaving(false);
        }
    }

    const selectedService = services.find(
        (service) =>
            service.id === selectedServiceId
    );

    return (
        <div className="sla-page">
            <div className="page-header">
                <div>
                    <h1>SLA Management</h1>
                    <p>
                        Configure service-level objectives
                        and monitoring thresholds.
                    </p>
                </div>

                <button
                    className="refresh-btn"
                    onClick={() => {
                        if (selectedServiceId) {
                            loadSlaRule(
                                selectedServiceId
                            );
                        }
                    }}
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

            {loading ? (
                <div className="loading">
                    Loading services...
                </div>
            ) : services.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">⚙</div>

                    <h2>No services found</h2>

                    <p>
                        Add a service first before
                        configuring its SLA rule.
                    </p>
                </div>
            ) : (
                <div className="content-grid">
                    <section className="card service-card">
                        <div className="card-header">
                            <div>
                                <h2>Select Service</h2>
                                <p>
                                    Choose the service whose
                                    SLA you want to configure.
                                </p>
                            </div>
                        </div>

                        <div className="service-list">
                            {services.map((service) => (
                                <button
                                    key={service.id}
                                    className={`service-option ${
                                        selectedServiceId ===
                                        service.id
                                            ? "active"
                                            : ""
                                    }`}
                                    onClick={() =>
                                        setSelectedServiceId(
                                            service.id
                                        )
                                    }
                                >
                                    <div className="service-icon">
                                        ◉
                                    </div>

                                    <div className="service-info">
                                        <strong>
                                            {service.name}
                                        </strong>

                                        {service.url && (
                                            <span>
                                                {service.url}
                                            </span>
                                        )}
                                    </div>

                                    <span className="arrow">
                                        →
                                    </span>
                                </button>
                            ))}
                        </div>
                    </section>

                    <section className="card rule-card">
                        <div className="card-header">
                            <div>
                                <h2>SLA Rule</h2>

                                <p>
                                    {selectedService
                                        ? `Configure SLA for ${selectedService.name}`
                                        : "Configure service SLA"}
                                </p>
                            </div>

                            <span
                                className={`rule-status ${
                                    slaRule
                                        ? "configured"
                                        : "not-configured"
                                }`}
                            >
                                {slaRule
                                    ? "Configured"
                                    : "Not configured"}
                            </span>
                        </div>

                        <div className="form">
                            <div className="form-group">
                                <label>
                                    Availability Target
                                </label>

                                <div className="input-with-unit">
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.01"
                                        value={
                                            targetPercentage
                                        }
                                        onChange={(e) =>
                                            setTargetPercentage(
                                                e.target.value
                                            )
                                        }
                                    />

                                    <span>%</span>
                                </div>

                                <small>
                                    Target availability
                                    percentage for the
                                    evaluation period.
                                </small>
                            </div>

                            <div className="form-group">
                                <label>
                                    Response Time Limit
                                </label>

                                <div className="input-with-unit">
                                    <input
                                        type="number"
                                        min="1"
                                        value={
                                            responseTimeLimit
                                        }
                                        onChange={(e) =>
                                            setResponseTimeLimit(
                                                e.target.value
                                            )
                                        }
                                    />

                                    <span>ms</span>
                                </div>

                                <small>
                                    Maximum acceptable
                                    response time.
                                </small>
                            </div>

                            <div className="form-group">
                                <label>
                                    Evaluation Period
                                </label>

                                <div className="input-with-unit">
                                    <input
                                        type="number"
                                        min="1"
                                        value={
                                            evaluationPeriod
                                        }
                                        onChange={(e) =>
                                            setEvaluationPeriod(
                                                e.target.value
                                            )
                                        }
                                    />

                                    <span>days</span>
                                </div>

                                <small>
                                    Number of days used for
                                    SLA evaluation.
                                </small>
                            </div>

                            <div className="sla-preview">
                                <div className="preview-title">
                                    SLA Configuration
                                </div>

                                <div className="preview-row">
                                    <span>
                                        Availability
                                    </span>

                                    <strong>
                                        {targetPercentage}%
                                    </strong>
                                </div>

                                <div className="preview-row">
                                    <span>
                                        Response Limit
                                    </span>

                                    <strong>
                                        {
                                            responseTimeLimit
                                        }{" "}
                                        ms
                                    </strong>
                                </div>

                                <div className="preview-row">
                                    <span>
                                        Evaluation
                                    </span>

                                    <strong>
                                        {
                                            evaluationPeriod
                                        }{" "}
                                        days
                                    </strong>
                                </div>
                            </div>

                            <button
                                className="save-btn"
                                onClick={handleSave}
                                disabled={saving}
                            >
                                {saving
                                    ? "Saving..."
                                    : slaRule
                                        ? "Update SLA Rule"
                                        : "Create SLA Rule"}
                            </button>
                        </div>
                    </section>
                </div>
            )}

            <style jsx>{`
                .sla-page {
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

                .content-grid {
                    display: grid;
                    grid-template-columns: 330px minmax(0, 1fr);
                    gap: 20px;
                    align-items: start;
                }

                .card {
                    background: #fff;
                    border: 1px solid #e6eaf0;
                    border-radius: 14px;
                    box-shadow: 0 2px 8px rgba(16, 24, 40, 0.04);
                }

                .card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 16px;
                    padding: 20px;
                    border-bottom: 1px solid #edf0f4;
                }

                .card-header h2 {
                    margin: 0;
                    font-size: 17px;
                    color: #172033;
                }

                .card-header p {
                    margin: 6px 0 0;
                    color: #7b8798;
                    font-size: 13px;
                    line-height: 1.5;
                }

                .service-list {
                    padding: 10px;
                }

                .service-option {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    border: 0;
                    background: transparent;
                    padding: 13px 12px;
                    border-radius: 10px;
                    cursor: pointer;
                    text-align: left;
                    margin-bottom: 4px;
                }

                .service-option:hover {
                    background: #f7f9fc;
                }

                .service-option.active {
                    background: #eef4ff;
                }

                .service-icon {
                    width: 38px;
                    height: 38px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 9px;
                    background: #eef2f7;
                    color: #475467;
                    flex-shrink: 0;
                }

                .service-option.active .service-icon {
                    background: #dbe8ff;
                    color: #3157c8;
                }

                .service-info {
                    min-width: 0;
                    flex: 1;
                }

                .service-info strong {
                    display: block;
                    color: #344054;
                    font-size: 14px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .service-info span {
                    display: block;
                    margin-top: 4px;
                    color: #98a2b3;
                    font-size: 11px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .arrow {
                    color: #98a2b3;
                    font-size: 18px;
                }

                .service-option.active .arrow {
                    color: #3157c8;
                }

                .rule-status {
                    font-size: 11px;
                    font-weight: 700;
                    padding: 6px 9px;
                    border-radius: 999px;
                    white-space: nowrap;
                }

                .rule-status.configured {
                    color: #027a48;
                    background: #ecfdf3;
                }

                .rule-status.not-configured {
                    color: #b54708;
                    background: #fffaeb;
                }

                .form {
                    padding: 22px;
                }

                .form-group {
                    margin-bottom: 22px;
                }

                .form-group label {
                    display: block;
                    color: #344054;
                    font-size: 13px;
                    font-weight: 600;
                    margin-bottom: 8px;
                }

                .input-with-unit {
                    display: flex;
                    align-items: center;
                    border: 1px solid #d0d5dd;
                    border-radius: 9px;
                    overflow: hidden;
                    background: #fff;
                }

                .input-with-unit:focus-within {
                    border-color: #7c9cff;
                    box-shadow: 0 0 0 3px rgba(49, 87, 200, 0.08);
                }

                .input-with-unit input {
                    width: 100%;
                    min-width: 0;
                    border: 0;
                    outline: 0;
                    padding: 12px 13px;
                    font-size: 14px;
                    color: #172033;
                }

                .input-with-unit span {
                    padding: 0 14px;
                    color: #667085;
                    font-size: 13px;
                    border-left: 1px solid #eaecf0;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    background: #f9fafb;
                }

                .form-group small {
                    display: block;
                    margin-top: 7px;
                    color: #98a2b3;
                    font-size: 12px;
                }

                .sla-preview {
                    border: 1px solid #e5e7eb;
                    border-radius: 11px;
                    background: #f8fafc;
                    padding: 16px;
                    margin: 26px 0 20px;
                }

                .preview-title {
                    font-size: 12px;
                    font-weight: 700;
                    color: #667085;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    margin-bottom: 13px;
                }

                .preview-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 9px 0;
                    border-bottom: 1px solid #e5e7eb;
                    font-size: 13px;
                }

                .preview-row:last-child {
                    border-bottom: 0;
                    padding-bottom: 0;
                }

                .preview-row span {
                    color: #667085;
                }

                .preview-row strong {
                    color: #172033;
                }

                .save-btn {
                    width: 100%;
                    border: 0;
                    border-radius: 9px;
                    background: #3157c8;
                    color: #fff;
                    padding: 13px 18px;
                    font-size: 14px;
                    font-weight: 700;
                    cursor: pointer;
                }

                .save-btn:hover {
                    background: #2849aa;
                }

                .save-btn:disabled {
                    opacity: 0.65;
                    cursor: not-allowed;
                }

                .loading {
                    background: #fff;
                    border: 1px solid #e6eaf0;
                    border-radius: 14px;
                    padding: 50px;
                    text-align: center;
                    color: #667085;
                }

                .empty-state {
                    background: #fff;
                    border: 1px solid #e6eaf0;
                    border-radius: 14px;
                    padding: 60px 20px;
                    text-align: center;
                }

                .empty-icon {
                    width: 52px;
                    height: 52px;
                    margin: 0 auto 15px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 14px;
                    background: #f2f4f7;
                    color: #667085;
                    font-size: 22px;
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
                    .content-grid {
                        grid-template-columns: 1fr;
                    }

                    .service-list {
                        display: grid;
                        grid-template-columns: repeat(
                            2,
                            minmax(0, 1fr)
                        );
                        gap: 5px;
                    }
                }

                @media (max-width: 600px) {
                    .page-header {
                        flex-direction: column;
                    }

                    .refresh-btn {
                        width: 100%;
                    }

                    .service-list {
                        grid-template-columns: 1fr;
                    }

                    .card-header {
                        padding: 16px;
                    }

                    .form {
                        padding: 16px;
                    }
                }
            `}</style>
        </div>
    );
}