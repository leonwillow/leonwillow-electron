export default defineNuxtConfig({
  compatibilityDate: '2026-09-26',
  ssr: false,
  devtools: { enabled: false },
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  ui: { fonts: false },
  runtimeConfig: {
    public: {
      apiBaseUrl: 'http://127.0.0.1:3001',
    },
  },
  typescript: {
    strict: true,
  },
});
