/** Pilot workflow errors that stop before publishing. */
export class PiercingConnectPilotError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'PiercingConnectPilotError';
    this.code = code;
  }
}
