// ============================================
// SLA Monitoring Worker
// Cloudflare Worker + D1
// ============================================

type ServiceStatus = 'up' | 'down' | 'degraded' | 'unknown';

type CheckStatus = 'success' | 'failure' | 'timeout';

type IncidentStatus = 'open' | 'investigating' | 'resolved';

type NotificationType = 'email' | 'webhook' | 'dashboard';

type NotificationStatus = 'pending' | 'sent' | 'failed';

type AdminRole = 'admin' | 'viewer';

// ============================================
// TYPES
// ============================================

type Service = {
	id: number;
	name: string;
	url: string;
	description: string | null;
	status: ServiceStatus;
	enabled: number;
	created_at: string;
	updated_at: string;
};

type SlaRule = {
	id: number;
	service_id: number;
	target_percentage: number;
	response_time_limit_ms: number;
	evaluation_period_days: number;
	created_at: string;
	updated_at: string;
};

type Admin = {
	id: number;
	email: string;
	role: AdminRole;
};

type AuthenticatedAdmin = {
	id: number;
	email: string;
	role: string;
};

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_SLA_TARGET = 99.9;
const DEFAULT_RESPONSE_TIME_LIMIT_MS = 2000;
const DEFAULT_EVALUATION_PERIOD_DAYS = 30;

const SERVICE_CHECK_TIMEOUT_MS = 10000;
const SESSION_DURATION_HOURS = 24;

// ============================================
// HELPER - JSON RESPONSE
// ============================================

function jsonResponse(data: unknown, status = 200): Response {
	return Response.json(data, {
		status,
		headers: {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': 'http://localhost:3000',
			'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization',
		},
	});
}

// ============================================
// HELPER - VALIDATION ERROR
// ============================================

function validationError(message: string): Response {
	return jsonResponse(
		{
			success: false,
			message,
		},
		400,
	);
}

// ============================================
// HELPER - NOT FOUND
// ============================================

function notFoundError(message = 'Resource not found'): Response {
	return jsonResponse(
		{
			success: false,
			message,
		},
		404,
	);
}

// ============================================
// HELPER - INTERNAL ERROR
// ============================================

function internalError(message = 'Internal server error'): Response {
	return jsonResponse(
		{
			success: false,
			message,
		},
		500,
	);
}

// ============================================
// HELPER - JSON BODY
// ============================================

async function parseJsonBody<T>(request: Request): Promise<
	| {
			success: true;
			data: T;
	  }
	| {
			success: false;
			response: Response;
	  }
> {
	try {
		const data = (await request.json()) as T;

		return {
			success: true,
			data,
		};
	} catch {
		return {
			success: false,
			response: validationError('Request body must contain valid JSON'),
		};
	}
}

// ============================================
// VALIDATION HELPERS
// ============================================

function isValidUrl(value: string): boolean {
	try {
		const url = new URL(value);

		return url.protocol === 'http:' || url.protocol === 'https:';
	} catch {
		return false;
	}
}

function isValidPositiveInteger(value: unknown): boolean {
	return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isValidNonEmptyString(value: unknown): boolean {
	return typeof value === 'string' && value.trim().length > 0;
}

function isValidSlaTarget(value: unknown): boolean {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
}

function isValidResponseTimeLimit(value: unknown): boolean {
	return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isValidEvaluationPeriod(value: unknown): boolean {
	return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isValidEnabled(value: unknown): boolean {
	return value === 0 || value === 1;
}

function isValidIncidentStatus(value: string): value is IncidentStatus {
	return value === 'open' || value === 'investigating' || value === 'resolved';
}

function isValidNotificationStatus(value: string): value is NotificationStatus {
	return value === 'pending' || value === 'sent' || value === 'failed';
}

// ============================================
// DATE HELPERS
// ============================================

function formatSqliteDate(date: Date): string {
	return date.toISOString().slice(0, 19).replace('T', ' ');
}

function getPeriodStart(days: number): string {
	const date = new Date();

	date.setTime(date.getTime() - days * 24 * 60 * 60 * 1000);

	return formatSqliteDate(date);
}

function getPeriodEnd(): string {
	return formatSqliteDate(new Date());
}

// ============================================
// PASSWORD HASHING
// ============================================

async function hashPassword(password: string): Promise<string> {
	const encoder = new TextEncoder();

	const data = encoder.encode(password);

	const hash = await crypto.subtle.digest('SHA-256', data);

	return Array.from(new Uint8Array(hash))
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
}

async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
	const hashedPassword = await hashPassword(password);

	return hashedPassword === passwordHash;
}

// ============================================
// TOKEN HELPERS
// ============================================

function generateToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));

	return Array.from(bytes)
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
}

async function hashToken(token: string): Promise<string> {
	const encoder = new TextEncoder();

	const data = encoder.encode(token);

	const hash = await crypto.subtle.digest('SHA-256', data);

	return Array.from(new Uint8Array(hash))
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
}

// ============================================
// AUTHENTICATION
// ============================================

async function authenticateRequest(
	request: Request,
	env: Env,
): Promise<
	| {
			authenticated: true;
			admin: AuthenticatedAdmin;
	  }
	| {
			authenticated: false;
			admin?: undefined;
			message: string;
	  }
> {
	const authorization = request.headers.get('Authorization');

	if (!authorization) {
		return {
			authenticated: false,
			message: 'Authorization header is required',
		};
	}

	if (!authorization.startsWith('Bearer ')) {
		return {
			authenticated: false,
			message: 'Authorization header must use Bearer token',
		};
	}

	const token = authorization.substring(7).trim();

	if (!token) {
		return {
			authenticated: false,
			message: 'Authentication token is required',
		};
	}

	try {
		const tokenHash = await hashToken(token);

		const session = await env.sla_monitoring_db
			.prepare(
				`
                    SELECT
                        sessions.id,
                        sessions.admin_id,
                        sessions.expires_at,
                        admins.email,
                        admins.role,
                        admins.enabled
                    FROM sessions
                    INNER JOIN admins
                        ON admins.id = sessions.admin_id
                    WHERE sessions.token_hash = ?
                    LIMIT 1
                    `,
			)
			.bind(tokenHash)
			.first<{
				id: number;
				admin_id: number;
				expires_at: string;
				email: string;
				role: string;
				enabled: number;
			}>();

		if (!session) {
			return {
				authenticated: false,
				message: 'Invalid authentication token',
			};
		}

		const expiresAt = new Date(session.expires_at.replace(' ', 'T') + 'Z');

		if (Number.isNaN(expiresAt.getTime())) {
			return {
				authenticated: false,
				message: 'Invalid session expiration',
			};
		}

		if (expiresAt.getTime() <= Date.now()) {
			await env.sla_monitoring_db
				.prepare(
					`
                    DELETE FROM sessions
                    WHERE id = ?
                    `,
				)
				.bind(session.id)
				.run();

			return {
				authenticated: false,
				message: 'Session has expired',
			};
		}

		if (session.enabled !== 1) {
			return {
				authenticated: false,
				message: 'Admin account is disabled',
			};
		}

		return {
			authenticated: true,
			admin: {
				id: session.admin_id,
				email: session.email,
				role: session.role,
			},
		};
	} catch (error) {
		console.error('Authentication error:', error);

		return {
			authenticated: false,
			message: 'Authentication failed',
		};
	}
}

