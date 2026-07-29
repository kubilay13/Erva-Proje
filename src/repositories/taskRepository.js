const { randomUUID } = require('crypto');

function createTaskRepository() {
  const tasks = new Map();

  function clone(task) {
    return task ? { ...task, weather: task.weather ? { ...task.weather } : null } : null;
  }

  function create(taskData) {
    const now = new Date().toISOString();
    const task = {
      id: randomUUID(),
      title: taskData.title,
      description: taskData.description || '',
      priority: taskData.priority,
      city: taskData.city,
      weather: taskData.weather || null,
      status: 'pending',
      completedAt: null,
      createdAt: now,
      updatedAt: now
    };

    tasks.set(task.id, task);
    return clone(task);
  }

  function findAll(filters = {}) {
    return Array.from(tasks.values())
      .filter((task) => !filters.status || task.status === filters.status)
      .filter((task) => !filters.priority || task.priority === filters.priority)
      .map(clone);
  }

  function findById(id) {
    return clone(tasks.get(id));
  }

  function update(id, changes) {
    const current = tasks.get(id);

    if (!current) {
      return null;
    }

    const updated = {
      ...current,
      ...changes,
      updatedAt: new Date().toISOString()
    };

    tasks.set(id, updated);
    return clone(updated);
  }

  function deleteById(id) {
    return tasks.delete(id);
  }

  function clear() {
    tasks.clear();
  }

  return {
    create,
    findAll,
    findById,
    update,
    deleteById,
    clear
  };
}

module.exports = createTaskRepository;
