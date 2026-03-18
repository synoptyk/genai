const request = require('supertest');
const { app } = require('../server');

describe('API Health Checks', () => {
  test('GET /api/ping-genai returns 200 with version text', async () => {
    const response = await request(app).get('/api/ping-genai');
    expect(response.statusCode).toBe(200);
    expect(response.text).toMatch(/GenAI Server v2\.5/);
  });
});
