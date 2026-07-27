"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { authApi, unwrapUser } from "@/lib/api-client";
import type { Membership, User } from "@/types";

type AuthState = {
  user: User | null;
  loading: boolean;
  selectedMembership: Membership | null;
  setSelectedOrganization: (organizationId: string) => void;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (values: {
    name: string;
    email: string;
    password: string;
    organizationName?: string;
  }) => Promise<User>;
  signOut: () => Promise<void>;
  reload: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const loadUser = useCallback(async () => {
    setLoading(true);
    try {
      const nextUser = unwrapUser(await authApi.me());
      setUser(nextUser);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  useEffect(() => {
    const remembered =
      typeof window !== "undefined" ? window.localStorage.getItem("hostly:selected-org") : null;
    if (remembered) setSelectedOrganizationId(remembered);
  }, []);

  const selectedMembership = useMemo(() => {
    if (!user?.memberships?.length) return null;
    return (
      user.memberships.find(
        (membership) => membership.organizationId === selectedOrganizationId
      ) || user.memberships[0]
    );
  }, [selectedOrganizationId, user]);

  const setSelectedOrganization = useCallback((organizationId: string) => {
    setSelectedOrganizationId(organizationId);
    window.localStorage.setItem("hostly:selected-org", organizationId);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await authApi.signIn({ email, password });
    setUser(result.user);
    return result.user;
  }, []);

  const signUp = useCallback(
    async (values: {
      name: string;
      email: string;
      password: string;
      organizationName?: string;
    }) => {
      const result = await authApi.signUp(values);
      setUser(result.user);
      return result.user;
    },
    []
  );

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      router.push("/");
      router.refresh();
    }
  }, [router]);

  useEffect(() => {
    const segments = pathname.split("/").filter(Boolean);
    const isProtectedOrganizationRoute =
      segments[0] === "org" && segments.length > 2;
    if (
      !loading &&
      !user &&
      (pathname.startsWith("/dashboard") || isProtectedOrganizationRoute)
    ) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, pathname, router, user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        selectedMembership,
        setSelectedOrganization,
        signIn,
        signUp,
        signOut,
        reload: loadUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
