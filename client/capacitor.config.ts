import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.synoptik.genai',
  appName: 'GenAI',
  webDir: 'build',
  server: {
    url: 'https://www.genai.cl',
    cleartext: true
  }
};

export default config;
