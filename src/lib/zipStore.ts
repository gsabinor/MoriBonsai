/** ZIP padrão sem compactação. Fotos já estão em WebP. Sem dependências externas. */
const encoder = new TextEncoder();
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[n] = c >>> 0;
}
function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function dosTime(date: Date) {
  const year = Math.max(1980, Math.min(date.getFullYear(), 2107));
  const day = (year - 1980) << 9 | (date.getMonth() + 1) << 5 | date.getDate();
  const time = date.getHours() << 11 | date.getMinutes() << 5 | (date.getSeconds() >> 1);
  return { day, time };
}

type ZipEntry = { filename: Uint8Array; body: Uint8Array; crc: number; offset: number; time: number; day: number };
/** Gera um ZIP32 para backups pequenos e médios, sem dependências de npm. */
export class ZipStore {
  private files: ZipEntry[] = [];
  private offset = 0;
  private parts: BlobPart[] = [];
  addText(path: string, content: string) { this.addBytes(path, encoder.encode(content)); }
  addBytes(path: string, content: Uint8Array) {
    if (!path || path.startsWith('/') || path.split('/').some(p=>!p || p==='.' || p==='..' || p.includes('\\'))) throw new Error('Nome de arquivo inválido no backup.');
    const filename = encoder.encode(path);
    if (filename.byteLength > 65535 || this.files.length >= 65535 || content.byteLength > 0xffffffff) throw new Error('Limite de formato ZIP excedido.');
    const crc = crc32(content);
    const {day,time} = dosTime(new Date());
    const header = new Uint8Array(30+filename.length); const dv = new DataView(header.buffer);
    dv.setUint32(0,0x04034b50,true); dv.setUint16(4,20,true); dv.setUint16(6,0x0800,true);
    dv.setUint16(8,0,true); dv.setUint16(10,time,true); dv.setUint16(12,day,true);
    dv.setUint32(14,crc,true); dv.setUint32(18,content.length,true); dv.setUint32(22,content.length,true);
    dv.setUint16(26,filename.length,true); header.set(filename,30);
    if (this.offset + header.length + content.length > 0xffffffff) throw new Error('Backup grande demais para ZIP32.');
    this.parts.push(header as BlobPart, content as BlobPart);
    this.files.push({ filename, body:content,crc,offset:this.offset,time,day });
    this.offset += header.length + content.length;
  }
  finish(): Blob {
    let centerSize=0;
    for (const f of this.files) {
      const central = new Uint8Array(46+f.filename.length), dv = new DataView(central.buffer);
      dv.setUint32(0,0x02014b50,true); dv.setUint16(4,20,true); dv.setUint16(6,20,true);
      dv.setUint16(8,0x0800,true); dv.setUint16(10,0,true);
      dv.setUint16(12,f.time,true); dv.setUint16(14,f.day,true);
      dv.setUint32(16,f.crc,true); dv.setUint32(20,f.body.length,true); dv.setUint32(24,f.body.length,true);
      dv.setUint16(28,f.filename.length,true); dv.setUint32(42,f.offset,true);
      central.set(f.filename,46);
      centerSize += central.length; this.parts.push(central as BlobPart);
    }
    const footer=new Uint8Array(22), dv=new DataView(footer.buffer);
    dv.setUint32(0,0x06054b50,true); dv.setUint16(8,this.files.length,true);
    dv.setUint16(10,this.files.length,true); dv.setUint32(12,centerSize,true);
    dv.setUint32(16,this.offset,true);
    this.parts.push(footer as BlobPart);
    return new Blob(this.parts,{type:'application/zip'});
  }
}
