// Config de PM2 para el VPS. Solo la lee `pm2 start ecosystem.config.cjs`
// dentro de ~/dakota-web; no se importa en runtime.
//
// El puerto 4330 porque en ese servidor el 4321 (el de Astro por defecto) ya
// está ocupado por otra cosa. Escucha solo en loopback: quien expone el sitio
// es Nginx, que además termina el TLS.
//
// --env-file lo lee Node 20.6+: PM2 no carga .env por su cuenta, y el servidor
// necesita las credenciales de Firebase en process.env para hablar con
// Firestore.
module.exports = {
  apps: [
    {
      name: "dakota",
      script: "./dist/server/entry.mjs",
      node_args: "--env-file=.env",
      cwd: "/home/ubuntu/dakota-web",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "400M",
      min_uptime: "20s",
      max_restarts: 10,
      env: {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: "4330",
      },
    },
  ],
};