// ============================================
// ADMIN AUTHORIZATION
// ============================================

async function requireAdmin(
	request: Request,
	env: Env,
): Promise<
	| {
			authorized: true;
			admin: AuthenticatedAdmin;
	  }
	| {
			authorized: false;
			response: Response;
	  }
> {
	const auth = await authenticateRequest(request, env);

	if (!auth.authenticated || !auth.admin) {
		return {
			authorized: false,
			response: jsonResponse(
				{
					success: false,
					message: auth.message ?? 'Unauthorized',
				},
				401,
			),
		};
	}

	if (auth.admin.role !== 'admin') {
		return {
			authorized: false,
			response: jsonResponse(
				{
					success: false,
					message: 'Admin access required',
				},
				403,
			),
		};
	}

	return {
		authorized: true,
		admin: auth.admin,
	};
}

// ============================================
// SERVICE CHECK
// ============================================

async function checkService(env: Env, serviceId: number) {
	const service = await env.sla_monitoring_db
		.prepare(
			`
                SELECT
                    id,
                    name,
                    url,
                    status
                FROM services
                WHERE id = ?
                  AND enabled = 1
                LIMIT 1
                `,
		)
		.bind(serviceId)
		.first<{
			id: number;
			name: string;
			url: string;
			status: ServiceStatus;
		}>();

	if (!service) {
		throw new Error('Service not found or disabled');
	}

	const slaRule = await env.sla_monitoring_db
		.prepare(
			`
                SELECT
                    response_time_limit_ms
                FROM sla_rules
                WHERE service_id = ?
                LIMIT 1
                `,
		)
		.bind(serviceId)
		.first<{
			response_time_limit_ms: number;
		}>();

	const responseTimeLimit = slaRule?.response_time_limit_ms ?? DEFAULT_RESPONSE_TIME_LIMIT_MS;

	let status: CheckStatus = 'failure';

	let responseTimeMs: number | null = null;

	let statusCode: number | null = null;

	let errorMessage: string | null = null;

	const controller = new AbortController();

	const timeout = setTimeout(() => controller.abort(), SERVICE_CHECK_TIMEOUT_MS);

	const startTime = Date.now();

	try {
		const response = await fetch(service.url, {
			method: 'GET',
			headers: {
				'User-Agent': 'SLA-Monitoring-Worker/1.0',
			},
			signal: controller.signal,
		});

		responseTimeMs = Date.now() - startTime;

		statusCode = response.status;

		if (response.ok) {
			status = 'success';
		} else {
			status = 'failure';

			errorMessage = `HTTP status ${response.status}`;
		}
	} catch (error) {
		responseTimeMs = Date.now() - startTime;

		if (error instanceof Error && error.name === 'AbortError') {
			status = 'timeout';

			errorMessage = 'Request timed out';
		} else {
			status = 'failure';

			errorMessage = error instanceof Error ? error.message : 'Unknown request error';
		}
	} finally {
		clearTimeout(timeout);
	}

	let newServiceStatus: ServiceStatus;

	if (status === 'failure' || status === 'timeout') {
		newServiceStatus = 'down';
	} else if (responseTimeMs !== null && responseTimeMs > responseTimeLimit) {
		newServiceStatus = 'degraded';
	} else {
		newServiceStatus = 'up';
	}

	const checkedAt = formatSqliteDate(new Date());

	// Insert SLA check
	await env.sla_monitoring_db
		.prepare(
			`
            INSERT INTO sla_checks (
                service_id,
                status,
                response_time_ms,
                status_code,
                error_message,
                checked_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
            `,
		)
		.bind(serviceId, status, responseTimeMs, statusCode, errorMessage, checkedAt)
		.run();

	const previousStatus = service.status;

	// Update service status
	await env.sla_monitoring_db
		.prepare(
			`
            UPDATE services
            SET
                status = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            `,
		)
		.bind(newServiceStatus, serviceId)
		.run();

	// ========================================
	// CREATE INCIDENT
	// ========================================

	if (newServiceStatus === 'down' && previousStatus !== 'down') {
		const existingIncident = await env.sla_monitoring_db
			.prepare(
				`
                    SELECT id
                    FROM incidents
                    WHERE service_id = ?
                      AND status != 'resolved'
                    LIMIT 1
                    `,
			)
			.bind(serviceId)
			.first<{
				id: number;
			}>();

		if (!existingIncident) {
			const incidentTitle = `${service.name} is down`;

			const incident = await env.sla_monitoring_db
				.prepare(
					`
                        INSERT INTO incidents (
                            service_id,
                            title,
                            description,
                            status,
                            started_at
                        )
                        VALUES (?, ?, ?, 'open', ?)
                        RETURNING id
                        `,
				)
				.bind(serviceId, incidentTitle, errorMessage, checkedAt)
				.first<{
					id: number;
				}>();

			if (incident) {
				await env.sla_monitoring_db
					.prepare(
						`
                        INSERT INTO notifications (
                            service_id,
                            incident_id,
                            type,
                            status,
                            message
                        )
                        VALUES (
                            ?,
                            ?,
                            'dashboard',
                            'pending',
                            ?
                        )
                        `,
					)
					.bind(serviceId, incident.id, incidentTitle)
					.run();
			}
		}
	}

	// ========================================
	// RESOLVE INCIDENT
	// ========================================

	if (newServiceStatus === 'up' && previousStatus === 'down') {
		const activeIncident = await env.sla_monitoring_db
			.prepare(
				`
                    SELECT
                        id
                    FROM incidents
                    WHERE service_id = ?
                      AND status != 'resolved'
                    ORDER BY started_at DESC
                    LIMIT 1
                    `,
			)
			.bind(serviceId)
			.first<{
				id: number;
			}>();

		if (activeIncident) {
			await env.sla_monitoring_db
				.prepare(
					`
                    UPDATE incidents
                    SET
                        status = 'resolved',
                        resolved_at = ?
                    WHERE id = ?
                    `,
				)
				.bind(checkedAt, activeIncident.id)
				.run();

			await env.sla_monitoring_db
				.prepare(
					`
                    INSERT INTO notifications (
                        service_id,
                        incident_id,
                        type,
                        status,
                        message
                    )
                    VALUES (
                        ?,
                        ?,
                        'dashboard',
                        'pending',
                        ?
                    )
                    `,
				)
				.bind(serviceId, activeIncident.id, `${service.name} has recovered`)
				.run();
		}
	}

	return {
		service_id: serviceId,
		service_name: service.name,
		previous_status: previousStatus,
		status: newServiceStatus,
		check_status: status,
		response_time_ms: responseTimeMs,
		status_code: statusCode,
		error_message: errorMessage,
	};
}

// ============================================
// WORKER
// ============================================

