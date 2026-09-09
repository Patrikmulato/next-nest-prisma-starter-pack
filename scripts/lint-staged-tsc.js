import { spawnSync } from 'node:child_process';

const result = spawnSync('pnpm exec -- tsc --project tsconfig.json --noEmit --noEmitOnError', {
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 1);
