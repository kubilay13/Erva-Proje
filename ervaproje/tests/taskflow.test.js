const http = require('http');
const assert = require('assert/strict');
const test = require('node:test');

const { createApp } = require('../app');
const createTaskRepository = require('../src/repositories/taskRepository');

function createTestServer(overrides = {}) {
  const taskRepository = createTaskRepository();
  const app = createApp({
    taskRepository,
    weatherService: overrides.weatherService || {
      getWeatherForCity: async () => ({
        temperature: 18.5,
        unit: '°C',
        city: 'Istanbul',
        country: 'Turkey',
        latitude: 41.0138,
        longitude: 28.9497,
        fetchedAt: '2026-07-29T00:00:00.000Z'
      })
    },
    notificationService: overrides.notificationService || {
      notifyTaskCompleted: async () => undefined
    }
  });
  const server = http.createServer(app);

  return new Promise((resolve) => {
    server.listen(0, () => {
      const address = server.address();

      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        taskRepository,
        close: () => new Promise((done) => server.close(done))
      });
    });
  });
}

async function requestJson(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await response.text();

  return {
    status: response.status,
    body: text ? JSON.parse(text) : null
  };
}

test('creates a task with weather null when weather service fails', async () => {
  const server = await createTestServer({
    weatherService: {
      getWeatherForCity: async () => {
        throw new Error('weather api unavailable');
      }
    }
  });

  try {
    const response = await requestJson(server.baseUrl, '/api/v1/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Prepare sprint board',
        description: 'Create initial TaskFlow tasks',
        priority: 'high',
        city: 'Istanbul'
      })
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.data.weather, null);
    assert.equal(response.body.data.status, 'pending');
  } finally {
    await server.close();
  }
});

test('returns a consistent 400 error for invalid priority', async () => {
  const server = await createTestServer();

  try {
    const response = await requestJson(server.baseUrl, '/api/v1/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Review backlog',
        priority: 'urgent',
        city: 'Ankara'
      })
    });

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, {
      error: {
        code: 'INVALID_PRIORITY',
        message: 'Priority must be one of: low, medium, high.'
      }
    });
  } finally {
    await server.close();
  }
});

test('completes a task and triggers notifications once', async () => {
  const notifications = [];
  const server = await createTestServer({
    notificationService: {
      notifyTaskCompleted: async (task) => {
        notifications.push(task.id);
      }
    }
  });

  try {
    const created = await requestJson(server.baseUrl, '/api/v1/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Ship API',
        description: 'Finish TaskFlow endpoints',
        priority: 'medium',
        city: 'Izmir'
      })
    });

    const taskId = created.body.data.id;
    const completed = await requestJson(
      server.baseUrl,
      `/api/v1/tasks/${taskId}/complete`,
      { method: 'PATCH' }
    );
    const completedAgain = await requestJson(
      server.baseUrl,
      `/api/v1/tasks/${taskId}/complete`,
      { method: 'PATCH' }
    );

    assert.equal(completed.status, 200);
    assert.equal(completed.body.data.status, 'completed');
    assert.equal(completedAgain.status, 200);
    assert.deepEqual(notifications, [taskId]);
  } finally {
    await server.close();
  }
});
