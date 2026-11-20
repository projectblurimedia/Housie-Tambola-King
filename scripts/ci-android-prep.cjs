// CI (GitHub Actions) — run from app/ after `expo prebuild --platform android`:
//   * release builds signed with the upload key (app/android/app/upload.jks, from a secret;
//     passwords from env HTK_STORE_PASSWORD / HTK_KEY_ALIAS / HTK_KEY_PASSWORD),
//   * the build asks for OTA updates on the "production" channel (Play installs).
const fs = require('fs');

const g = 'android/app/build.gradle';
let s = fs.readFileSync(g, 'utf8');
const release = [
  '    signingConfigs {',
  '        release {',
  "            storeFile file('upload.jks')",
  "            storePassword System.getenv('HTK_STORE_PASSWORD')",
  "            keyAlias System.getenv('HTK_KEY_ALIAS')",
  "            keyPassword System.getenv('HTK_KEY_PASSWORD')",
  '        }',
  '        debug {',
].join('\n');
if (!s.includes("storeFile file('upload.jks')")) {
  if (!s.includes('    signingConfigs {\n        debug {')) throw new Error('signingConfigs block not found');
  s = s.replace('    signingConfigs {\n        debug {', release);
  const before = s;
  s = s.replace(
    /(release \{\n(?:[^\n]*\n){0,3}?)\s*signingConfig signingConfigs\.debug/,
    '$1            signingConfig signingConfigs.release',
  );
  if (s === before) throw new Error('release signingConfig line not found');
}
fs.writeFileSync(g, s);

const m = 'android/app/src/main/AndroidManifest.xml';
let x = fs.readFileSync(m, 'utf8');
if (!x.includes('UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY')) {
  const anchor = '<meta-data android:name="expo.modules.updates.EXPO_UPDATE_URL"';
  if (!x.includes(anchor)) throw new Error('updates URL meta-data not found');
  x = x.replace(
    anchor,
    '<meta-data android:name="expo.modules.updates.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY" android:value="{&quot;expo-channel-name&quot;:&quot;production&quot;}"/>\n    ' + anchor,
  );
}
fs.writeFileSync(m, x);

console.log('release signing: upload.jks | OTA channel: production');
