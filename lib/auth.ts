const TOKEN_KEY = "sla_auth_token";

export function setAuthToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
}

export function getAuthToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
}

export function removeAuthToken() {
    localStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
    return !!getAuthToken();
}