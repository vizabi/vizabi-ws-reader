export class WSReader {

  constructor() {

  }

  getReader() {

    return {

      init() {
        this._data = [];
      },

      read() {
        // p - Promise
        let p;
        return p;
      },

      getData() {
        return this._data;
      }

    };

  }
}
