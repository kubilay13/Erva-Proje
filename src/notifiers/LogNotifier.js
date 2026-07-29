class LogNotifier {
  async send(task) {
    console.log(`[LogNotifier] Task completed: ${task.id} - ${task.title}`);
  }
}

module.exports = LogNotifier;
