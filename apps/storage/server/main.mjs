import { createService } from './service.mjs';
const server = await createService();
server.listen(Number(process.env.PORT || 8174), '0.0.0.0', () => console.log('Storage service listening'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
