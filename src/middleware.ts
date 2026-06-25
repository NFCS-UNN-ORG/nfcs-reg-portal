import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database.types";

const PUBLIC_ROUTES = ["/", "/login", "/register", "/forgot-password", "/reset-password"];
const CLAIM_ROUTE = "/claim-account";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Allow public static assets and API routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // 2. Create response object
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // 3. Initialize Supabase SSR client for middleware session refresh
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // 4. Get session user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  console.log(`[Middleware] Pathname: ${pathname}, User ID: ${user?.id ?? "none"}`);

  // Helper for redirects that preserves cookies set by Supabase
  const redirectResponse = (toPath: string) => {
    const url = request.nextUrl.clone();
    url.pathname = toPath;
    const redirectRes = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => {
      redirectRes.cookies.set(cookie.name, cookie.value, {
        path: cookie.path,
        domain: cookie.domain,
        maxAge: cookie.maxAge,
        secure: cookie.secure,
        sameSite: cookie.sameSite,
        expires: cookie.expires,
        httpOnly: cookie.httpOnly,
      });
    });
    return redirectRes;
  };

  // 5. Routing checks based on authentication state
  if (user) {
    // Authenticated user going to public auth routes (including "/") -> redirect to dashboard
    if (PUBLIC_ROUTES.some((r) => pathname === r)) {
      console.log(`[Middleware] Authenticated user on public route: redirecting to /dashboard`);
      return redirectResponse("/dashboard");
    }

    // Check role restrictions for /admin routes
    if (pathname.startsWith("/admin")) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!profile || !["exco", "super_admin"].includes(profile.role)) {
        console.log(`[Middleware] Non-admin accessing admin route: redirecting to /dashboard`);
        return redirectResponse("/dashboard");
      }

      // Super admin only route check
      if (
        pathname.startsWith("/admin/settings") &&
        profile.role !== "super_admin"
      ) {
        console.log(`[Middleware] Non-super_admin accessing system settings: redirecting to /admin`);
        return redirectResponse("/admin");
      }
    }
  } else {
    // Unauthenticated user
    const isPublicRoute = PUBLIC_ROUTES.some((r) => pathname === r);
    const isClaimRoute = pathname.startsWith(CLAIM_ROUTE);

    if (!isPublicRoute && !isClaimRoute) {
      console.log(`[Middleware] Unauthenticated user accessing protected route: redirecting to /login`);
      return redirectResponse("/login");
    }
  }

  console.log(`[Middleware] Allowing access to: ${pathname}`);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
