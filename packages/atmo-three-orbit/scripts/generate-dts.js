import { exec } from 'child_process';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Run tsc with the build config to generate declaration files
exec('tsc -p tsconfig.build.json', { cwd: dirname(__dirname) }, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error generating declaration files: ${error.message}`);
    return;
  }
  if (stderr) {
    console.error(`stderr: ${stderr}`);
    return;
  }
  console.log(`Declaration files generated successfully.`);
});
