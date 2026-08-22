// Dynamic Expo config so Android Maps can read the API key from env at build time.
// Static values live in app.json; this file overrides New Arch + Google Maps settings.
const appJson = require('./app.json');

const googleMapsApiKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  process.env.GOOGLE_MAPS_API_KEY ||
  '';

module.exports = {
  expo: {
    ...appJson.expo,
    // react-native-maps is unstable with New Architecture inside modals on Expo SDK 54.
    newArchEnabled: false,
    plugins: [
      ...(appJson.expo.plugins || []),
      [
        '@react-native-community/datetimepicker',
        {
          android: {
            datePicker: {
              colorAccent: { light: '#0d9488', dark: '#14b8a6' },
              textColorPrimary: { light: '#0f172a', dark: '#ffffff' },
            },
            timePicker: {
              background: { light: '#f0fdfa', dark: '#134e4a' },
              headerBackground: { light: '#0d9488', dark: '#0f766e' },
              numbersBackgroundColor: { light: '#f0fdfa', dark: '#134e4a' },
              numbersSelectorColor: { light: '#0d9488', dark: '#14b8a6' },
              numbersTextColor: { light: '#0f172a', dark: '#ffffff' },
            },
          },
        },
      ],
      // ADD THIS NEW BLOCK RIGHT HERE:
      [
        "expo-notifications",
        {
          icon: "./assets/images/icon.png", 
          color: "#0d9488"
        }
      ]
    ],
    android: {
      ...appJson.expo.android,
      config: {
        ...(appJson.expo.android?.config || {}),
        googleMaps: {
          apiKey: googleMapsApiKey,
        },
      },
    },
  },
};
