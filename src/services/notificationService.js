const EmailNotifier = require('../notifiers/EmailNotifier');
const LogNotifier = require('../notifiers/LogNotifier');

function createNotificationService(notifiers = [new LogNotifier(), new EmailNotifier()]) {
  async function notifyTaskCompleted(task) {
    const results = await Promise.allSettled(
      notifiers.map((notifier) => notifier.send(task))
    );

    results
      .filter((result) => result.status === 'rejected')
      .forEach((result) => console.error('[NotificationService]', result.reason));
  }

  return {
    notifyTaskCompleted
  };
}

module.exports = createNotificationService;
