import type {
  AnalyticsOverview,
  AiAssistantInsights,
  AiAssistantResponse,
  AuditLogResponse,
  AuditAction,
  ApiErrorShape,
  AvailabilityResponse,
  CheckInStats,
  DataDeletionRequest,
  DeletionRequestResponse,
  DeletionRequestStatus,
  EventDetail,
  EventFormValues,
  EventListResponse,
  Organization,
  OrganizationMember,
  OrgRole,
  PaginatedEventResponse,
  PublicOrganizationProfile,
  Registration,
  RegistrationResult,
  Room,
  RoomInput,
  Venue,
  VenueInput,
  User
} from "@/types";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:4100/api/v1";

function apiBaseUrl() {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/backend`;
  }
  return API_URL;
}

function apiUrl(path: string) {
  return `${apiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: ApiErrorShape;

  constructor(message: string, status: number, details?: ApiErrorShape) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = details?.code;
    this.details = details;
  }
}

type ApiRequestOptions = RequestInit & {
  query?: Record<string, string | number | boolean | undefined | null>;
  skipAuthRefresh?: boolean;
  next?: {
    revalidate?: number | false;
    tags?: string[];
  };
};

let refreshPromise: Promise<boolean> | null = null;

function errorMessage(body: ApiErrorShape | null, status: number) {
  if (!body?.message) return `Request failed (${status})`;
  return Array.isArray(body.message) ? body.message.join(". ") : body.message;
}

