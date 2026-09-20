const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:8787";

// ============================================
// Generic API request helper
// ============================================

async function apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const response = await fetch(
        `${API_BASE_URL}${endpoint}`,
        {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...(options.headers || {}),
            },
        }
    );

    const data :any = await response.json();

    if (!response.ok) {
        throw new Error(
            data?.message ||
            "Something went wrong"
        );
    }

    return data;
}

// ============================================
// Health
// ============================================

export function getHealth() {
    return apiRequest("/health");
}

// ============================================
// Authentication
// ============================================

export function login(
    email: string,
    password: string
) {
    return apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
            email,
            password,
        }),
    });
}

export function getCurrentAdmin(
    token: string
) {
    return apiRequest("/api/auth/me", {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}

export function logout(
    token: string
) {
    return apiRequest("/api/auth/logout", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}

// ============================================
// Services
// ============================================

export function getServices() {
    return apiRequest("/api/services");
}

export function getService(
    serviceId: number
) {
    return apiRequest(
        `/api/services/${serviceId}`
    );
}

export function createService(
    data: {
        name: string;
        url: string;
        description?: string;
        enabled?: number;
    },
    token: string
) {
    return apiRequest("/api/services", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
    });
}

export function updateService(
    serviceId: number,
    data: {
        name?: string;
        url?: string;
        description?: string;
        enabled?: number;
    },
    token: string
) {
    return apiRequest(
        `/api/services/${serviceId}`,
        {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(data),
        }
    );
}

export function deleteService(
    serviceId: number,
    token: string
) {
    return apiRequest(
        `/api/services/${serviceId}`,
        {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );
}

export function checkService(
    serviceId: number,
    token: string
) {
    return apiRequest(
        `/api/services/${serviceId}/check`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );
}

// ============================================
// SLA
// ============================================

export function getServiceSla(
    serviceId: number
) {
    return apiRequest(
        `/api/services/${serviceId}/sla`
    );
}

export function getSlaRule(
    serviceId: number
) {
    return apiRequest(
        `/api/services/${serviceId}/sla-rule`
    );
}

export function createSlaRule(
    serviceId: number,
    data: {
        target_percentage?: number;
        response_time_limit_ms?: number;
        evaluation_period_days?: number;
    },
    token: string
) {
    return apiRequest(
        `/api/services/${serviceId}/sla-rule`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(data),
        }
    );
}

export function updateSlaRule(
    serviceId: number,
    data: {
        target_percentage?: number;
        response_time_limit_ms?: number;
        evaluation_period_days?: number;
    },
    token: string
) {
    return apiRequest(
        `/api/services/${serviceId}/sla-rule`,
        {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(data),
        }
    );
}

// ============================================
// Incidents
// ============================================

export function getIncidents() {
    return apiRequest("/api/incidents");
}

export function getIncident(
    incidentId: number
) {
    return apiRequest(
        `/api/incidents/${incidentId}`
    );
}

// ============================================
// Notifications
// ============================================

export function getNotifications(
    params?: {
        status?: "pending" | "sent" | "failed";
        service_id?: number;
    }
) {
    const searchParams =
        new URLSearchParams();

    if (params?.status) {
        searchParams.set(
            "status",
            params.status
        );
    }

    if (params?.service_id !== undefined) {
        searchParams.set(
            "service_id",
            String(params.service_id)
        );
    }

    const query =
        searchParams.toString();

    return apiRequest(
        `/api/notifications${query ? `?${query}` : ""}`
    );
}

export function getNotification(
    notificationId: number
) {
    return apiRequest(
        `/api/notifications/${notificationId}`
    );
}

export function updateNotification(
    notificationId: number,
    status:
        | "pending"
        | "sent"
        | "failed",
    token: string
) {
    return apiRequest(
        `/api/notifications/${notificationId}`,
        {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                status,
            }),
        }
    );
}

// ============================================
// Dashboard
// ============================================

export function getDashboardSummary() {
    return apiRequest(
        "/api/dashboard/summary"
    );
}