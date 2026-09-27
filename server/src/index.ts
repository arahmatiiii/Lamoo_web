import { buildApp } from './app.ts';

const { app, ctx, close } = buildApp();

async function main() {
  await app.listen({ port: ctx.env.port, host: ctx.env.host });
  app.log.info(
    { db: ctx.env.dbPath, registration: ctx.env.allowRegistration },
    'lamoo server listening'
  );
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void close().then(() => process.exit(0));
  });
}

main().catch((error) => {
  app.log.error(error, 'failed to start');
  process.exit(1);
});
