import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';

export interface MailpitMessage {
  readonly ID: string;
  readonly To: ReadonlyArray<{ Address: string }>;
  readonly Subject: string;
  readonly Created: string;
}

/** Mailpit container for invitation / password reset emails in integration tests (research R10). */
export class TestMailpit {
  private constructor(private readonly container: StartedTestContainer) {}

  static async start(): Promise<TestMailpit> {
    const container = await new GenericContainer('axllent/mailpit')
      .withExposedPorts(1025, 8025)
      .withWaitStrategy(Wait.forHttp('/api/v1/messages', 8025))
      .start();
    return new TestMailpit(container);
  }

  get smtpUrl(): string {
    return `smtp://${this.container.getHost()}:${this.container.getMappedPort(1025)}`;
  }

  private get apiBase(): string {
    return `http://${this.container.getHost()}:${this.container.getMappedPort(8025)}/api/v1`;
  }

  async messagesTo(address: string): Promise<MailpitMessage[]> {
    const response = await fetch(`${this.apiBase}/search?query=${encodeURIComponent(`to:${address}`)}`);
    const body = (await response.json()) as { messages: MailpitMessage[] };
    return body.messages;
  }

  async text(id: string): Promise<string> {
    const response = await fetch(`${this.apiBase}/message/${id}`);
    const body = (await response.json()) as { Text: string };
    return body.Text;
  }

  async stop(): Promise<void> {
    await this.container.stop();
  }
}
