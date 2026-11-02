// Temporary probe (to be deleted): lists request header NAMES and any user-agent-like values.
Deno.serve((req) => {
  const names = [...req.headers.keys()];
  const ua = Object.fromEntries([...req.headers.entries()].filter(([k]) => /agent|referer|purpose|country/i.test(k)));
  return Response.json({ names, ua });
});