async function refreshBrowserSession() {
  if (!refreshPromise) {
    refreshPromise = fetch(apiUrl("/auth/refresh"), {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" }
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function apiBlob(
  path: string,
  query: Record<string, string | number | undefined> = {},
  retried = false
): Promise<{ blob: Blob; filename?: string }> {
  const url = new URL(apiUrl(path));
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    credentials: "include",
    headers: { Accept: "*/*" }
  });
  if (
    response.status === 401 &&
    !retried &&
    typeof window !== "undefined" &&
    (await refreshBrowserSession())
  ) {
    return apiBlob(path, query, true);
  }
  if (!response.ok) {
    let body: ApiErrorShape | null = null;
    try {
      body = (await response.json()) as ApiErrorShape;
    } catch {
      // File responses do not always include a JSON error body.
    }
    throw new ApiError(errorMessage(body, response.status), response.status, body ?? undefined);
  }

  const disposition = response.headers.get("content-disposition") || "";
  const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
  return {
    blob: await response.blob(),
    filename: filenameMatch?.[1]
  };
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { query, headers, skipAuthRefresh, ...requestOptions } = options;
  const url = new URL(apiUrl(path));

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const isFormData =
    typeof FormData !== "undefined" && requestOptions.body instanceof FormData;
  const response = await fetch(url, {
    ...requestOptions,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(requestOptions.body && !isFormData ? { "Content-Type": "application/json" } : {}),
      ...headers
    }
  });

  const isSessionEndpoint =
    path.startsWith("/auth/login") ||
    path.startsWith("/auth/signup") ||
    path.startsWith("/auth/refresh") ||
    path.startsWith("/auth/logout");
  if (
    response.status === 401 &&
    !skipAuthRefresh &&
    !isSessionEndpoint &&
    typeof window !== "undefined" &&
    (await refreshBrowserSession())
  ) {
    return apiRequest<T>(path, { ...options, skipAuthRefresh: true });
  }

  if (!response.ok) {
    let body: ApiErrorShape | null = null;
    try {
      body = (await response.json()) as ApiErrorShape;
    } catch {
      // Some upstream failures do not include JSON.
    }
    throw new ApiError(errorMessage(body, response.status), response.status, body ?? undefined);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

// Kept as an alias for server helpers while the application standardizes on apiRequest.
export const apiFetch = apiRequest;

function normalizeEventPage(
  response: EventListResponse | PaginatedEventResponse
): EventListResponse {
  if ("meta" in response) {
    return {
      items: response.items,
      total: response.meta.total,
      page: response.meta.page,
      pageSize: response.meta.pageSize,
      facets: response.facets
    };
  }
  return response;
}

export const authApi = {
  login(input: { email: string; password: string }) {
    return apiRequest<{ user: User; accessTokenExpiresIn: number }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  signIn(input: { email: string; password: string }) {
    return this.login(input);
  },
  signup(input: {
    name: string;
    email: string;
    password: string;
    organizationName?: string;
  }) {
    return apiRequest<{ user: User; accessTokenExpiresIn: number }>("/auth/signup", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  signUp(input: {
    name: string;
    email: string;
    password: string;
    organizationName?: string;
  }) {
    return this.signup(input);
  },
  refresh() {
    return apiRequest<{ user: User; accessTokenExpiresIn: number }>("/auth/refresh", {
      method: "POST",
      skipAuthRefresh: true
    });
  },
  me() {
    return apiRequest<User>("/auth/me", { cache: "no-store" });
  },
  logout() {
    return apiRequest<{ success: true }>("/auth/logout", {
      method: "POST",
      skipAuthRefresh: true
    });
  }
};

export const publicApi = {
  async events(
    filters: Record<string, string | number | undefined> = {}
  ): Promise<EventListResponse> {
    const response = await apiRequest<EventListResponse | PaginatedEventResponse>(
      "/public/events",
      { query: filters, next: { revalidate: 60 } }
    );
    return normalizeEventPage(response);
  },
  event(eventIdOrSlug: string) {
    return apiRequest<EventDetail>(
      `/public/events/${encodeURIComponent(eventIdOrSlug)}`,
      { next: { revalidate: 60 } }
    );
  },
  organization(orgSlug: string) {
    return apiRequest<PublicOrganizationProfile>(
      `/public/organizations/${encodeURIComponent(orgSlug)}`,
      { next: { revalidate: 60 } }
    );
  },
  register(
    eventId: string,
    input: {
      ticketTierId: string;
      attendeeName: string;
      attendeeEmail: string;
      attendeePhone?: string;
      marketingConsent?: boolean;
    }
  ) {
    return apiRequest<RegistrationResult>(
      `/public/events/${encodeURIComponent(eventId)}/registrations`,
      { method: "POST", body: JSON.stringify(input) }
    );
  },
  calendarUrl(eventIdOrSlug: string) {
    return apiUrl(`/public/events/${encodeURIComponent(eventIdOrSlug)}/calendar.ics`);
  }
};

export const organizationsApi = {
  async list(): Promise<Organization[]> {
    const response = await apiRequest<Organization[] | { items: Organization[] }>(
      "/organizations",
      { cache: "no-store" }
    );
    return Array.isArray(response) ? response : response.items;
  },
  get(organizationId: string) {
    return apiRequest<Organization>(
      `/organizations/${encodeURIComponent(organizationId)}`,
      { cache: "no-store" }
    );
  },
  getBySlug(orgSlug: string) {
    return apiRequest<Organization>(
      `/organizations/by-slug/${encodeURIComponent(orgSlug)}`,
      { cache: "no-store" }
    );
  },
  create(input: string | { name: string; description?: string }) {
    const body = typeof input === "string" ? { name: input } : input;
    return apiRequest<Organization>("/organizations", {
      method: "POST",
      body: JSON.stringify(body)
    });
  },
  update(
    organizationId: string,
    input: { name?: string; description?: string; logoUrl?: string }
  ) {
    return apiRequest<Organization>(
      `/organizations/${encodeURIComponent(organizationId)}`,
      { method: "PATCH", body: JSON.stringify(input) }
    );
  },
  async members(organizationId: string): Promise<OrganizationMember[]> {
    const response = await apiRequest<
      OrganizationMember[] | { items: OrganizationMember[] }
    >(`/organizations/${encodeURIComponent(organizationId)}/members`, {
      cache: "no-store"
    });
    return Array.isArray(response) ? response : response.items;
  },
  addMember(organizationId: string, input: { email: string; role: OrgRole }) {
    return apiRequest<OrganizationMember>(
      `/organizations/${encodeURIComponent(organizationId)}/members`,
      { method: "POST", body: JSON.stringify(input) }
    );
  },
  invite(organizationId: string, input: { email: string; role: OrgRole }) {
    return apiRequest<{
      invitation?: { id: string; email: string; role: OrgRole };
      id?: string;
      email?: string;
      role?: OrgRole;
      token?: string;
      acceptUrl?: string;
    }>(`/organizations/${encodeURIComponent(organizationId)}/invitations`, {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  updateMember(organizationId: string, memberId: string, role: OrgRole) {
    return apiRequest<OrganizationMember>(
      `/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(memberId)}`,
      { method: "PATCH", body: JSON.stringify({ role }) }
    );
  },
  removeMember(organizationId: string, memberId: string) {
    return apiRequest<void>(
      `/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(memberId)}`,
      { method: "DELETE" }
    );
  },
  acceptInvitation(token: string) {
    return apiRequest<{ organization: Organization; role: OrgRole; accepted: true }>(
      `/organizations/invitations/${encodeURIComponent(token)}/accept`,
      { method: "POST" }
    );
  }
};

export const eventsApi = {
  list(
    organizationId: string,
    filters: Record<string, string | number | undefined> = {}
  ) {
    return apiRequest<EventListResponse | PaginatedEventResponse>(
      `/organizations/${encodeURIComponent(organizationId)}/events`,
      { query: filters, cache: "no-store" }
    );
  },
  get(organizationId: string, eventId: string) {
    return apiRequest<EventDetail>(
      `/organizations/${encodeURIComponent(organizationId)}/events/${encodeURIComponent(eventId)}`,
      { cache: "no-store" }
    );
  },
  create(organizationId: string, input: EventFormValues) {
    return apiRequest<EventDetail>(
      `/organizations/${encodeURIComponent(organizationId)}/events`,
      { method: "POST", body: JSON.stringify(input) }
    );
  },
  update(organizationId: string, eventId: string, input: EventFormValues) {
    return apiRequest<EventDetail>(
      `/organizations/${encodeURIComponent(organizationId)}/events/${encodeURIComponent(eventId)}`,
      { method: "PATCH", body: JSON.stringify(input) }
    );
  },
  publish(organizationId: string, eventId: string, publish: boolean) {
    return apiRequest<EventDetail>(
      `/organizations/${encodeURIComponent(organizationId)}/events/${encodeURIComponent(eventId)}/${publish ? "publish" : "unpublish"}`,
      { method: "POST" }
    );
  },
  remove(organizationId: string, eventId: string) {
    return apiRequest<void>(
      `/organizations/${encodeURIComponent(organizationId)}/events/${encodeURIComponent(eventId)}`,
      { method: "DELETE" }
    );
  },
  async uploadCover(file: File) {
    const data = new FormData();
    data.append("file", file);
    const response = await apiRequest<{ url: string; provider?: string }>(
      "/uploads/event-cover",
      { method: "POST", body: data }
    );
    return {
      ...response,
      url: response.url.startsWith("/")
        ? `${new URL(API_URL).origin}${response.url}`
        : response.url
    };
  }
};

export const registrationsApi = {
  async mine(): Promise<Registration[]> {
    const response = await apiRequest<Registration[] | { items: Registration[] }>(
      "/registrations/mine",
      { cache: "no-store" }
    );
    return Array.isArray(response) ? response : response.items;
  },
  async forEvent(
    organizationId: string,
    eventId: string,
    filters: {
      search?: string;
      status?: string;
      ticketTierId?: string;
      page?: number;
      pageSize?: number;
    } = {}
  ): Promise<Registration[]> {
    const response = await apiRequest<Registration[] | { items: Registration[] }>(
      `/organizations/${encodeURIComponent(organizationId)}/events/${encodeURIComponent(eventId)}/registrations`,
      { query: { page: 1, pageSize: 100, ...filters }, cache: "no-store" }
    );
    return Array.isArray(response) ? response : response.items;
  },
  get(registrationId: string) {
    return apiRequest<Registration>(
      `/registrations/${encodeURIComponent(registrationId)}`,
      { cache: "no-store" }
    );
  },
  calendarUrl(registrationId: string) {
    return apiUrl(`/registrations/${encodeURIComponent(registrationId)}/calendar.ics`);
  }
};

export const checkInApi = {
  validate(organizationId: string, eventId: string, code: string) {
    return apiRequest<{ registration: Registration; alreadyCheckedIn: boolean }>(
      `/organizations/${encodeURIComponent(organizationId)}/events/${encodeURIComponent(eventId)}/check-in`,
      { method: "POST", body: JSON.stringify({ code }) }
    );
  },
  stats(organizationId: string, eventId: string) {
    return apiRequest<CheckInStats>(
      `/organizations/${encodeURIComponent(organizationId)}/events/${encodeURIComponent(eventId)}/check-in/stats`,
      { cache: "no-store" }
    );
  }
};

export const analyticsApi = {
  overview(organizationId: string) {
    return apiRequest<AnalyticsOverview>(
      `/organizations/${encodeURIComponent(organizationId)}/analytics/overview`,
      { cache: "no-store" }
    );
  }
};

export const aiAssistantApi = {
  insights(organizationId: string) {
    return apiRequest<AiAssistantInsights>(
      `/organizations/${encodeURIComponent(organizationId)}/ai-assistant/insights`,
      { cache: "no-store" }
    );
  },
  chat(organizationId: string, message: string) {
    return apiRequest<AiAssistantResponse>(
      `/organizations/${encodeURIComponent(organizationId)}/ai-assistant/chat`,
      { method: "POST", body: JSON.stringify({ message }) }
    );
  },
  generateDescription(
    organizationId: string,
    input: { title: string; bullets: string }
  ) {
    return apiRequest<{ description: string; generated: boolean; degraded?: boolean }>(
      `/organizations/${encodeURIComponent(organizationId)}/ai-assistant/descriptions`,
      { method: "POST", body: JSON.stringify(input) }
    );
  },
  confirm(organizationId: string, confirmationToken: string) {
    return apiRequest<{ message: string; event: EventDetail }>(
      `/organizations/${encodeURIComponent(organizationId)}/ai-assistant/actions/confirm`,
      { method: "POST", body: JSON.stringify({ confirmationToken }) }
    );
  }
};

export const venuesApi = {
  async list(organizationId: string): Promise<Venue[]> {
    const response = await apiRequest<Venue[] | { items: Venue[] }>(
      `/organizations/${encodeURIComponent(organizationId)}/venues`,
      { cache: "no-store" }
    );
    return Array.isArray(response) ? response : response.items;
  },
  get(organizationId: string, venueId: string) {
    return apiRequest<Venue>(
      `/organizations/${encodeURIComponent(organizationId)}/venues/${encodeURIComponent(venueId)}`,
      { cache: "no-store" }
    );
  },
  create(organizationId: string, input: VenueInput) {
    return apiRequest<Venue>(
      `/organizations/${encodeURIComponent(organizationId)}/venues`,
      { method: "POST", body: JSON.stringify(input) }
    );
  },
  update(organizationId: string, venueId: string, input: VenueInput) {
    return apiRequest<Venue>(
      `/organizations/${encodeURIComponent(organizationId)}/venues/${encodeURIComponent(venueId)}`,
      { method: "PATCH", body: JSON.stringify(input) }
    );
  },
  remove(organizationId: string, venueId: string) {
    return apiRequest<void>(
      `/organizations/${encodeURIComponent(organizationId)}/venues/${encodeURIComponent(venueId)}`,
      { method: "DELETE" }
    );
  },
  createRoom(organizationId: string, venueId: string, input: RoomInput) {
    return apiRequest<Room>(
      `/organizations/${encodeURIComponent(organizationId)}/venues/${encodeURIComponent(venueId)}/rooms`,
      { method: "POST", body: JSON.stringify(input) }
    );
  },
  updateRoom(
    organizationId: string,
    venueId: string,
    roomId: string,
    input: RoomInput
  ) {
    return apiRequest<Room>(
      `/organizations/${encodeURIComponent(organizationId)}/venues/${encodeURIComponent(venueId)}/rooms/${encodeURIComponent(roomId)}`,
      { method: "PATCH", body: JSON.stringify(input) }
    );
  },
  removeRoom(organizationId: string, venueId: string, roomId: string) {
    return apiRequest<void>(
      `/organizations/${encodeURIComponent(organizationId)}/venues/${encodeURIComponent(venueId)}/rooms/${encodeURIComponent(roomId)}`,
      { method: "DELETE" }
    );
  },
  availability(
    organizationId: string,
    filters: {
      from: string;
      to: string;
      venueId?: string;
      roomId?: string;
    }
  ) {
    return apiRequest<AvailabilityResponse>(
      `/organizations/${encodeURIComponent(organizationId)}/venues/availability`,
      { query: filters, cache: "no-store" }
    );
  }
};

export const activityApi = {
  list(
    organizationId: string,
    filters: {
      action?: AuditAction;
      entityType?: string;
      actorId?: string;
      from?: string;
      to?: string;
      page?: number;
      pageSize?: number;
    } = {}
  ) {
    return apiRequest<AuditLogResponse>(
      `/organizations/${encodeURIComponent(organizationId)}/activity`,
      { query: filters, cache: "no-store" }
    );
  }
};

export const complianceApi = {
  export(organizationId: string, format: "json" | "csv") {
    return apiBlob(
      `/organizations/${encodeURIComponent(organizationId)}/compliance/export`,
      { format }
    );
  },
  requestDeletion(organizationId: string, reason?: string) {
    return apiRequest<DataDeletionRequest>(
      `/organizations/${encodeURIComponent(organizationId)}/compliance/deletion-requests`,
      { method: "POST", body: JSON.stringify({ reason: reason?.trim() || undefined }) }
    );
  },
  async mine(organizationId: string): Promise<DataDeletionRequest[]> {
    const response = await apiRequest<
      DataDeletionRequest[] | DeletionRequestResponse
    >(
      `/organizations/${encodeURIComponent(organizationId)}/compliance/deletion-requests/mine`,
      { cache: "no-store" }
    );
    return Array.isArray(response) ? response : response.items;
  },
  list(
    organizationId: string,
    filters: {
      status?: DeletionRequestStatus;
      page?: number;
      pageSize?: number;
    } = {}
  ) {
    return apiRequest<DeletionRequestResponse>(
      `/organizations/${encodeURIComponent(organizationId)}/compliance/deletion-requests`,
      { query: filters, cache: "no-store" }
    );
  },
  updateRequest(
    organizationId: string,
    requestId: string,
    input: {
      status: Exclude<DeletionRequestStatus, "PENDING">;
      adminNote?: string;
    }
  ) {
    return apiRequest<DataDeletionRequest>(
      `/organizations/${encodeURIComponent(organizationId)}/compliance/deletion-requests/${encodeURIComponent(requestId)}`,
      { method: "PATCH", body: JSON.stringify(input) }
    );
  }
};

export function unwrapUser(value: User | { user: User }): User {
  return "user" in value ? value.user : value;
}

export function unwrapItems<T>(value: T[] | { items: T[] }): T[] {
  return Array.isArray(value) ? value : value.items;
}
