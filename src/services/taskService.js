const AppError = require('../errors/AppError');

const VALID_PRIORITIES = new Set(['low', 'medium', 'high']);
const VALID_STATUSES = new Set(['pending', 'completed']);
const UPDATABLE_FIELDS = new Set(['title', 'description', 'priority', 'city']);

function createTaskService({ taskRepository, weatherService, notificationService }) {
  function validatePriority(priority) {
    if (!VALID_PRIORITIES.has(priority)) {
      throw new AppError(
        400,
        'INVALID_PRIORITY',
        'Priority must be one of: low, medium, high.'
      );
    }
  }

  function requiredString(value, fieldName) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new AppError(400, 'VALIDATION_ERROR', `${fieldName} is required.`);
    }

    return value.trim();
  }

  async function safelyGetWeather(city) {
    try {
      return await weatherService.getWeatherForCity(city);
    } catch (error) {
      return null;
    }
  }

  async function createTask(input) {
    const title = requiredString(input.title, 'title');
    const city = requiredString(input.city, 'city');
    const priority = requiredString(input.priority, 'priority');
    validatePriority(priority);

    const weather = await safelyGetWeather(city);

    return taskRepository.create({
      title,
      description:
        typeof input.description === 'string' ? input.description.trim() : '',
      priority,
      city,
      weather
    });
  }

  function listTasks(filters = {}) {
    if (filters.priority) {
      validatePriority(filters.priority);
    }

    if (filters.status && !VALID_STATUSES.has(filters.status)) {
      throw new AppError(
        400,
        'INVALID_STATUS',
        'Status must be one of: pending, completed.'
      );
    }

    const page = Math.max(Number(filters.page) || 1, 1);
    const limit = Math.min(Math.max(Number(filters.limit) || 10, 1), 100);
    const allTasks = taskRepository.findAll({
      status: filters.status,
      priority: filters.priority
    });
    const start = (page - 1) * limit;
    const items = allTasks.slice(start, start + limit);

    return {
      items,
      pagination: {
        page,
        limit,
        total: allTasks.length,
        totalPages: Math.ceil(allTasks.length / limit)
      }
    };
  }

  function getTask(id) {
    const task = taskRepository.findById(id);

    if (!task) {
      throw new AppError(404, 'TASK_NOT_FOUND', 'Task not found.');
    }

    return task;
  }

  async function updateTask(id, input) {
    getTask(id);

    const changes = {};

    Object.entries(input).forEach(([key, value]) => {
      if (!UPDATABLE_FIELDS.has(key)) {
        return;
      }

      if (key === 'priority') {
        const priority = requiredString(value, 'priority');
        validatePriority(priority);
        changes.priority = priority;
        return;
      }

      if (key === 'title' || key === 'city') {
        changes[key] = requiredString(value, key);
        return;
      }

      if (key === 'description') {
        changes.description = typeof value === 'string' ? value.trim() : '';
      }
    });

    if (Object.keys(changes).length === 0) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'At least one updatable field is required.'
      );
    }

    if (changes.city) {
      changes.weather = await safelyGetWeather(changes.city);
    }

    return taskRepository.update(id, changes);
  }

  async function completeTask(id) {
    const task = getTask(id);

    if (task.status === 'completed') {
      return task;
    }

    const completedTask = taskRepository.update(id, {
      status: 'completed',
      completedAt: new Date().toISOString()
    });

    await notificationService.notifyTaskCompleted(completedTask);
    return completedTask;
  }

  function deleteTask(id) {
    getTask(id);
    taskRepository.deleteById(id);
  }

  return {
    createTask,
    listTasks,
    getTask,
    updateTask,
    completeTask,
    deleteTask
  };
}

module.exports = createTaskService;
