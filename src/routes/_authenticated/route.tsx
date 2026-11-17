import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { api, authStorage } from "@/lib/api";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const token = authStorage.getToken();
    if (!token) {
      throw redirect({ to: "/auth", search: { next: location.pathname } });
    }
    const res = await api.getMe();
    if (!res || !res.user) {
      throw redirect({ to: "/auth", search: { next: location.pathname } });
    }
  },
  component: () => <Outlet />,
});
