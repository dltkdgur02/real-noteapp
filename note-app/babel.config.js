module.exports = function (api) {
    api.cache(true);
    return {
        presets: ['babel-preset-expo'],
        plugins: [
            'react-native-worklets/plugin', // ← 새 버전에서 권장
        ],
    };
};
