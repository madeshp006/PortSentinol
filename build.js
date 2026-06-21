const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
  console.log('Building client application...');
  execSync('npm --prefix client run build', { stdio: 'inherit' });

  if (fs.existsSync('dist')) {
    fs.rmSync('dist', { recursive: true, force: true });
  }

  console.log('Copying client/dist to root dist...');
  fs.cpSync(path.join('client', 'dist'), 'dist', { recursive: true });
  console.log('Build completed successfully!');
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}
