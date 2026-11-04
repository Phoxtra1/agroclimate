export function refuseAppWorker(hostname: string, production: boolean, framed: boolean, disabled: boolean) {
  const host = hostname.toLowerCase();
  const label = host.split('.')[0];
  return !production || framed || disabled ||
    ((host.endsWith('.lovable.app') || host.endsWith('.gpt-eng.com') || host.endsWith('.gptengineer.run')) &&
      (/^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+$/.test(label) || /^project--.+-dev$/.test(label))) ||
    ['lovableproject.com', 'lovableproject-dev.com', 'beta.lovable.dev'].some(domain => host === domain || host.endsWith(`.${domain}`));
}