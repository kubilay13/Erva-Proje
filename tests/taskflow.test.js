const http = require('http');
const assert = require('assert/strict');
const test = require('node:test');

const { createApp } = require('../app');
const createTaskRepository = require('../src/repositories/taskRepository');
const createNotificationService = require('../src/services/notificationService');

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

test('returns a consistent 400 error for validation failures', async () => {
  const server = await createTestServer();

  try {
    const response = await requestJson(server.baseUrl, '/api/v1/tasks', {
      method: 'POST',
      body: JSON.stringify({
        description: 'Missing title',
        priority: 'medium',
        city: 'Ankara'
      })
    });

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'title is required.'
      }
    });
  } finally {
    await server.close();
  }
});

test('returns a consistent 404 error for unknown tasks', async () => {
  const server = await createTestServer();

  try {
    const response = await requestJson(
      server.baseUrl,
      '/api/v1/tasks/not-existing-id'
    );

    assert.equal(response.status, 404);
    assert.deepEqual(response.body, {
      error: {
        code: 'TASK_NOT_FOUND',
        message: 'Task not found.'
      }
    });
  } finally {
    await server.close();
  }
});

test('returns a consistent 500 error for unexpected failures', async () => {
  const originalConsoleError = console.error;
  const app = createApp({
    taskRepository: {
      findById: () => {
        throw new Error('Repository exploded');
      }
    },
    weatherService: {
      getWeatherForCity: async () => null
    },
    notificationService: {
      notifyTaskCompleted: async () => undefined
    }
  });
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(0, resolve));
  console.error = () => undefined;

  try {
    const address = server.address();
    const response = await requestJson(
      `http://127.0.0.1:${address.port}`,
      '/api/v1/tasks/any-id'
    );

    assert.equal(response.status, 500);
    assert.deepEqual(response.body, {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Unexpected error occurred.'
      }
    });
  } finally {
    console.error = originalConsoleError;
    await new Promise((resolve) => server.close(resolve));
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

test('notification service sends completed task to every channel', async () => {
  const sentChannels = [];
  const notificationService = createNotificationService([
    {
      send: async (task) => sentChannels.push(`log:${task.id}`)
    },
    {
      send: async (task) => sentChannels.push(`email:${task.id}`)
    }
  ]);

  await notificationService.notifyTaskCompleted({ id: 'task-1' });

  assert.deepEqual(sentChannels, ['log:task-1', 'email:task-1']);
});

test('lists, gets, updates, and deletes a task', async () => {
  const server = await createTestServer();

  try {
    const created = await requestJson(server.baseUrl, '/api/v1/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: 'CRUD smoke test',
        description: 'Check all task endpoints',
        priority: 'low',
        city: 'Istanbul'
      })
    });
    const taskId = created.body.data.id;

    const list = await requestJson(
      server.baseUrl,
      '/api/v1/tasks?status=pending&priority=low&page=1&limit=10'
    );
    const single = await requestJson(server.baseUrl, `/api/v1/tasks/${taskId}`);
    const updated = await requestJson(server.baseUrl, `/api/v1/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        priority: 'high',
        description: 'Updated description'
      })
    });
    const deleted = await fetch(`${server.baseUrl}/api/v1/tasks/${taskId}`, {
      method: 'DELETE'
    });
    const missing = await requestJson(server.baseUrl, `/api/v1/tasks/${taskId}`);

    assert.equal(list.status, 200);
    assert.equal(list.body.data.length, 1);
    assert.equal(single.status, 200);
    assert.equal(single.body.data.id, taskId);
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.priority, 'high');
    assert.equal(updated.body.data.description, 'Updated description');
    assert.equal(deleted.status, 204);
    assert.equal(missing.status, 404);
    assert.equal(missing.body.error.code, 'TASK_NOT_FOUND');
  } finally {
    await server.close();
  }
});
