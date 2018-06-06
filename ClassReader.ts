import { ClassFile, ConstantPoolInfo, MemberInfo, AttributeInfo } from './Class';

export class ClassReader {
    private reader: BufferReader
    constructor(buffer: Buffer) {
        this.reader = new BufferReader(buffer)
    }

    public read(): ClassFile {
        var magic: number = this.reader.readU4()
        if (magic != 0xCAFEBABE) {
            throw new Error("magic fail")
        }

        var classFile: ClassFile = new ClassFile()
        classFile.minor_version = this.reader.readU2()
        classFile.major_version = this.reader.readU2()
        classFile.constant_pool_count = this.reader.readU2()
        this.readConstantPool(classFile)
        classFile.access_flags = this.parseAccessFlags(this.reader.readU2())
        classFile.this_class = this.reader.readU2()
        classFile.super_class = this.reader.readU2()
        classFile.interfaces_count = this.reader.readU2()
        classFile.interfaces = new Array<number>(classFile.interfaces_count)
        for (var i = 0; i < classFile.interfaces_count; i++) {
            classFile.interfaces[i] = this.reader.readU2()
        }
        classFile.fields_count = this.reader.readU2()
        classFile.fields = this.readMembers(classFile.fields_count)
        classFile.methods_count = this.reader.readU2()
        classFile.method_info = this.readMembers(classFile.methods_count)
        classFile.attributes_count = this.reader.readU2()
        classFile.attributes = this.readAttributes(classFile.attributes_count);
        return classFile
    }

    private readMembers(count: number): MemberInfo[] {
        var array: Array<MemberInfo> = new Array<MemberInfo>(count)
        for (var i = 0; i < count; i++) {
            array[i] = new MemberInfo()
            array[i].access_flags = this.reader.readU2()
            array[i].name_index = this.reader.readU2()
            array[i].descriptor_index = this.reader.readU2()
            array[i].attributes_count = this.reader.readU2()
            array[i].attributes = this.readAttributes(array[i].attributes_count)
        }
        return array
    }

    private readAttributes(count: number): AttributeInfo[] {
        var array: Array<AttributeInfo> = new Array<AttributeInfo>(count)
        for (var i = 0; i < count; i++) {
            array[i] = new AttributeInfo()
            array[i].attribute_name_index = this.reader.readU2()
            array[i].attribute_length = this.reader.readU4()
            array[i].info = this.reader.read(array[i].attribute_length)
        }
        return array
    }

    private readConstantPool(classFile: ClassFile): void {
        classFile.constant_pool = new Array<ConstantPoolInfo>(classFile.constant_pool_count)
        for (var i = 1; i < classFile.constant_pool_count; i++) {
            classFile.constant_pool[i] = new ConstantPoolInfo()
            var cp: ConstantPoolInfo = classFile.constant_pool[i]
            cp.tag = this.reader.readU1()
            switch (cp.tag) {
                case 1:
                    cp.utf_val = this.readConstantUTF()
                    break

                case 3:
                    cp.int_val = this.reader.readU4()
                    break

                case 4:
                    cp.float_val = this.reader.readF4()
                    break

                case 5:
                    cp.long_val = this.reader.readU8()
                    i++
                    break

                case 6:
                    cp.double_val = this.reader.readF8()
                    i++
                    break

                case 7:
                    cp.name_index = this.reader.readU2()
                    break

                case 8:
                    cp.string_index = this.reader.readU2()
                    break

                case 9: // field ref
                case 10: // method ref
                case 11: // interface method ref
                    cp.class_index = this.reader.readU2()
                    cp.name_and_type_index = this.reader.readU2()
                    break

                case 12: // name and type
                    cp.name_index = this.reader.readU2()
                    cp.descriptor_index = this.reader.readU2()
                    break

                case 15: // method handle
                    cp.reference_kind = this.reader.readU1()
                    cp.reference_index = this.reader.readU2()
                    break

                case 16: // method type
                    cp.descriptor_index = this.reader.readU2()
                    break

                case 18: // invoke dynamic
                    cp.bootstrap_method_attr_index = this.reader.readU2()
                    cp.name_and_type_index = this.reader.readU2()
                    break

                default:
                    throw new Error("invalid constantpool tag")
            }
        }
    }
    
    private readConstantUTF(): string {
        var length: number = this.reader.readU2()
        var buffer: Buffer = this.reader.read(length)
        return buffer.toString("utf-8")
    }

    private parseAccessFlags(flags: number): object {
        return {
            acc_public: ((flags & 0x0001) != 0),
            acc_final: ((flags & 0x0010) != 0),
            acc_super: ((flags & 0x0020) != 0),
            acc_interface: ((flags & 0x0200) != 0),
            acc_abstract: ((flags & 0x0400) != 0),
            acc_synthetic: ((flags & 0x1000) != 0),
            acc_annotation: ((flags & 0x2000) != 0),
            acc_enum: ((flags & 0x4000) != 0)
        }
    }
}

class BufferReader {
    private buffer: Buffer
    private offset: number = 0

    constructor(buffer: Buffer) {
        this.buffer = buffer
    }

    public read(length: number): Buffer {
        var buf: Buffer = this.buffer.slice(this.offset, this.offset + length)
        this.offset += length
        return buf
    }

    public readU1(): number {
        var val = this.buffer.readUInt8(this.offset)
        this.offset += 1
        return val
    }

    public readU2(): number {
        var val = this.buffer.readUInt16BE(this.offset)
        this.offset += 2
        return val
    }

    public readU4(): number {
        var val = this.buffer.readUInt32BE(this.offset)
        this.offset += 4
        return val
    }

    public readF4(): number {
        var val = this.buffer.readFloatBE(this.offset)
        this.offset += 4
        return val
    }
    
    public readU8(): number {
        var val1 = this.buffer.readUInt32BE(this.offset)
        var val2 = this.buffer.readUInt32BE(this.offset + 4)
        this.offset += 8
        return val1 << 32 | val2
    }

    public readF8(): number {
        var val = this.buffer.readDoubleBE(this.offset)
        this.offset += 8
        return val
    }

    public readS1(): number {
        var val = this.buffer.readInt8(this.offset)
        this.offset += 1
        return val
    }

    public readS2(): number {
        var val = this.buffer.readInt16BE(this.offset)
        this.offset += 2
        return val
    }

    public readS4(): number {
        var val = this.buffer.readInt32BE(this.offset)
        this.offset += 4
        return val
    }
    
    public readS8(): number {
        var val1 = this.buffer.readInt32BE(this.offset)
        var val2 = this.buffer.readUInt32BE(this.offset + 4)
        this.offset += 8
        return val1 << 32 | val2
    }
}
