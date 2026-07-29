function createTaskController(taskService) {
  async function createTask(req, res) {
    const task = await taskService.createTask(req.body);
    res.status(201).json({ data: task });
  }

  function listTasks(req, res) {
    const result = taskService.listTasks(req.query);
    res.json({
      data: result.items,
      pagination: result.pagination
    });
  }

  function getTask(req, res) {
    const task = taskService.getTask(req.params.id);
    res.json({ data: task });
  }

  async function updateTask(req, res) {
    const task = await taskService.updateTask(req.params.id, req.body);
    res.json({ data: task });
  }

  async function completeTask(req, res) {
    const task = await taskService.completeTask(req.params.id);
    res.json({ data: task });
  }

  function deleteTask(req, res) {
    taskService.deleteTask(req.params.id);
    res.status(204).send();
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

module.exports = createTaskController;
