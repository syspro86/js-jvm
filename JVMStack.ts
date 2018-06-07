
export class JVMStack {
    private buffer: Buffer
    private offset: number = 0
    private offsetStack: number[] = []

    constructor(size_or_buffer: number | Buffer) {
        if (size_or_buffer instanceof Buffer) {
            this.buffer = size_or_buffer
        } else {
            this.buffer = Buffer.alloc(size_or_buffer, 0)
        }
    }

    public position(): number {
        return this.offset
    }

    public writeInt(val: number, index?: number): void {
        if (typeof index === 'undefined') {
            this.buffer.writeInt32BE(val, this.offset)
            this.offset += 4
        } else {
            this.buffer.writeInt32BE(val, index * 4)
        }
    }

    public writeLong(val: number, index?: number): void {
        if (typeof index === 'undefined') {
            this.buffer.writeUInt32BE(val >> 32, this.offset)
            this.offset += 4
            this.buffer.writeUInt32BE(val & 0xffffffff, this.offset)
            this.offset += 4
        } else {
            this.buffer.writeInt32BE(val >> 32, index * 4)
            this.buffer.writeUInt32BE(val & 0xffffffff, index * 4 + 4)
        }
    }

    public writeFloat(val: number, index?: number): void {
        if (typeof index === 'undefined') {
            this.buffer.writeFloatBE(val, this.offset)
            this.offset += 4
        } else {
            this.buffer.writeFloatBE(val, index * 4)
        }
    }

    public writeDouble(val: number, index?: number): void {
        if (typeof index === 'undefined') {
            this.buffer.writeDoubleBE(val, this.offset)
            this.offset += 8
        } else {
            this.buffer.writeDoubleBE(val, index)
        }
    }

    public readInt(index?: number): number {
        if (typeof index === 'undefined') {
            var val = this.buffer.readInt32BE(this.offset - 4)
            this.offset -= 4
            return val
        } else {
            return this.buffer.readInt32BE(index * 4)
        }
    }

    public readLong(index?: number): number {
        if (typeof index === 'undefined') {
            var val1 = this.buffer.readInt32BE(this.offset - 8)
            var val2 = this.buffer.readUInt32BE(this.offset - 4)
            this.offset -= 8
            return (val1 << 32) | val2
        } else {
            var val1 = this.buffer.readInt32BE(index * 4)
            var val2 = this.buffer.readUInt32BE(index * 4 + 4)
            return (val1 << 32) | val2
        }
    }

    public readFloat(index?: number): number {
        if (typeof index === 'undefined') {
            var val = this.buffer.readFloatBE(this.offset - 4)
            this.offset -= 4
            return val
        } else {
            return this.buffer.readFloatBE(index * 4)
        }
    }

    public readDouble(index?: number): number {
        if (typeof index === 'undefined') {
            var val = this.buffer.readDoubleBE(this.offset - 8)
            this.offset -= 8
            return val
        } else {
            return this.buffer.readDoubleBE(index * 4)
        }
    }
}
