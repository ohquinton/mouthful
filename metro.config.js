// Sentry's Metro config adds Debug IDs so crash reports map back to source. Otherwise Expo's defaults.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);
if (!config.resolver.assetExts.includes('riv')) config.resolver.assetExts.push('riv');
module.exports = config;
