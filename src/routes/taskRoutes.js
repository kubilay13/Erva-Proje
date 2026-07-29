const express = require('express');
const asyncHandler = require('../utils/asyncHandler');

function createTaskRoutes(taskController) {
  const router = express.Router();

  router.post('/', asyncHandler(taskController.createTask));
  router.get('/', taskController.listTasks);
  router.get('/:id', taskController.getTask);
  router.patch('/:id', asyncHandler(taskController.updateTask));
  router.patch('/:id/complete', asyncHandler(taskController.completeTask));
  router.delete('/:id', taskController.deleteTask);

  return router;
}

module.exports = createTaskRoutes;
