var express = require('express');
var logger = require('morgan');

var config = require('./src/config');
var createTaskController = require('./src/controllers/taskController');
var errorHandler = require('./src/middlewares/errorHandler');
var notFoundHandler = require('./src/middlewares/notFoundHandler');
var createNotificationService = require('./src/services/notificationService');
var createTaskRepository = require('./src/repositories/taskRepository');
var createTaskRoutes = require('./src/routes/taskRoutes');
var createTaskService = require('./src/services/taskService');
var createWeatherService = require('./src/services/weatherService');

function createApp(dependencies) {
  var app = express();
  var taskRepository =
    dependencies && dependencies.taskRepository
      ? dependencies.taskRepository
      : createTaskRepository();
  var weatherService =
    dependencies && dependencies.weatherService
      ? dependencies.weatherService
      : createWeatherService({
          geocodingUrl: config.openMeteo.geocodingUrl,
          forecastUrl: config.openMeteo.forecastUrl,
          timeoutMs: config.weatherTimeoutMs
        });
  var notificationService =
    dependencies && dependencies.notificationService
      ? dependencies.notificationService
      : createNotificationService();
  var taskService = createTaskService({
    taskRepository: taskRepository,
    weatherService: weatherService,
    notificationService: notificationService
  });
  var taskController = createTaskController(taskService);

  app.use(logger('dev'));
  app.use(express.json());

  app.get('/health', function healthCheck(req, res) {
    res.json({ status: 'ok', service: 'TaskFlow' });
  });

  app.use('/api/v1/tasks', createTaskRoutes(taskController));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

var app = createApp();

module.exports = app;
module.exports.createApp = createApp;
