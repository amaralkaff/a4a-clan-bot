module.exports = {
  apps: [{
    name: 'a4a-clan-bot',
    script: 'dist/index.js',
    watch: false,
    env: {
      NODE_ENV: 'production',
    },
    exp_backoff_restart_delay: 100,
    max_restarts: 10,
  }]
} 