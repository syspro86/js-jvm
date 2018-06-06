import { Class } from "./Class"
import * as fs from "fs";

// JVM Class spec
// https://docs.oracle.com/javase/specs/jvms/se7/html/jvms-4.html

export class ClassLoader {
    constructor() {

    }

    public loadClass(bufferOrPath: Buffer | String): Class {
        var buffer: Buffer
        if (bufferOrPath instanceof Buffer) {
            buffer = bufferOrPath
        } else if (typeof bufferOrPath === "string") {
            buffer = fs.readFileSync(bufferOrPath)            
        }

        var reader: BufferReader
        reader = new BufferReader(buffer)

        var creader: ClassReader
        creader = new ClassReader(reader)

        var clazz: ClassFile = creader.read()

        var thisClassIndex = clazz.this_class
        thisClassIndex = clazz.constant_pool[thisClassIndex].name_index
        var thisClassName = clazz.constant_pool[thisClassIndex].utf_val
        console.log('this class ' + thisClassName)

        console.log('constant pool')
        for (var i = 1; i < clazz.constant_pool_count; i++) {
            console.log(i + ' = ' + clazz.constant_pool[i].tag)
            if (clazz.constant_pool[i].tag == 7) {
                var ni = clazz.constant_pool[i].name_index
                console.log('class ' + clazz.constant_pool[ni].utf_val)
            }
        }
        return null
    }
}

class ClassFile {
    minor_version: number;
    major_version: number;
    constant_pool_count: number;
    constant_pool: ConstantPoolInfo[];
    access_flags: number;
    this_class: number;
    super_class: number;
    interfaces_count: number;
    interfaces: number[];
    fields_count: number;
    fields: MemberInfo[];
    methods_count: number;
    method_info: MemberInfo[];
    attributes_count: number;
    attributes: AttributeInfo[];
}

class ConstantPoolInfo {
    tag: number
    utf_val: String;
    int_val: number;
    float_val: number;
    long_val: number;
    double_val: number;
    string_index: number;
    name_index: number;
    class_index: number;
    name_and_type_index: number;
    descriptor_index: number;
    reference_kind: number;
    reference_index: number;
    bootstrap_method_attr_index: number;
}

class MemberInfo {
    access_flags: number;
    name_index: number;
    descriptor_index: number;
    attributes_count: number;
    attributes: AttributeInfo[];
}

class AttributeInfo {
    attribute_name_index: number;
    attribute_length: number;
    info: Buffer;
}

class ClassReader {
    private reader: BufferReader
    constructor(reader: BufferReader) {
        this.reader = reader
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
        classFile.access_flags = this.reader.readU2()
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
            var cp: ConstantPoolInfo = new ConstantPoolInfo()
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
                    break

                case 6:
                    cp.double_val = this.reader.readF8()
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
            classFile.constant_pool[i] = cp
        }
    }
    
    private readConstantUTF(): String {
        var length: number = this.reader.readU2()
        var buffer: Buffer = this.reader.read(length)
        return buffer.toString("utf-8")
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
}
