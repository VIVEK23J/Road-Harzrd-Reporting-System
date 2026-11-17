export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
}

export interface Hazard {
  id: string;
  reporter_id: string;
  reporter_name?: string | undefined;
  type: "pothole" | "debris" | "flooding" | "signal" | "crack" | "lighting" | "other";
  severity: "low" | "medium" | "high" | "critical";
  status: "pending" | "verified" | "in_progress" | "resolved" | "rejected";
  description: string | null;
  address: string | null;
  photo_path: string | null;
  photo_url?: string | null | undefined;
  latitude: number;
  longitude: number;
  vote_count: number;
  admin_note: string | null;
  created_at: string;
  updated_at?: string | undefined;
}

export interface HazardEvent {
  id: string;
  hazard_id: string;
  status: string;
  note: string;
  created_at: string;
}

export interface HazardComment {
  id: string;
  hazard_id: string;
  user_id: string;
  name: string;
  body: string;
  created_at: string;
}

const TOKEN_KEY = "roadwatch_jwt";

export const authStorage = {
  getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY);
  },
  setToken(token: string) {
    if (typeof window !== "undefined") {
      localStorage.setItem(TOKEN_KEY, token);
      window.dispatchEvent(new Event("roadwatch_auth_change"));
    }
  },
  clearToken() {
    if (typeof window !== "undefined") {
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new Event("roadwatch_auth_change"));
    }
  },
};

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = authStorage.getToken();
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(endpoint, { ...options, headers });
  if (!res.ok) {
    let errorMsg = `Request failed: ${res.status}`;
    try {
      const errJson = await res.json();
      errorMsg = errJson.error || errorMsg;
    } catch {
      // fallback
    }
    throw new Error(errorMsg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // Auth
  async signUp(body: { email: string; password: string; name: string }) {
    const data = await fetchApi<{ token: string; user: AuthUser }>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(body),
    });
    authStorage.setToken(data.token);
    return data;
  },

  async signIn(body: { email: string; password: string }) {
    const data = await fetchApi<{ token: string; user: AuthUser }>("/api/auth/signin", {
      method: "POST",
      body: JSON.stringify(body),
    });
    authStorage.setToken(data.token);
    return data;
  },

  async getMe(): Promise<{ user: AuthUser } | null> {
    const token = authStorage.getToken();
    if (!token) return null;
    try {
      return await fetchApi<{ user: AuthUser }>("/api/auth/me");
    } catch {
      authStorage.clearToken();
      return null;
    }
  },

  signOut() {
    authStorage.clearToken();
  },

  // Hazards
  async getHazards(): Promise<Hazard[]> {
    return fetchApi<Hazard[]>("/api/hazards");
  },

  async getHazard(id: string): Promise<Hazard> {
    return fetchApi<Hazard>(`/api/hazards/${id}`);
  },

  async createHazard(data: {
    type: string;
    severity: string;
    description?: string | undefined;
    address?: string | undefined;
    photo_url: string;
    latitude: number;
    longitude: number;
  }): Promise<Hazard> {
    return fetchApi<Hazard>("/api/hazards", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getMyHazards(): Promise<Hazard[]> {
    return fetchApi<Hazard[]>("/api/my-hazards");
  },

  async getHazardEvents(id: string): Promise<HazardEvent[]> {
    return fetchApi<HazardEvent[]>(`/api/hazards/${id}/events`);
  },

  async getHazardComments(id: string): Promise<HazardComment[]> {
    return fetchApi<HazardComment[]>(`/api/hazards/${id}/comments`);
  },

  async addComment(id: string, body: string): Promise<HazardComment> {
    return fetchApi<HazardComment>(`/api/hazards/${id}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
  },

  async toggleVote(id: string): Promise<{ voted: boolean; vote_count: number }> {
    return fetchApi<{ voted: boolean; vote_count: number }>(`/api/hazards/${id}/vote`, {
      method: "POST",
    });
  },

  async getMyVote(id: string): Promise<{ voted: boolean }> {
    return fetchApi<{ voted: boolean }>(`/api/hazards/${id}/my-vote`);
  },

  // Admin
  async getAdminHazards(): Promise<Hazard[]> {
    return fetchApi<Hazard[]>("/api/admin/hazards");
  },

  async updateHazardStatus(id: string, status: string, admin_note?: string | undefined): Promise<Hazard> {
    return fetchApi<Hazard>(`/api/admin/hazards/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status, admin_note }),
    });
  },

  async deleteHazard(id: string): Promise<{ success: boolean }> {
    return fetchApi<{ success: boolean }>(`/api/admin/hazards/${id}`, {
      method: "DELETE",
    });
  },
};
