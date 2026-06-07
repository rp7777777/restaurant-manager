import { auth } from "../../firebase";

class SessionManager {
  private lastActivity: number = Date.now();

  private timeoutMinutes: number = 60;

  updateActivity() {
    this.lastActivity = Date.now();
  }

  getLastActivity() {
    return this.lastActivity;
  }

  getRemainingTime() {
    const timeoutMs =
      this.timeoutMinutes *
      60 *
      1000;

    const elapsed =
      Date.now() -
      this.lastActivity;

    return Math.max(
      timeoutMs - elapsed,
      0
    );
  }

  isSessionExpired() {
    const timeoutMs =
      this.timeoutMinutes *
      60 *
      1000;

    return (
      Date.now() -
        this.lastActivity >
      timeoutMs
    );
  }

  async logoutIfExpired() {
    if (
      this.isSessionExpired()
    ) {
      try {
        await auth.signOut();
      } catch (error) {
        console.log(
          "Auto logout error",
          error
        );
      }
    }
  }

  startAutoCheck() {
    setInterval(
      async () => {
        await this.logoutIfExpired();
      },
      60000
    );
  }
}

export const sessionManager =
  new SessionManager();