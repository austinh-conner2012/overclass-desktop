// Mac: sign the finished app "ad hoc" (no paid Apple certificate). Without a signature, macOS calls a
// downloaded copy damaged; with one it just asks the first time (right-click → Open).
const { execFileSync } = require('child_process');
const path = require('path');

exports.default = async function (context) {
  if (context.electronPlatformName !== 'darwin') return;
  const app = path.join(context.appOutDir, context.packager.appInfo.productFilename + '.app');
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
};
