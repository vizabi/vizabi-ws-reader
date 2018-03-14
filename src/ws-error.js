export const NETWORK_RESPONSE_ERROR = 'Network response error';
export const UNEXPECTED_ERROR = 'Unexpected error';
export const WS_BAD_RESPONSE = 'WS bad response';
export const WS_ERROR = 'WS error';
export const WS_MESSAGE = 'WS message';

export class WsError {
  constructor(type, details) {
    this.type = type;
    this.details = details;
  }

  valueOf() {
    const offset = 2;

    return `${this.type}: ${JSON.stringify(this.details, null, offset)}`;
  }
}
