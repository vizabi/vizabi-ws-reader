export const WS_RESPONSE_ERROR = 'WS response error';
export const NETWORK_ERROR = 'Network error';
export const WS_BAD_RESPONSE = 'WS bad response';
export const WS_ERROR = 'WS error';
export const WS_MESSAGE = 'WS message';

export class WsError extends Error {
  constructor(message, details) {
    super();
    this.name = 'WaffleServerError';
    this.message = message;
    this.details = details;
    this.endpoint = null;
    this.url = null;
    this.ddfql = null;
  }
}
