import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.cloudmusic",
  appName: "小云畅听",
  webDir: "dist",
  android: {
    allowMixedContent: true,
  },
  ios: {
    contentInset: "always",
  },
  server: {
    androidScheme: "https",
  },
};

export default config;
