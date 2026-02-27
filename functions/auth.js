// OAuth initialization - redirects to GitHub
export async function onRequestGet(context) {
  const clientId = context.env.GITHUB_CLIENT_ID;
  const redirectUri = `${new URL(context.request.url).origin}/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'repo,user',
    state: crypto.randomUUID(),
  });

  return Response.redirect(
    `https://github.com/login/oauth/authorize?${params.toString()}`,
    302
  );
}
