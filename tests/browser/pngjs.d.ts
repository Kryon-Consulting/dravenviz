declare module 'pngjs' {
  interface Image {
    width: number;
    height: number;
    data: Buffer;
  }
  export const PNG: {
    sync: { read(buffer: Buffer): Image; write(image: Image): Buffer };
  };
}
