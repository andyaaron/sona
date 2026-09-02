# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Lint

`pnpm --filter mobile lint` runs `expo lint` with the committed flat `eslint.config.js` (`eslint-config-expo/flat`, ESLint 9 — `eslint-plugin-react` 7.x does not support ESLint 10 yet). Both packages are declared devDependencies; never let `expo lint` auto-install them.
