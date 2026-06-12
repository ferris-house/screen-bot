// src/main/utils/dataURL.ts

export function dataURLToPNGBuffer(dataURL: string): Buffer {
  const parts = dataURL.split(',')
  return Buffer.from(parts[1], 'base64')
}