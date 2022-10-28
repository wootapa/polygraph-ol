module.exports = {
    roots: [
        "."
    ],
    testMatch: [
        "**/test/**/*.ts",
    ],
    transform: {
        "^.+\\.ts$": "ts-jest"
    },
    transformIgnorePatterns: [
        'node_modules/(?!(ol)/)'
    ],
    preset: 'ts-jest/presets/js-with-ts-esm',
}