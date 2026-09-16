require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { notFound } = require('./lib/errors');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Catch-all for unmatched routes — keeps the same error shape as everything else.
app.use((req, res, next) => {
  next(notFound(`No route for ${req.method} ${req.path}`));
});

app.use(errorHandler);

// Local dev only — Vercel imports `app` directly and handles the listening.
if (require.main === module) {
  const port = process.env.PORT || 3001;
  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
}

module.exports = app;
