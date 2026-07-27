export type OrgRole = "ORG_ADMIN" | "ORGANIZER" | "ATTENDEE";
export type EventStatus = "DRAFT" | "PUBLISHED" | "CANCELLED";
export type VenueType = "PHYSICAL" | "VIRTUAL" | "HYBRID";
export type RegistrationStatus = "CONFIRMED" | "CANCELLED" | "CHECKED_IN";
export type RoomAvailabilityType = "HOURLY" | "PER_EVENT";
export type DeletionRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED";
export type AuditAction =
  | "EVENT_CREATED"
  | "EVENT_UPDATED"
  | "EVENT_DELETED"
  | "VENUE_CREATED"
  | "VENUE_UPDATED"
  | "VENUE_DELETED"
  | "ROOM_CREATED"
  | "ROOM_UPDATED"
  | "ROOM_DELETED"
  | "MEMBER_ROLE_CHANGED"
  | "REGISTRATION_CHECKED_IN";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  logoUrl?: string | null;
  currentRole?: OrgRole;
  _count?: {
    events: number;
    memberships: number;
  };
}

export interface Membership {
  id?: string;
  role: OrgRole;
  organizationId: string;
  organization: Organization;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  memberships: Membership[];
}

export interface TicketTier {
  id?: string;
  name: string;
  description?: string | null;
  capacity: number;
  registeredCount?: number;
  remaining?: number;
  priceCents?: number;
  currency?: string;
  priceLabel?: string;
  isActive?: boolean;
}

export interface EventOrganization {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  logoUrl?: string | null;
}

export interface EventSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  excerpt?: string;
  startsAt: string;
  endsAt: string;
  timezone?: string;
  venueType: VenueType;
  locationType?: VenueType;
  venueName?: string | null;
  address?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  virtualUrl?: string | null;
  venueId?: string | null;
  roomId?: string | null;
  venue?: EventVenueSummary | null;
  room?: EventRoomSummary | null;
  coverImageUrl?: string | null;
  category: string;
  tags: string[];
  status: EventStatus;
  capacity: number;
  registeredCount: number;
  checkedInCount?: number;
  organization: EventOrganization;
  ticketTiers?: TicketTier[];
}

export interface EventDetail extends EventSummary {
  organizer?: {
    id: string;
    name: string;
  };
  publishedAt?: string | null;
}

export interface EventListResponse {
  items: EventSummary[];
  total: number;
  page: number;
  pageSize: number;
  facets?: {
    categories?: string[];
    cities?: string[];
  };
}

export interface PaginatedEventResponse {
  items: EventSummary[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  total?: number;
  page?: number;
  pageSize?: number;
  facets?: EventListResponse["facets"];
}

export interface Registration {
  id: string;
  eventId: string;
  status: RegistrationStatus;
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone?: string | null;
  checkInCode: string;
  qrCode?: string;
  qrCodeDataUrl?: string | null;
  checkedInAt?: string | null;
  createdAt: string;
  event: EventSummary;
  ticketTier: TicketTier;
}

export interface RegistrationResult {
  registration: Omit<Registration, "event"> & { event?: EventSummary };
  qrCodeDataUrl?: string;
  calendarUrl?: string;
}

export interface OrganizationMember {
  id: string;
  organizationId?: string;
  userId?: string;
  role: OrgRole;
  createdAt?: string;
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  };
}

export interface AnalyticsOverview {
  summary: {
    totalEvents: number;
    upcomingEvents: number;
    totalRegistrations: number;
    checkInRate: number;
  };
  events: Array<{
    id: string;
    title: string;
    startsAt: string;
    status?: EventStatus;
    registrations: number;
    checkedIn: number;
    capacity: number;
    checkInRate?: number;
    fillRate?: number;
  }>;
  registrationTrend: Array<{
    date: string;
    registrations: number;
  }>;
}

export interface CheckInStats {
  eventId: string;
  registered: number;
  checkedIn: number;
  remaining?: number;
  checkInRate?: number;
}

export interface PublicOrganizationProfile {
  organization: Organization;
  events: EventSummary[];
  totalEvents: number;
}

export interface ApiErrorShape {
  statusCode?: number;
  code?: string;
  message?: string | string[];
  error?: string;
}

export interface EventFormValues {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  venueType: VenueType;
  venueName?: string;
  address?: string;
  city?: string;
  virtualUrl?: string;
  venueId?: string;
  roomId?: string;
  capacity: number;
  coverImageUrl?: string;
  category: string;
  tags: string[];
  ticketTiers: Array<{
    id?: string;
    name: string;
    description?: string;
    capacity: number;
    priceCents?: number;
    currency?: string;
  }>;
}

export interface Room {
  id: string;
  venueId: string;
  name: string;
  capacity: number;
  floor?: string | null;
  equipment: string[];
  availabilityType: RoomAvailabilityType;
  createdAt?: string;
  updatedAt?: string;
}

export type EventVenueSummary = Pick<Venue, "id" | "name" | "address">;

export type EventRoomSummary = Pick<Room, "id" | "name" | "capacity">;

export interface Venue {
  id: string;
  organizationId: string;
  name: string;
  address: string;
  capacity: number;
  description?: string | null;
  imageUrl?: string | null;
  rooms: Room[];
  createdAt?: string;
  updatedAt?: string;
}

export interface VenueInput {
  name: string;
  address: string;
  capacity: number;
  description?: string;
  imageUrl?: string;
}

export interface RoomInput {
  name: string;
  capacity: number;
  floor?: string;
  equipment: string[];
  availabilityType: RoomAvailabilityType;
}

export interface RoomBooking {
  eventId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: EventStatus;
}

export interface RoomAvailability {
  id: string;
  name: string;
  venueId: string;
  venueName: string;
  capacity: number;
  bookings: RoomBooking[];
}

export interface AvailabilityResponse {
  from: string;
  to: string;
  rooms: RoomAvailability[];
}

export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  entityLabel?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface AuditLogResponse {
  items: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  meta?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages?: number;
  };
}

export interface DataDeletionRequest {
  id: string;
  organizationId: string;
  requesterId: string;
  requesterEmail: string;
  reason?: string | null;
  status: DeletionRequestStatus;
  adminNote?: string | null;
  createdAt: string;
  updatedAt: string;
  processedAt?: string | null;
  processedById?: string | null;
  requester?: {
    id: string;
    name: string;
    email: string;
  };
  processedBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface DeletionRequestResponse {
  items: DataDeletionRequest[];
  total?: number;
  page?: number;
  pageSize?: number;
  meta?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages?: number;
  };
}

export interface AiAssistantSource {
  type?: "event" | "room";
  id?: string;
  label?: string;
}

export interface AiEventProposal {
  kind: "CREATE_EVENT";
  confirmationToken: string;
  expiresAt: string;
  event: {
    title: string;
    description: string;
    startsAt: string;
    endsAt: string;
    timezone: string;
    venueType: VenueType;
    venueName?: string;
    capacity: number;
    category: string;
    tags: string[];
    ticketTiers: Array<{
      name: string;
      description?: string;
      capacity: number;
    }>;
  };
}

export interface AiAssistantResponse {
  message: string;
  grounded: boolean;
  degraded?: boolean;
  generatedDescription?: string;
  facts?: Record<string, number>;
  sources: Array<AiAssistantSource | string>;
  proposal?: AiEventProposal;
}

export interface AiAssistantInsights {
  generatedAt: string;
  insights: string[];
  summary: {
    events: number;
    registrations: number;
    rooms: number;
  };
}
