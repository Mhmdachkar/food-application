export class File {
  uri: string;
  constructor(uri: string) {
    this.uri = uri;
  }
  async arrayBuffer(): Promise<ArrayBuffer> {
    return new ArrayBuffer(0);
  }
}
