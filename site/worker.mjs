export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404) return response;

    const url = new URL(request.url);
    if (!url.pathname.includes(".")) {
      const routeUrl = new URL(request.url);
      routeUrl.pathname = `${url.pathname.replace(/\/$/, "") || "/index"}.html`;
      const routeResponse = await env.ASSETS.fetch(new Request(routeUrl, request));
      if (routeResponse.status !== 404) return routeResponse;
    }

    return env.ASSETS.fetch(new Request(new URL("/index.html", request.url), request));
  },
};
