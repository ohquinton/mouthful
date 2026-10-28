// Sentry's Metro config adds Debug IDs so crash reports map back to source. Otherwise Expo's defaults.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);
