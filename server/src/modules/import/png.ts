import { deflateSync, inflateSync } from 'node:zlib';

/**
 * Минимальный PNG-кодек для спрайт-листа прайса.
 *
 * Импорт получает icons.png (RGBA, 8 бит, без интерлейса) и режет его на
 * отдельные 32×32 иконки. Полноценная библиотека здесь не нужна, а нативная
 * зависимость (sharp) усложнила бы установку на Windows.
 */
export interface DecodedPng {
  width: number;
  height: number;
  /** RGBA, 4 байта на пиксель, построчно сверху вниз. */
  data: Buffer;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function crc32(input: Buffer): number {
  let crc = 0xffffffff;

  for (const byte of input) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

export function decodePng(buffer: Buffer): DecodedPng {
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('Файл не является PNG');
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat: Buffer[] = [];

  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('latin1');
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8]!;
      colorType = data[9]!;
      interlace = data[12]!;
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }

  if (bitDepth !== 8 || colorType !== 6 || interlace !== 0) {
    throw new Error('Поддерживается только PNG RGBA 8 бит без интерлейса');
  }

  if (!width || !height || idat.length === 0) {
    throw new Error('В PNG нет данных изображения');
  }

  const stride = width * 4;
  const raw = inflateSync(Buffer.concat(idat));
  const data = Buffer.alloc(stride * height);

  for (let row = 0; row < height; row += 1) {
    const filter = raw[row * (stride + 1)]!;
    const source = raw.subarray(row * (stride + 1) + 1, (row + 1) * (stride + 1));
    const target = data.subarray(row * stride, (row + 1) * stride);
    const previous = row > 0 ? data.subarray((row - 1) * stride, row * stride) : null;

    for (let x = 0; x < stride; x += 1) {
      const value = source[x]!;
      const left = x >= 4 ? target[x - 4]! : 0;
      const up = previous ? previous[x]! : 0;
      const upLeft = previous && x >= 4 ? previous[x - 4]! : 0;

      switch (filter) {
        case 0:
          target[x] = value;
          break;
        case 1:
          target[x] = (value + left) & 0xff;
          break;
        case 2:
          target[x] = (value + up) & 0xff;
          break;
        case 3:
          target[x] = (value + ((left + up) >> 1)) & 0xff;
          break;
        case 4: {
          const p = left + up - upLeft;
          const pa = Math.abs(p - left);
          const pb = Math.abs(p - up);
          const pc = Math.abs(p - upLeft);
          const predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
          target[x] = (value + predictor) & 0xff;
          break;
        }
        default:
          throw new Error(`Неизвестный PNG-фильтр ${filter}`);
      }
    }
  }

  return { width, height, data };
}

function chunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, 'latin1');
  const body = Buffer.concat([typeBuffer, data]);
  const result = Buffer.alloc(body.length + 8);
  result.writeUInt32BE(data.length, 0);
  body.copy(result, 4);
  result.writeUInt32BE(crc32(body), body.length + 4);
  return result;
}

export function encodePng(width: number, height: number, data: Buffer): Buffer {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);

  for (let row = 0; row < height; row += 1) {
    raw[row * (stride + 1)] = 0;
    data.copy(raw, row * (stride + 1) + 1, row * stride, (row + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Вырезает прямоугольник из уже декодированного PNG и кодирует его заново. */
export function cropPng(source: DecodedPng, x: number, y: number, width: number, height: number): Buffer {
  const target = Buffer.alloc(width * height * 4);

  for (let row = 0; row < height; row += 1) {
    const start = ((y + row) * source.width + x) * 4;
    source.data.copy(target, row * width * 4, start, start + width * 4);
  }

  return encodePng(width, height, target);
}
