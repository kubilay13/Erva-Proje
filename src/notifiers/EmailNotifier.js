class EmailNotifier {
  async send(task) {
    console.log(`[EmailNotifier] Completion email sent for task: ${task.id}`);
  }
}

module.exports = EmailNotifier;
