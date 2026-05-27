declare module "yazl" {
  import type { Buffer } from "node:buffer";
  import type { EventEmitter } from "node:events";

  export interface Options {
    mtime: Date;
    mode: number;
    compress: boolean;
    forceZip64Format: boolean;
    forceDosTimestamp: boolean;
    compressionLevel: number;
  }

  export interface FileOptions extends Options {
    fileComment: string;
  }

  export interface ReadStreamOptions extends FileOptions {
    size: number;
  }

  export interface DirectoryOptions {
    mtime: Date;
    mode: number;
    forceDosTimestamp: boolean;
  }

  export interface EndOptions {
    forceZip64Format: boolean;
    comment: string;
  }

  export class ZipFile extends EventEmitter {
    outputStream: NodeJS.ReadableStream;

    addFile(realPath: string, metadataPath: string, options?: Partial<FileOptions>): void;
    addReadStream(input: NodeJS.ReadableStream, metadataPath: string, options?: Partial<ReadStreamOptions>): void;
    addReadStreamLazy(
      metadataPath: string,
      getReadStreamFunction: (callback: (error: unknown, readStream: NodeJS.ReadableStream) => void) => void
    ): void;
    addReadStreamLazy(
      metadataPath: string,
      options: Partial<ReadStreamOptions>,
      getReadStreamFunction: (callback: (error: unknown, readStream: NodeJS.ReadableStream) => void) => void
    ): void;
    addBuffer(buffer: Buffer, metadataPath: string, options?: Partial<Options>): void;
    addEmptyDirectory(metadataPath: string, options?: Partial<DirectoryOptions>): void;
    end(options?: EndOptions, calculatedTotalSizeCallback?: () => void): void;
  }
}
