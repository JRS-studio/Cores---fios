// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // supabase/functions roda no Deno (servidor do Supabase), com outro conjunto de tipos.
    ignores: ['dist/*', 'supabase/functions/*'],
  },
]);
