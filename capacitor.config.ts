import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.musicplayer.app',
  appName: 'Music Player',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0a0a1a',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a0a1a',
    },
    CapacitorHttp: {
      enabled: true,
    },
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#0a0a1a',
    // Enable immersive mode for edge-to-edge experience
    useLegacyBridge: false,
  },
};

export default config;
