import { Connection, PublicKey, Logs, Commitment } from '@solana/web3.js';

export interface ProgramEvent {
  name: string;
  data: any;
}

export function onProgramEvent(
  connection: Connection,
  programId: PublicKey,
  cb: (e: ProgramEvent) => void,
  commitment: Commitment = 'confirmed'
) {
  connection.onLogs(programId, (logs: Logs) => {
    for (const log of logs.logs) {
      const prefix = 'Program log: ';
      if (log.startsWith(prefix)) {
        const json = log.slice(prefix.length);
        try {
          const obj = JSON.parse(json);
          const [name, data] = Object.entries(obj)[0];
          cb({ name, data });
        } catch {
          continue;
        }
      }
    }
  }, commitment);
}