export default {
	// ========================================
	// HTTP REQUEST HANDLER
	// ========================================

	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		const method = request.method;

		// ====================================
		// CORS PREFLIGHT
		// ====================================

		if (method === 'OPTIONS') {
			return new Response(null, {
				status: 204,
				headers: {
					'Access-Control-Allow-Origin': 'http://localhost:3000',

					'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',

					'Access-Control-Allow-Headers': 'Content-Type, Authorization',

					'Access-Control-Max-Age': '86400',
				},
			});
		}
		// ====================================
		// HEALTH
		// ====================================

		if (url.pathname === '/health' && method === 'GET') {
			return jsonResponse({
				success: true,
				message: 'SLA Monitoring Worker is running',
				timestamp: new Date().toISOString(),
			});
		}

		// ====================================
		// DB TEST
		// ====================================

		if (url.pathname === '/db-test' && method === 'GET') {
			try {
				const result = await env.sla_monitoring_db
					.prepare(
						`
                            SELECT
                                1 AS connected
                            `,
					)
					.first();

				return jsonResponse({
					success: true,
					data: result,
				});
			} catch (error) {
				console.error('DB test error:', error);

				return internalError('Database connection failed');
			}
		}

		// ====================================
		// AUTH SETUP
		// DEVELOPMENT ONLY
		// ====================================

		if (url.pathname === '/api/auth/setup' && method === 'POST') {
			try {
				const count = await env.sla_monitoring_db
					.prepare(
						`
                            SELECT COUNT(*) AS count
                            FROM admins
                            `,
					)
					.first<{
						count: number;
					}>();

				if (count && count.count > 0) {
					return jsonResponse(
						{
							success: false,
							message: 'Admin setup is already completed',
						},
						403,
					);
				}

				const parsed = await parseJsonBody<{
					email?: unknown;
					password?: unknown;
				}>(request);

				if (!parsed.success) {
					return parsed.response;
				}

				const { email, password } = parsed.data;

				if (!isValidNonEmptyString(email)) {
					return validationError('Email is required');
				}

				if (!isValidNonEmptyString(password)) {
					return validationError('Password is required');
				}

				if ((password as string).length < 8) {
					return validationError('Password must be at least 8 characters');
				}

				const normalizedEmail = (email as string).trim().toLowerCase();

				const passwordHash = await hashPassword(password as string);

				const result = await env.sla_monitoring_db
					.prepare(
						`
                            INSERT INTO admins (
                                email,
                                password_hash,
                                role,
                                enabled
                            )
                            VALUES (?, ?, 'admin', 1)
                            RETURNING
                                id,
                                email,
                                role,
                                enabled,
                                created_at
                            `,
					)
					.bind(normalizedEmail, passwordHash)
					.first();

				return jsonResponse(
					{
						success: true,
						message: 'Admin created successfully',
						data: result,
					},
					201,
				);
			} catch (error) {
				console.error('Auth setup error:', error);

				return internalError('Failed to create admin');
			}
		}

		// ====================================
		// LOGIN
		// ====================================

		if (url.pathname === '/api/auth/login' && method === 'POST') {
			try {
				const parsed = await parseJsonBody<{
					email?: unknown;
					password?: unknown;
				}>(request);

				if (!parsed.success) {
					return parsed.response;
				}

				const { email, password } = parsed.data;

				if (!isValidNonEmptyString(email)) {
					return validationError('Email is required');
				}

				if (!isValidNonEmptyString(password)) {
					return validationError('Password is required');
				}

				const normalizedEmail = (email as string).trim().toLowerCase();

				const admin = await env.sla_monitoring_db
					.prepare(
						`
                            SELECT
                                id,
                                email,
                                password_hash,
                                role,
                                enabled
                            FROM admins
                            WHERE email = ?
                            LIMIT 1
                            `,
					)
					.bind(normalizedEmail)
					.first<{
						id: number;
						email: string;
						password_hash: string;
						role: AdminRole;
						enabled: number;
					}>();

				if (!admin) {
					return jsonResponse(
						{
							success: false,
							message: 'Invalid email or password',
						},
						401,
					);
				}

				const passwordValid = await verifyPassword(password as string, admin.password_hash);

				if (!passwordValid) {
					return jsonResponse(
						{
							success: false,
							message: 'Invalid email or password',
						},
						401,
					);
				}

				if (admin.enabled !== 1) {
					return jsonResponse(
						{
							success: false,
							message: 'Admin account is disabled',
						},
						403,
					);
				}

				const token = generateToken();

				const tokenHash = await hashToken(token);

				const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);

				const expiresAtSql = formatSqliteDate(expiresAt);

				await env.sla_monitoring_db
					.prepare(
						`
                        INSERT INTO sessions (
                            admin_id,
                            token_hash,
                            expires_at
                        )
                        VALUES (?, ?, ?)
                        `,
					)
					.bind(admin.id, tokenHash, expiresAtSql)
					.run();

				return jsonResponse({
					success: true,
					message: 'Login successful',
					data: {
						token,
						expires_at: expiresAt.toISOString(),
						admin: {
							id: admin.id,
							email: admin.email,
							role: admin.role,
						},
					},
				});
			} catch (error) {
				console.error('Login error:', error);

				return internalError('Login failed');
			}
		}

		// ====================================
		// LOGOUT
		// ====================================

		if (url.pathname === '/api/auth/logout' && method === 'POST') {
			try {
				const authorization = request.headers.get('Authorization');

				if (!authorization || !authorization.startsWith('Bearer ')) {
					return jsonResponse(
						{
							success: false,
							message: 'Authorization header is required',
						},
						401,
					);
				}

				const token = authorization.substring(7).trim();

				if (!token) {
					return jsonResponse(
						{
							success: false,
							message: 'Authentication token is required',
						},
						401,
					);
				}

				const tokenHash = await hashToken(token);

				const result = await env.sla_monitoring_db
					.prepare(
						`
                            DELETE FROM sessions
                            WHERE token_hash = ?
                            `,
					)
					.bind(tokenHash)
					.run();

				if (result.meta.changes === 0) {
					return jsonResponse(
						{
							success: false,
							message: 'Session not found or already logged out',
						},
						401,
					);
				}

				return jsonResponse({
					success: true,
					message: 'Logout successful',
				});
			} catch (error) {
				console.error('Logout error:', error);

				return internalError('Logout failed');
			}
		}

		// ====================================
		// AUTH ME
		// ====================================

		if (url.pathname === '/api/auth/me' && method === 'GET') {
			const auth = await authenticateRequest(request, env);

			if (!auth.authenticated) {
				return jsonResponse(
					{
						success: false,
						message: auth.message,
					},
					401,
				);
			}

			return jsonResponse({
				success: true,
				data: {
					admin: auth.admin,
				},
			});
		}

		// ====================================
		// GET SERVICES
		// ====================================

		if (url.pathname === '/api/services' && method === 'GET') {
			try {
				const services = await env.sla_monitoring_db
					.prepare(
						`
                            SELECT
                                id,
                                name,
                                url,
                                description,
                                status,
                                enabled,
                                created_at,
                                updated_at
                            FROM services
                            ORDER BY id DESC
                            `,
					)
					.all<Service>();

				return jsonResponse({
					success: true,
					data: services.results,
				});
			} catch (error) {
				console.error('Get services error:', error);

				return internalError('Failed to fetch services');
			}
		}

		// ====================================
		// CREATE SERVICE
		// ====================================

		if (url.pathname === '/api/services' && method === 'POST') {
			const auth = await requireAdmin(request, env);

			if (!auth.authorized) {
				return auth.response;
			}

			try {
				const parsed = await parseJsonBody<{
					name?: unknown;
					url?: unknown;
					description?: unknown;
					enabled?: unknown;
				}>(request);

				if (!parsed.success) {
					return parsed.response;
				}

				const { name, url: serviceUrl, description, enabled } = parsed.data;

				if (!isValidNonEmptyString(name)) {
					return validationError('Service name is required');
				}

				if (!isValidNonEmptyString(serviceUrl)) {
					return validationError('Service URL is required');
				}

				if (!isValidUrl(serviceUrl as string)) {
					return validationError('Service URL must be a valid HTTP or HTTPS URL');
				}

				if (enabled !== undefined && !isValidEnabled(enabled)) {
					return validationError('Enabled must be either 0 or 1');
				}

				if (description !== undefined && description !== null && typeof description !== 'string') {
					return validationError('Description must be a string');
				}

				const service = await env.sla_monitoring_db
					.prepare(
						`
                            INSERT INTO services (
                                name,
                                url,
                                description,
                                enabled
                            )
                            VALUES (?, ?, ?, ?)
                            RETURNING
                                id,
                                name,
                                url,
                                description,
                                status,
                                enabled,
                                created_at,
                                updated_at
                            `,
					)
					.bind(
						(name as string).trim(),
						(serviceUrl as string).trim(),
						description === undefined || description === null ? null : (description as string).trim(),
						enabled === undefined ? 1 : enabled,
					)
					.first();

				return jsonResponse(
					{
						success: true,
						message: 'Service created successfully',
						data: service,
					},
					201,
				);
			} catch (error) {
				console.error('Create service error:', error);

				return internalError('Failed to create service');
			}
		}

		// ====================================
		// SINGLE SERVICE
		// ====================================

		const serviceMatch = url.pathname.match(/^\/api\/services\/(\d+)$/);

		if (serviceMatch && method === 'GET') {
			try {
				const serviceId = Number(serviceMatch[1]);

				if (!Number.isInteger(serviceId) || serviceId <= 0) {
					return validationError('Invalid service ID');
				}

				const service = await env.sla_monitoring_db
					.prepare(
						`
                            SELECT
                                id,
                                name,
                                url,
                                description,
                                status,
                                enabled,
                                created_at,
                                updated_at
                            FROM services
                            WHERE id = ?
                            LIMIT 1
                            `,
					)
					.bind(serviceId)
					.first<Service>();

				if (!service) {
					return notFoundError('Service not found');
				}

				return jsonResponse({
					success: true,
					data: service,
				});
			} catch (error) {
				console.error('Get service error:', error);

				return internalError('Failed to fetch service');
			}
		}

		// ====================================
		// UPDATE SERVICE
		// ====================================

		if (serviceMatch && method === 'PUT') {
			const auth = await requireAdmin(request, env);

			if (!auth.authorized) {
				return auth.response;
			}

			try {
				const serviceId = Number(serviceMatch[1]);

				if (!Number.isInteger(serviceId) || serviceId <= 0) {
					return validationError('Invalid service ID');
				}

				const existingService = await env.sla_monitoring_db
					.prepare(
						`
                            SELECT
                                id,
                                name,
                                url,
                                description,
                                enabled
                            FROM services
                            WHERE id = ?
                            LIMIT 1
                            `,
					)
					.bind(serviceId)
					.first<{
						id: number;
						name: string;
						url: string;
						description: string | null;
						enabled: number;
					}>();

				if (!existingService) {
					return notFoundError('Service not found');
				}

				const parsed = await parseJsonBody<{
					name?: unknown;
					url?: unknown;
					description?: unknown;
					enabled?: unknown;
				}>(request);

				if (!parsed.success) {
					return parsed.response;
				}

				const body = parsed.data;

				const name = body.name !== undefined ? body.name : existingService.name;

				const serviceUrl = body.url !== undefined ? body.url : existingService.url;

				const description = body.description !== undefined ? body.description : existingService.description;

				const enabled = body.enabled !== undefined ? body.enabled : existingService.enabled;

				if (!isValidNonEmptyString(name)) {
					return validationError('Service name is required');
				}

				if (!isValidNonEmptyString(serviceUrl)) {
					return validationError('Service URL is required');
				}

				if (!isValidUrl(serviceUrl as string)) {
					return validationError('Service URL must be a valid HTTP or HTTPS URL');
				}

				if (!isValidEnabled(enabled)) {
					return validationError('Enabled must be either 0 or 1');
				}

				if (description !== null && description !== undefined && typeof description !== 'string') {
					return validationError('Description must be a string');
				}

				await env.sla_monitoring_db
					.prepare(
						`
                        UPDATE services
                        SET
                            name = ?,
                            url = ?,
                            description = ?,
                            enabled = ?,
                            updated_at =
                                CURRENT_TIMESTAMP
                        WHERE id = ?
                        `,
					)
					.bind(
						(name as string).trim(),
						(serviceUrl as string).trim(),
						description === null || description === undefined ? null : (description as string).trim(),
						enabled,
						serviceId,
					)
					.run();

				const updatedService = await env.sla_monitoring_db
					.prepare(
						`
                            SELECT
                                id,
                                name,
                                url,
                                description,
                                status,
                                enabled,
                                created_at,
                                updated_at
                            FROM services
                            WHERE id = ?
                            LIMIT 1
                            `,
					)
					.bind(serviceId)
					.first<Service>();

				return jsonResponse({
					success: true,
					message: 'Service updated successfully',
					data: updatedService,
				});
			} catch (error) {
				console.error('Update service error:', error);

				return internalError('Failed to update service');
			}
		}

		// ====================================
		// DELETE SERVICE
		// ====================================

		if (serviceMatch && method === 'DELETE') {
			const auth = await requireAdmin(request, env);

			if (!auth.authorized) {
				return auth.response;
			}

			try {
				const serviceId = Number(serviceMatch[1]);

				if (!Number.isInteger(serviceId) || serviceId <= 0) {
					return validationError('Invalid service ID');
				}

				const existingService = await env.sla_monitoring_db
					.prepare(
						`
                            SELECT id
                            FROM services
                            WHERE id = ?
                            LIMIT 1
                            `,
					)
					.bind(serviceId)
					.first<{
						id: number;
					}>();

				if (!existingService) {
					return notFoundError('Service not found');
				}

				await env.sla_monitoring_db
					.prepare(
						`
                        DELETE FROM services
                        WHERE id = ?
                        `,
					)
					.bind(serviceId)
					.run();

				return jsonResponse({
					success: true,
					message: 'Service deleted successfully',
				});
			} catch (error) {
				console.error('Delete service error:', error);

				return internalError('Failed to delete service');
			}
		}

		// ====================================
		// MANUAL SERVICE CHECK
		// ====================================

		const checkMatch = url.pathname.match(/^\/api\/services\/(\d+)\/check$/);

		if (checkMatch && method === 'POST') {
			const auth = await requireAdmin(request, env);

			if (!auth.authorized) {
				return auth.response;
			}

			try {
				const serviceId = Number(checkMatch[1]);

				if (!Number.isInteger(serviceId) || serviceId <= 0) {
					return validationError('Invalid service ID');
				}

				const service = await env.sla_monitoring_db
					.prepare(
						`
                            SELECT id
                            FROM services
                            WHERE id = ?
                            LIMIT 1
                            `,
					)
					.bind(serviceId)
					.first<{
						id: number;
					}>();

				if (!service) {
					return notFoundError('Service not found');
				}

				const result = await checkService(env, serviceId);

				return jsonResponse({
					success: true,
					message: 'Service check completed',
					data: result,
				});
			} catch (error) {
				console.error('Manual service check error:', error);

				return internalError('Service check failed');
			}
		}

		// ====================================
		// GET SLA RULE
		// ====================================

		const slaRuleMatch = url.pathname.match(/^\/api\/services\/(\d+)\/sla-rule$/);

		if (slaRuleMatch && method === 'GET') {
			try {
				const serviceId = Number(slaRuleMatch[1]);

				if (!Number.isInteger(serviceId) || serviceId <= 0) {
					return validationError('Invalid service ID');
				}

				const service = await env.sla_monitoring_db
					.prepare(
						`
                            SELECT
                                id,
                                name
                            FROM services
                            WHERE id = ?
                            LIMIT 1
                            `,
					)
					.bind(serviceId)
					.first<{
						id: number;
						name: string;
					}>();

				if (!service) {
					return notFoundError('Service not found');
				}

				const rule = await env.sla_monitoring_db
					.prepare(
						`
                            SELECT
                                id,
                                service_id,
                                target_percentage,
                                response_time_limit_ms,
                                evaluation_period_days,
                                created_at,
                                updated_at
                            FROM sla_rules
                            WHERE service_id = ?
                            LIMIT 1
                            `,
					)
					.bind(serviceId)
					.first<SlaRule>();

				if (!rule) {
					return jsonResponse({
						success: true,
						data: {
							service_id: serviceId,
							service_name: service.name,
							target_percentage: DEFAULT_SLA_TARGET,
							response_time_limit_ms: DEFAULT_RESPONSE_TIME_LIMIT_MS,
							evaluation_period_days: DEFAULT_EVALUATION_PERIOD_DAYS,
							is_default: true,
						},
					});
				}

				return jsonResponse({
					success: true,
					data: {
						...rule,
						is_default: false,
					},
				});
			} catch (error) {
				console.error('Get SLA rule error:', error);

				return internalError('Failed to fetch SLA rule');
			}
		}

		// ====================================
		// CREATE SLA RULE
		// ====================================

		if (slaRuleMatch && method === 'POST') {
			const auth = await requireAdmin(request, env);

			if (!auth.authorized) {
				return auth.response;
			}

			try {
				const serviceId = Number(slaRuleMatch[1]);

				if (!Number.isInteger(serviceId) || serviceId <= 0) {
					return validationError('Invalid service ID');
				}

				const service = await env.sla_monitoring_db
					.prepare(
						`
                            SELECT id
                            FROM services
                            WHERE id = ?
                            LIMIT 1
                            `,
					)
					.bind(serviceId)
					.first();

				if (!service) {
					return notFoundError('Service not found');
				}

				const existingRule = await env.sla_monitoring_db
					.prepare(
						`
                            SELECT id
                            FROM sla_rules
                            WHERE service_id = ?
                            LIMIT 1
                            `,
					)
					.bind(serviceId)
					.first<{
						id: number;
					}>();

				if (existingRule) {
					return jsonResponse(
						{
							success: false,
							message: 'SLA rule already exists for this service',
						},
						409,
					);
				}

				const parsed = await parseJsonBody<{
					target_percentage?: unknown;
					response_time_limit_ms?: unknown;
					evaluation_period_days?: unknown;
				}>(request);

				if (!parsed.success) {
					return parsed.response;
				}

				const { target_percentage, response_time_limit_ms, evaluation_period_days } = parsed.data;

				const target = target_percentage ?? DEFAULT_SLA_TARGET;

				const responseLimit = response_time_limit_ms ?? DEFAULT_RESPONSE_TIME_LIMIT_MS;

				const evaluationPeriod = evaluation_period_days ?? DEFAULT_EVALUATION_PERIOD_DAYS;

				if (!isValidSlaTarget(target)) {
					return validationError('Target percentage must be between 0 and 100');
				}

				if (!isValidResponseTimeLimit(responseLimit)) {
					return validationError('Response time limit must be a positive integer');
				}

				if (!isValidEvaluationPeriod(evaluationPeriod)) {
					return validationError('Evaluation period must be a positive integer');
				}

				const rule = await env.sla_monitoring_db
					.prepare(
						`
                            INSERT INTO sla_rules (
                                service_id,
                                target_percentage,
                                response_time_limit_ms,
                                evaluation_period_days
                            )
                            VALUES (?, ?, ?, ?)
                            RETURNING
                                id,
                                service_id,
                                target_percentage,
                                response_time_limit_ms,
                                evaluation_period_days,
                                created_at,
                                updated_at
                            `,
					)
					.bind(serviceId, target, responseLimit, evaluationPeriod)
					.first<SlaRule>();

				return jsonResponse(
					{
						success: true,
						message: 'SLA rule created successfully',
						data: rule,
					},
					201,
				);
			} catch (error) {
				console.error('Create SLA rule error:', error);

				return internalError('Failed to create SLA rule');
			}
		}

		// ====================================
		// UPDATE SLA RULE
		// ====================================

		if (slaRuleMatch && method === 'PUT') {
			const auth = await requireAdmin(request, env);

			if (!auth.authorized) {
				return auth.response;
			}

			try {
				const serviceId = Number(slaRuleMatch[1]);

				if (!Number.isInteger(serviceId) || serviceId <= 0) {
					return validationError('Invalid service ID');
				}

				const service = await env.sla_monitoring_db
					.prepare(
						`
                            SELECT id
                            FROM services
                            WHERE id = ?
                            LIMIT 1
                            `,
					)
					.bind(serviceId)
					.first();

				if (!service) {
					return notFoundError('Service not found');
				}

				const existingRule = await env.sla_monitoring_db
					.prepare(
						`
                            SELECT
                                id,
                                target_percentage,
                                response_time_limit_ms,
                                evaluation_period_days
                            FROM sla_rules
                            WHERE service_id = ?
                            LIMIT 1
                            `,
					)
					.bind(serviceId)
					.first<{
						id: number;
						target_percentage: number;
						response_time_limit_ms: number;
						evaluation_period_days: number;
					}>();

				if (!existingRule) {
					return notFoundError('SLA rule not found');
				}

				const parsed = await parseJsonBody<{
					target_percentage?: unknown;
					response_time_limit_ms?: unknown;
					evaluation_period_days?: unknown;
				}>(request);

				if (!parsed.success) {
					return parsed.response;
				}

				const body = parsed.data;

				const target = body.target_percentage !== undefined ? body.target_percentage : existingRule.target_percentage;

				const responseLimit = body.response_time_limit_ms !== undefined ? body.response_time_limit_ms : existingRule.response_time_limit_ms;

				const evaluationPeriod =
					body.evaluation_period_days !== undefined ? body.evaluation_period_days : existingRule.evaluation_period_days;

				if (!isValidSlaTarget(target)) {
					return validationError('Target percentage must be between 0 and 100');
				}

				if (!isValidResponseTimeLimit(responseLimit)) {
					return validationError('Response time limit must be a positive integer');
				}

				if (!isValidEvaluationPeriod(evaluationPeriod)) {
					return validationError('Evaluation period must be a positive integer');
				}

				await env.sla_monitoring_db
					.prepare(
						`
                        UPDATE sla_rules
                        SET
                            target_percentage = ?,
                            response_time_limit_ms = ?,
                            evaluation_period_days = ?,
                            updated_at =
                                CURRENT_TIMESTAMP
                        WHERE id = ?
                        `,
					)
					.bind(target, responseLimit, evaluationPeriod, existingRule.id)
					.run();

				const updatedRule = await env.sla_monitoring_db
					.prepare(
						`
                            SELECT
                                id,
                                service_id,
                                target_percentage,
                                response_time_limit_ms,
                                evaluation_period_days,
                                created_at,
                                updated_at
                            FROM sla_rules
                            WHERE id = ?
                            LIMIT 1
                            `,
					)
					.bind(existingRule.id)
					.first<SlaRule>();

				return jsonResponse({
					success: true,
					message: 'SLA rule updated successfully',
					data: updatedRule,
				});
			} catch (error) {
				console.error('Update SLA rule error:', error);

				return internalError('Failed to update SLA rule');
			}
		}

		// ====================================
		// SERVICE SLA SUMMARY
		// ====================================

		const slaMatch = url.pathname.match(/^\/api\/services\/(\d+)\/sla$/);

		if (slaMatch && method === 'GET') {
			try {
				const serviceId = Number(slaMatch[1]);

				if (!Number.isInteger(serviceId) || serviceId <= 0) {
					return validationError('Invalid service ID');
				}

				const service = await env.sla_monitoring_db
					.prepare(
						`
                            SELECT
                                id,
                                name
                            FROM services
                            WHERE id = ?
                            LIMIT 1
                            `,
					)
					.bind(serviceId)
					.first<{
						id: number;
						name: string;
					}>();

				if (!service) {
					return notFoundError('Service not found');
				}

				const rule = await env.sla_monitoring_db
					.prepare(
						`
                            SELECT
                                target_percentage,
                                response_time_limit_ms,
                                evaluation_period_days
                            FROM sla_rules
                            WHERE service_id = ?
                            LIMIT 1
                            `,
					)
					.bind(serviceId)
					.first<{
						target_percentage: number;
						response_time_limit_ms: number;
						evaluation_period_days: number;
					}>();

				const target = rule?.target_percentage ?? DEFAULT_SLA_TARGET;

				const responseTimeLimit = rule?.response_time_limit_ms ?? DEFAULT_RESPONSE_TIME_LIMIT_MS;

				const evaluationPeriod = rule?.evaluation_period_days ?? DEFAULT_EVALUATION_PERIOD_DAYS;

				const periodStart = getPeriodStart(evaluationPeriod);

				const periodEnd = getPeriodEnd();

				// ==================================
				// CHECKS
				// ==================================

				const checks = await env.sla_monitoring_db
					.prepare(
						`
                            SELECT
                                id,
                                status,
                                response_time_ms,
                                checked_at
                            FROM sla_checks
                            WHERE service_id = ?
                              AND checked_at >= ?
                              AND checked_at <= ?
                            ORDER BY checked_at ASC
                            `,
					)
					.bind(serviceId, periodStart, periodEnd)
					.all<{
						id: number;
						status: CheckStatus;
						response_time_ms: number | null;
						checked_at: string;
					}>();

				// ==================================
				// INCIDENTS
				// ==================================

				const incidents = await env.sla_monitoring_db
					.prepare(
						`
                            SELECT
                                id,
                                title,
                                description,
                                status,
                                started_at,
                                resolved_at
                            FROM incidents
                            WHERE service_id = ?
                              AND started_at <= ?
                              AND (
                                  resolved_at IS NULL
                                  OR resolved_at >= ?
                              )
                            ORDER BY started_at DESC
                            `,
					)
					.bind(serviceId, periodEnd, periodStart)
					.all<{
						id: number;
						title: string;
						description: string | null;
						status: IncidentStatus;
						started_at: string;
						resolved_at: string | null;
					}>();

				const totalMonitoringMinutes = evaluationPeriod * 24 * 60;

				let downtimeMinutes = 0;

				for (const incident of incidents.results) {
					const incidentStart = new Date(incident.started_at.replace(' ', 'T') + 'Z');

					const incidentEnd = incident.resolved_at ? new Date(incident.resolved_at.replace(' ', 'T') + 'Z') : new Date();

					const periodStartDate = new Date(periodStart.replace(' ', 'T') + 'Z');

					const periodEndDate = new Date(periodEnd.replace(' ', 'T') + 'Z');

					const clippedStart = Math.max(incidentStart.getTime(), periodStartDate.getTime());

					const clippedEnd = Math.min(incidentEnd.getTime(), periodEndDate.getTime());

					if (clippedEnd > clippedStart) {
						downtimeMinutes += (clippedEnd - clippedStart) / (1000 * 60);
					}
				}

				downtimeMinutes = Math.min(downtimeMinutes, totalMonitoringMinutes);

				const uptimeMinutes = Math.max(totalMonitoringMinutes - downtimeMinutes, 0);

				const uptimePercentage = totalMonitoringMinutes > 0 ? (uptimeMinutes / totalMonitoringMinutes) * 100 : 100;

				const successfulChecks = checks.results.filter((check) => check.status === 'success').length;

				const failedChecks = checks.results.filter((check) => check.status === 'failure' || check.status === 'timeout').length;

				const responseTimes = checks.results.map((check) => check.response_time_ms).filter((value): value is number => value !== null);

				const averageResponseTime =
					responseTimes.length > 0 ? responseTimes.reduce((total, value) => total + value, 0) / responseTimes.length : 0;

				return jsonResponse({
					success: true,
					data: {
						service_id: serviceId,

						service_name: service.name,

						evaluation_period_days: evaluationPeriod,

						period_start: periodStart,

						period_end: periodEnd,

						total_monitoring_minutes: Math.round(totalMonitoringMinutes),

						uptime_minutes: Math.round(uptimeMinutes),

						downtime_minutes: Math.round(downtimeMinutes),

						uptime_percentage: Number(uptimePercentage.toFixed(4)),

						sla_target_percentage: target,

						sla_met: uptimePercentage >= target,

						total_checks: checks.results.length,

						successful_checks: successfulChecks,

						failed_checks: failedChecks,

						average_response_time_ms: Math.round(averageResponseTime),

						response_time_limit_ms: responseTimeLimit,

						incidents: incidents.results,
					},
				});
			} catch (error) {
				console.error('SLA summary error:', error);

				return internalError('Failed to calculate SLA summary');
			}
		}

		// ====================================
		// GET INCIDENTS
		// ====================================

		if (url.pathname === '/api/incidents' && method === 'GET') {
			try {
				const status = url.searchParams.get('status');

				const serviceIdParam = url.searchParams.get('service_id');

				if (status && !isValidIncidentStatus(status)) {
					return validationError('Invalid incident status');
				}

				let serviceId: number | undefined;

				if (serviceIdParam) {
					serviceId = Number(serviceIdParam);

					if (!Number.isInteger(serviceId) || serviceId <= 0) {
						return validationError('Invalid service ID');
					}
				}

				let query = `
                    SELECT
                        incidents.id,
                        incidents.service_id,
                        services.name AS service_name,
                        incidents.title,
                        incidents.description,
                        incidents.status,
                        incidents.started_at,
                        incidents.resolved_at,
                        incidents.created_at
                    FROM incidents
                    INNER JOIN services
                        ON services.id =
                            incidents.service_id
                    WHERE 1 = 1
                `;

				const params: (string | number)[] = [];

				if (status) {
					query += ` AND incidents.status = ?`;

					params.push(status);
				}

				if (serviceId !== undefined) {
					query += ` AND incidents.service_id = ?`;

					params.push(serviceId);
				}

				query += `
                    ORDER BY incidents.started_at DESC
                `;

				const incidents = await env.sla_monitoring_db
					.prepare(query)
					.bind(...params)
					.all();

				return jsonResponse({
					success: true,
					data: incidents.results,
				});
			} catch (error) {
				console.error('Get incidents error:', error);

				return internalError('Failed to fetch incidents');
			}
		}

		// ====================================
		// SINGLE INCIDENT
		// ====================================

		const incidentMatch = url.pathname.match(/^\/api\/incidents\/(\d+)$/);

		if (incidentMatch && method === 'GET') {
			try {
				const incidentId = Number(incidentMatch[1]);

				if (!Number.isInteger(incidentId) || incidentId <= 0) {
					return validationError('Invalid incident ID');
				}

				const incident = await env.sla_monitoring_db
					.prepare(
						`
                            SELECT
                                incidents.id,
                                incidents.service_id,
                                services.name AS service_name,
                                incidents.title,
                                incidents.description,
                                incidents.status,
                                incidents.started_at,
                                incidents.resolved_at,
                                incidents.created_at
                            FROM incidents
                            INNER JOIN services
                                ON services.id =
                                    incidents.service_id
                            WHERE incidents.id = ?
                            LIMIT 1
                            `,
					)
					.bind(incidentId)
					.first();

				if (!incident) {
					return notFoundError('Incident not found');
				}

				return jsonResponse({
					success: true,
					data: incident,
				});
			} catch (error) {
				console.error('Get incident error:', error);

				return internalError('Failed to fetch incident');
			}
		}

		// ====================================
		// GET NOTIFICATIONS
		// ====================================

		if (url.pathname === '/api/notifications' && method === 'GET') {
			try {
				const status = url.searchParams.get('status');

				const serviceIdParam = url.searchParams.get('service_id');

				if (status && !isValidNotificationStatus(status)) {
					return validationError('Invalid notification status');
				}

				let serviceId: number | undefined;

				if (serviceIdParam) {
					serviceId = Number(serviceIdParam);

					if (!Number.isInteger(serviceId) || serviceId <= 0) {
						return validationError('Invalid service ID');
					}
				}

				let query = `
                    SELECT
                        notifications.id,
                        notifications.service_id,
                        services.name AS service_name,
                        notifications.incident_id,
                        notifications.type,
                        notifications.status,
                        notifications.message,
                        notifications.created_at,
                        notifications.sent_at
                    FROM notifications
                    LEFT JOIN services
                        ON services.id =
                            notifications.service_id
                    WHERE 1 = 1
                `;

				const params: (string | number)[] = [];

				if (status) {
					query += ` AND notifications.status = ?`;

					params.push(status);
				}

				if (serviceId !== undefined) {
					query += ` AND notifications.service_id = ?`;

					params.push(serviceId);
				}

				query += `
                    ORDER BY notifications.created_at DESC
                `;

				const notifications = await env.sla_monitoring_db
					.prepare(query)
					.bind(...params)
					.all();

				return jsonResponse({
					success: true,
					data: notifications.results,
				});
			} catch (error) {
				console.error('Get notifications error:', error);

				return internalError('Failed to fetch notifications');
			}
		}

		// ====================================
		// SINGLE NOTIFICATION
		// ====================================

		const notificationMatch = url.pathname.match(/^\/api\/notifications\/(\d+)$/);

		if (notificationMatch && method === 'GET') {
			try {
				const notificationId = Number(notificationMatch[1]);

				if (!Number.isInteger(notificationId) || notificationId <= 0) {
					return validationError('Invalid notification ID');
				}

				const notification = await env.sla_monitoring_db
					.prepare(
						`
                            SELECT
                                notifications.id,
                                notifications.service_id,
                                services.name AS service_name,
                                notifications.incident_id,
                                notifications.type,
                                notifications.status,
                                notifications.message,
                                notifications.created_at,
                                notifications.sent_at
                            FROM notifications
                            LEFT JOIN services
                                ON services.id =
                                    notifications.service_id
                            WHERE notifications.id = ?
                            LIMIT 1
                            `,
					)
					.bind(notificationId)
					.first();

				if (!notification) {
					return notFoundError('Notification not found');
				}

				return jsonResponse({
					success: true,
					data: notification,
				});
			} catch (error) {
				console.error('Get notification error:', error);

				return internalError('Failed to fetch notification');
			}
		}

		// ====================================
		// UPDATE NOTIFICATION
		// ====================================

		if (notificationMatch && method === 'PUT') {
			const auth = await requireAdmin(request, env);

			if (!auth.authorized) {
				return auth.response;
			}

			try {
				const notificationId = Number(notificationMatch[1]);

				if (!Number.isInteger(notificationId) || notificationId <= 0) {
					return validationError('Invalid notification ID');
				}

				const existing = await env.sla_monitoring_db
					.prepare(
						`
                            SELECT
                                id,
                                status
                            FROM notifications
                            WHERE id = ?
                            LIMIT 1
                            `,
					)
					.bind(notificationId)
					.first<{
						id: number;
						status: NotificationStatus;
					}>();

				if (!existing) {
					return notFoundError('Notification not found');
				}

				const parsed = await parseJsonBody<{
					status?: unknown;
				}>(request);

				if (!parsed.success) {
					return parsed.response;
				}

				const newStatus = parsed.data.status;

				if (typeof newStatus !== 'string') {
					return validationError('Notification status is required');
				}

				if (!isValidNotificationStatus(newStatus)) {
					return validationError('Invalid notification status');
				}

				if (newStatus === 'sent') {
					await env.sla_monitoring_db
						.prepare(
							`
                            UPDATE notifications
                            SET
                                status = 'sent',
                                sent_at =
                                    CURRENT_TIMESTAMP
                            WHERE id = ?
                            `,
						)
						.bind(notificationId)
						.run();
				} else {
					await env.sla_monitoring_db
						.prepare(
							`
                            UPDATE notifications
                            SET
                                status = ?,
                                sent_at = NULL
                            WHERE id = ?
                            `,
						)
						.bind(newStatus, notificationId)
						.run();
				}

				const updated = await env.sla_monitoring_db
					.prepare(
						`
                            SELECT
                                notifications.id,
                                notifications.service_id,
                                services.name AS service_name,
                                notifications.incident_id,
                                notifications.type,
                                notifications.status,
                                notifications.message,
                                notifications.created_at,
                                notifications.sent_at
                            FROM notifications
                            LEFT JOIN services
                                ON services.id =
                                    notifications.service_id
                            WHERE notifications.id = ?
                            LIMIT 1
                            `,
					)
					.bind(notificationId)
					.first();

				return jsonResponse({
					success: true,
					message: 'Notification updated successfully',
					data: updated,
				});
			} catch (error) {
				console.error('Update notification error:', error);

				return internalError('Failed to update notification');
			}
		}

		// ====================================
		// DASHBOARD SUMMARY
		// ====================================

		if (url.pathname === '/api/dashboard/summary' && method === 'GET') {
			try {
				const services = await env.sla_monitoring_db
					.prepare(
						`
                            SELECT
                                COUNT(*) AS total,
                                SUM(
                                    CASE
                                        WHEN status = 'up'
                                        THEN 1
                                        ELSE 0
                                    END
                                ) AS up,
                                SUM(
                                    CASE
                                        WHEN status = 'down'
                                        THEN 1
                                        ELSE 0
                                    END
                                ) AS down,
                                SUM(
                                    CASE
                                        WHEN status = 'degraded'
                                        THEN 1
                                        ELSE 0
                                    END
                                ) AS degraded,
                                SUM(
                                    CASE
                                        WHEN status = 'unknown'
                                        THEN 1
                                        ELSE 0
                                    END
                                ) AS unknown
                            FROM services
                            WHERE enabled = 1
                            `,
					)
					.first<{
						total: number;
						up: number;
						down: number;
						degraded: number;
						unknown: number;
					}>();

				const incidents = await env.sla_monitoring_db
					.prepare(
						`
                            SELECT
                                COUNT(*) AS total,
                                SUM(
                                    CASE
                                        WHEN status != 'resolved'
                                        THEN 1
                                        ELSE 0
                                    END
                                ) AS active,
                                SUM(
                                    CASE
                                        WHEN status = 'resolved'
                                        THEN 1
                                        ELSE 0
                                    END
                                ) AS resolved
                            FROM incidents
                            `,
					)
					.first<{
						total: number;
						active: number;
						resolved: number;
					}>();

				const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

				const last24HoursSql = formatSqliteDate(last24Hours);

				const monitoring = await env.sla_monitoring_db
					.prepare(
						`
                            SELECT
                                COUNT(*) AS total_checks,

                                SUM(
                                    CASE
                                        WHEN status = 'success'
                                        THEN 1
                                        ELSE 0
                                    END
                                ) AS successful_checks,

                                SUM(
                                    CASE
                                        WHEN status IN (
                                            'failure',
                                            'timeout'
                                        )
                                        THEN 1
                                        ELSE 0
                                    END
                                ) AS failed_checks,

                                AVG(
                                    response_time_ms
                                ) AS average_response_time_ms
                            FROM sla_checks
                            WHERE checked_at >= ?
                            `,
					)
					.bind(last24HoursSql)
					.first<{
						total_checks: number;
						successful_checks: number;
						failed_checks: number;
						average_response_time_ms: number | null;
					}>();

				const totalChecks = monitoring?.total_checks ?? 0;

				const successfulChecks = monitoring?.successful_checks ?? 0;

				const uptimePercentage = totalChecks > 0 ? (successfulChecks / totalChecks) * 100 : 100;

				const recentIncidents = await env.sla_monitoring_db
					.prepare(
						`
                            SELECT
                                incidents.id,
                                incidents.service_id,
                                services.name AS service_name,
                                incidents.title,
                                incidents.description,
                                incidents.status,
                                incidents.started_at,
                                incidents.resolved_at
                            FROM incidents
                            INNER JOIN services
                                ON services.id =
                                    incidents.service_id
                            ORDER BY incidents.started_at DESC
                            LIMIT 5
                            `,
					)
					.all();

				const recentChecks = await env.sla_monitoring_db
					.prepare(
						`
                            SELECT
                                sla_checks.id,
                                sla_checks.service_id,
                                services.name AS service_name,
                                sla_checks.status,
                                sla_checks.response_time_ms,
                                sla_checks.status_code,
                                sla_checks.error_message,
                                sla_checks.checked_at
                            FROM sla_checks
                            INNER JOIN services
                                ON services.id =
                                    sla_checks.service_id
                            ORDER BY sla_checks.checked_at DESC
                            LIMIT 10
                            `,
					)
					.all();

				return jsonResponse({
					success: true,

					data: {
						services: {
							total: services?.total ?? 0,

							up: services?.up ?? 0,

							down: services?.down ?? 0,

							degraded: services?.degraded ?? 0,

							unknown: services?.unknown ?? 0,
						},

						incidents: {
							total: incidents?.total ?? 0,

							active: incidents?.active ?? 0,

							resolved: incidents?.resolved ?? 0,
						},

						monitoring: {
							period: 'last_24_hours',

							total_checks: totalChecks,

							successful_checks: successfulChecks,

							failed_checks: monitoring?.failed_checks ?? 0,

							uptime_percentage: Number(uptimePercentage.toFixed(4)),

							average_response_time_ms: Math.round(monitoring?.average_response_time_ms ?? 0),
						},

						recent_incidents: recentIncidents.results,

						recent_checks: recentChecks.results,
					},
				});
			} catch (error) {
				console.error('Dashboard summary error:', error);

				return internalError('Failed to fetch dashboard summary');
			}
		}

		// ====================================
		// UNKNOWN ROUTE
		// ====================================

		return jsonResponse(
			{
				success: false,
				message: 'API endpoint not found',
			},
			404,
		);
	},

	// ========================================
	// CRON
	// ========================================

	async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
		console.log('SLA monitoring cron started');

		try {
			// ==================================
			// DELETE EXPIRED SESSIONS
			// ==================================

			await env.sla_monitoring_db
				.prepare(
					`
                    DELETE FROM sessions
                    WHERE expires_at <=
                        CURRENT_TIMESTAMP
                    `,
				)
				.run();

			// ==================================
			// GET ENABLED SERVICES
			// ==================================

			const services = await env.sla_monitoring_db
				.prepare(
					`
                        SELECT
                            id
                        FROM services
                        WHERE enabled = 1
                        ORDER BY id
                        `,
				)
				.all<{
					id: number;
				}>();

			// ==================================
			// CHECK ALL SERVICES
			// ==================================

			const checks = services.results.map((service) => checkService(env, service.id));

			const results = await Promise.allSettled(checks);

			// ==================================
			// LOG FAILED CHECK TASKS
			// ==================================

			results.forEach((result, index) => {
				if (result.status === 'rejected') {
					console.error(`Scheduled check failed for service ${services.results[index].id}:`, result.reason);
				}
			});

			console.log(`Checked ${services.results.length} enabled service(s)`);
		} catch (error) {
			console.error('SLA monitoring cron error:', error);
		}
	},
};
