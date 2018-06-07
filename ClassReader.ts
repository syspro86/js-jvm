import { ClassFile, ConstantPoolInfo, MemberInfo, AttributeInfo, CodeInfo, LineNumberTableInfo, InnerClassInfo, StackMapTableInfo } from './Class';

export class ClassReader {
    private reader: BufferReader
    private classFile: ClassFile = new ClassFile()
    constructor(buffer: Buffer) {
        this.reader = new BufferReader(buffer)
    }

    public read(): ClassFile {
        var magic: number = this.reader.readU4()
        if (magic != 0xCAFEBABE) {
            throw new Error("magic fail")
        }

        this.classFile.minor_version = this.reader.readU2()
        this.classFile.major_version = this.reader.readU2()
        this.readConstantPool()
        this.classFile.access_flags = this.parseAccessFlags(this.reader.readU2())
        this.classFile.this_class = this.reader.readU2()
        this.classFile.super_class = this.reader.readU2()
        this.classFile.interfaces_count = this.reader.readU2()
        this.classFile.interfaces = new Array<number>(this.classFile.interfaces_count)
        for (var i = 0; i < this.classFile.interfaces_count; i++) {
            this.classFile.interfaces[i] = this.reader.readU2()
        }
        var fields_count = this.reader.readU2()
        this.classFile.fields = this.readMembers(fields_count)
        var methods_count = this.reader.readU2()
        this.classFile.methods = this.readMembers(methods_count)
        var attributes_count = this.reader.readU2()
        this.classFile.attributes = this.readAttributes(this.reader, attributes_count);

        this.classFile.this_class_name = this.classFile.constant_pool[this.classFile.constant_pool[this.classFile.this_class].name_index].utf_val
        
        return this.classFile
    }

    private readMembers(count: number): MemberInfo[] {
        var array: Array<MemberInfo> = new Array<MemberInfo>(count)
        for (var i = 0; i < count; i++) {
            array[i] = new MemberInfo()
            array[i].access_flags = this.parseAccessFlags(this.reader.readU2())
            array[i].name_index = this.reader.readU2()
            array[i].name = this.classFile.constant_pool[array[i].name_index].utf_val
            array[i].descriptor_index = this.reader.readU2()
            array[i].descriptor = this.classFile.constant_pool[array[i].descriptor_index].utf_val
            var attributes_count = this.reader.readU2()
            array[i].attributes = this.readAttributes(this.reader, attributes_count)
        }
        return array
    }

    private readAttributes(reader: BufferReader, count: number): AttributeInfo[] {
        var array: Array<AttributeInfo> = new Array<AttributeInfo>(count)
        for (var i = 0; i < count; i++) {
            array[i] = new AttributeInfo()
            array[i].attribute_name_index = reader.readU2()
            array[i].attribute_name = this.classFile.constant_pool[array[i].attribute_name_index].utf_val
            var attribute_length = reader.readU4()
            var info: Buffer = reader.read(attribute_length)
            if (array[i].attribute_name == 'Code') {
                array[i].code_info = this.readCodeAttribute(info)
            } else if (array[i].attribute_name == 'LineNumberTable') {
                array[i].line_number_table_info = this.readLineNumberTableAttribute(info)
            } else if (array[i].attribute_name == 'StackMapTable') {
                array[i].stack_map_table_info = this.readStackMapTableAttribute(info)
            } else if (array[i].attribute_name == 'SourceFile') {
                var reader2: BufferReader = new BufferReader(info)
                var sourcefile_index = reader2.readU2()
                array[i].attribute_value = this.classFile.constant_pool[sourcefile_index].utf_val
            } else if (array[i].attribute_name == 'InnerClasses') {
                array[i].inner_classes_info = this.readInnerClassesAttribute(info)
            } else {
                console.log('unknown attribute ' + array[i].attribute_name)
            }
        }
        return array
    }

    private readCodeAttribute(buffer: Buffer): CodeInfo {
        var reader: BufferReader = new BufferReader(buffer)
        var code_info: CodeInfo = new CodeInfo()
        code_info.max_stack = reader.readU2()
        code_info.max_locals = reader.readU2()
        code_info.code_length = reader.readU4()
        code_info.code = reader.read(code_info.code_length)
        var exception_table_length = reader.readU2()
        code_info.exception_table = new Array<any>(exception_table_length)
        for (var i = 0; i < exception_table_length; i++) {
            code_info.exception_table[i].start_pc = reader.readU2()
            code_info.exception_table[i].end_pc = reader.readU2()
            code_info.exception_table[i].handler_pc = reader.readU2()
            code_info.exception_table[i].catch_type = reader.readU2()
        }
        var attributes_count = reader.readU2()
        code_info.attributes = this.readAttributes(reader, attributes_count)
        return code_info
    }

    private readLineNumberTableAttribute(buffer: Buffer): LineNumberTableInfo[] {
        var reader: BufferReader = new BufferReader(buffer)
        var length = reader.readU2()
        var array: LineNumberTableInfo[] = new Array<LineNumberTableInfo>(length)
        for (var i = 0; i < length; i++) {
            array[i] = new LineNumberTableInfo()
            array[i].start_pc = reader.readU2()
            array[i].line_number = reader.readU2()
        }
        return array
    }

    private readStackMapTableAttribute(buffer: Buffer): StackMapTableInfo[] {
        var reader: BufferReader = new BufferReader(buffer)
        var length = reader.readU2()
        var array: StackMapTableInfo[] = new Array<StackMapTableInfo>(length)
        for (var i = 0; i < length; i++) {
            array[i] = new StackMapTableInfo()
            //array[i].start_pc = reader.readU2()
            //array[i].line_number = reader.readU2()
        }
        return array
    }

    private readInnerClassesAttribute(buffer: Buffer): InnerClassInfo[] {
        var reader: BufferReader = new BufferReader(buffer)
        var length = reader.readU2()
        var array: InnerClassInfo[] = new Array<InnerClassInfo>(length)
        for (var i = 0; i < length; i++) {
            array[i] = new InnerClassInfo()
            array[i].inner_class_info_index = reader.readU2()
            array[i].outer_class_info_index = reader.readU2()
            array[i].inner_name_index = reader.readU2()
            array[i].inner_class_access_flags = reader.readU2()
        }
        return array
    }

    private readConstantPool(): void {
        var constant_pool_count = this.reader.readU2()
        this.classFile.constant_pool = new Array<ConstantPoolInfo>(constant_pool_count)
        for (var i = 1; i < constant_pool_count; i++) {
            this.classFile.constant_pool[i] = new ConstantPoolInfo()
            var cp: ConstantPoolInfo = this.classFile.constant_pool[i]
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
            acc_private: ((flags & 0x0002) != 0),
            acc_protected: ((flags & 0x0004) != 0),
            acc_static: ((flags & 0x0008) != 0),
            acc_final: ((flags & 0x0010) != 0),
            acc_super: ((flags & 0x0020) != 0),
            acc_synchronized: ((flags & 0x0020) != 0),
            acc_bridge: ((flags & 0x0040) != 0),
            acc_varargs: ((flags & 0x0080) != 0),
            acc_native: ((flags & 0x0100) != 0),
            acc_interface: ((flags & 0x0200) != 0),
            acc_abstract: ((flags & 0x0400) != 0),
            acc_strict: ((flags & 0x0800) != 0),
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
        return (val1 << 32) | val2
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
        return (val1 << 32) | val2
    }
}
