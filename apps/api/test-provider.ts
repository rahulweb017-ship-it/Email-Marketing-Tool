import 'dotenv/config';
import { db } from './src/config/database.js';
import { getSendingConfig } from './src/modules/sending/sending-config.service.js';
import { SmtpProvider } from './src/modules/sending/providers/smtp.provider.js';

(async () => {
  try {
    const orgId = '89cb109b-8979-4a08-93e1-1e372100c656';
    const configId = '03e0798a-f315-4177-b442-499e20b254c1';

    console.log('1. Testing getSendingConfig...');
    const config = await getSendingConfig(orgId, configId);
    console.log('   Provider:', config.provider);
    console.log('   Settings:', config.settings);

    console.log('\n2. Creating SmtpProvider...');
    const provider = new SmtpProvider({
      host: config.settings.host,
      port: config.settings.port,
      secure: config.settings.secure ?? false,
      auth: config.settings.username ? { user: config.settings.username, pass: config.settings.password } : undefined,
    });

    console.log('   Provider created successfully!');

    console.log('\n3. Sending test email...');
    const result = await provider.send({
      from: 'mss.ankush01@gmail.com',
      to: 'roshankumar402@gmail.com',
      subject: '[WORKER TEST] Direct send test',
      html: '<h1>Worker Test</h1><p>This is a direct test from the worker code path.</p>',
    });

    console.log('   Result:', result);
  } catch (err: any) {
    console.error('Error:', err.message);
  }

  process.exit(0);
})();
