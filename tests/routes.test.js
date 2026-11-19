import request from 'supertest';
import app from '../app.js';
import { closePool } from '../src/config/database.js';

describe('Express API Route Tests', () => {
  afterAll(async () => {
    await closePool();
  });
  describe('GET /health', () => {
    test('should return 200 OK with server health info', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.message).toContain('Support Ticket AI');
    });
  });

  describe('Route 404 handler', () => {
    test('should return 404 for undefined routes', async () => {
      const res = await request(app).get('/api/non-existent-endpoint');
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('error');
      expect(res.body.message).toContain('not found');
    });
  });

  describe('POST /api/tickets - Input Validation', () => {
    test('should return 400 when required fields are missing', async () => {
      const res = await request(app)
        .post('/api/tickets')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(res.body.message).toBe('Validation failed');
      expect(Array.isArray(res.body.errors)).toBe(true);

      const fieldNames = res.body.errors.map((e) => e.field);
      expect(fieldNames).toContain('customerName');
      expect(fieldNames).toContain('customerEmail');
      expect(fieldNames).toContain('subject');
      expect(fieldNames).toContain('message');
    });

    test('should return 400 when email format is invalid', async () => {
      const res = await request(app)
        .post('/api/tickets')
        .send({
          customerName: 'Test User',
          customerEmail: 'not-a-valid-email',
          subject: 'Valid Subject',
          message: 'Valid message body that is long enough.',
        });

      expect(res.status).toBe(400);
      const emailError = res.body.errors.find((e) => e.field === 'customerEmail');
      expect(emailError).toBeDefined();
    });

    test('should return 400 when message is too short (under 10 chars)', async () => {
      const res = await request(app)
        .post('/api/tickets')
        .send({
          customerName: 'Test User',
          customerEmail: 'test@example.com',
          subject: 'Valid Subject',
          message: 'Too short',
        });

      expect(res.status).toBe(400);
      const msgError = res.body.errors.find((e) => e.field === 'message');
      expect(msgError).toBeDefined();
    });
  });
});
