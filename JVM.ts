import { Class, ClassMethod, ConstantPoolInfo } from "./Class";
import { ClassLoader } from "./ClassLoader";
import { JVMStack } from "./JVMStack";
import * as util from "util"

export class JVM {
    private classLoader: ClassLoader = new ClassLoader();
    private frame: StackFrame[] = []
    private heap: any[] = []

    public start(mainClass: string): void {
        this.initFrame(mainClass)
        // https://en.wikipedia.org/wiki/Java_bytecode_instruction_listings
        while (true) {
            var cur_frame: StackFrame = this.frame[this.frame.length - 1]

            var bytecode = cur_frame.code[cur_frame.pc]

            try {
                switch (bytecode) {
                    case 0x01: // aconst_null
                        cur_frame.operand_stack.writeInt(0)
                        cur_frame.pc++
                        break

                    case 0x09: // lconst_0
                        cur_frame.operand_stack.writeLong(0)
                        cur_frame.pc++
                        break

                    case 0x0a: // lconst_1
                        cur_frame.operand_stack.writeLong(1)
                        cur_frame.pc++
                        break

                    case 0x10: // bipush
                        this.code_bipush(cur_frame)
                        break

                    case 0x13: // ldc_w
                    case 0x14: // ldc2_w
                        this.code_ldc_w(cur_frame)
                        break

                    case 0x1a: // iload_0
                    case 0x1b: // iload_1
                    case 0x1c: // iload_2
                    case 0x1d: // iload_3
                        this.code_iload_n(cur_frame, bytecode - 0x1a)
                        break

                    case 0x1e: // lload_0
                    case 0x1f: // lload_1
                    case 0x20: // lload_2
                    case 0x21: // lload_3
                        this.code_lload_n(cur_frame, bytecode - 0x1e)
                        break

                    case 0x3f: // lstore_0
                    case 0x40: // lstore_1
                    case 0x41: // lstore_2
                    case 0x42: // lstore_3
                        this.code_lstore_n(cur_frame, bytecode - 0x3f)
                        break

                    case 0x85: // i2l
                        cur_frame.operand_stack.writeLong(cur_frame.operand_stack.readInt())
                        cur_frame.pc++
                        break

                    case 0x86: // i2f
                        cur_frame.operand_stack.writeFloat(cur_frame.operand_stack.readInt())
                        cur_frame.pc++
                        break

                    case 0x87: // i2d
                        cur_frame.operand_stack.writeDouble(cur_frame.operand_stack.readInt())
                        cur_frame.pc++
                        break

                    case 0x91: // i2b
                        cur_frame.operand_stack.writeInt(cur_frame.operand_stack.readInt() & 0xff)
                        cur_frame.pc++
                        break

                    case 0x92: // i2c
                    case 0x93: // i2s
                        cur_frame.operand_stack.writeInt(cur_frame.operand_stack.readInt() & 0xffff)
                        cur_frame.pc++
                        break

                    case 0xb1:
                        this.code_return(cur_frame)
                        break

                    case 0xb2:
                        this.code_getstatic(cur_frame)
                        break

                    case 0xb3:
                        this.code_putstatic(cur_frame)
                        break

                    case 0xb8:
                        this.code_invokestatic(cur_frame)
                        break

                    default:
                        this.printStackTrace()
                        throw new Error("Not implemented " + bytecode + " @ " + cur_frame.pc)
                }
            } catch (e) {
                if (e instanceof ClassLoadException) {
                    continue
                } else {
                    console.error(e)
                    break
                }
            }
        }
    }

    private printStackTrace(): void {
        this.frame.reverse().forEach(frame => {
            console.log(frame.clazz.class_name + '.' + frame.method.signature + ':' + frame.pc)
        })
    }

    private new_frame(class_name: string, method_name: string): void {
        var cur_frame: StackFrame = this.frame[this.frame.length - 1]
        var new_frame: StackFrame = new StackFrame()
        new_frame.clazz = this.get_class(class_name)
        new_frame.method = new_frame.clazz.methods[method_name]
        new_frame.code = new_frame.method.code
        new_frame.operand_stack = new JVMStack(new_frame.method.max_stack * 4)
        new_frame.var_stack = new JVMStack(new_frame.method.max_locals * 4)
        for (var i = new_frame.method.args_size - 1; i >= 0; i--) {
            new_frame.var_stack.writeInt(cur_frame.operand_stack.readInt(), i)
        }
        this.frame.push(new_frame)
    }

    private get_class(class_name: string): Class {
        var { clazz, cached } = this.classLoader.loadClass(class_name)
        if (!cached) {
            if ("<clinit>()V" in clazz.methods) {
                this.new_frame(class_name, "<clinit>()V")
                throw new ClassLoadException()
            }
        }
        return clazz
    }

    private code_bipush(cur_frame: StackFrame): void {
        var value = cur_frame.code[cur_frame.pc + 1]
        cur_frame.operand_stack.writeInt(value)
        cur_frame.pc += 2
    }

    private code_ldc_w(cur_frame: StackFrame): void {
        var index1 = cur_frame.code[cur_frame.pc + 1]
        var index2 = cur_frame.code[cur_frame.pc + 2]
        var index = (index1 << 8) | index2

        var cp: ConstantPoolInfo[] = cur_frame.clazz.constant_pool
        var const_ref: ConstantPoolInfo = cp[index]
        var value: number
        if (const_ref.tag == 5) {
            value = const_ref.long_val
            cur_frame.operand_stack.writeLong(value)
        } else if (const_ref.tag == 6) {
            value = const_ref.double_val
            cur_frame.operand_stack.writeDouble(value)
        }
        cur_frame.pc += 3
    }

    private code_iload_n(cur_frame: StackFrame, local: number): void {
        var val = cur_frame.var_stack.readInt(local)
        cur_frame.operand_stack.writeInt(val)
        cur_frame.pc++
    }

    private code_lload_n(cur_frame: StackFrame, local: number): void {
        var val = cur_frame.var_stack.readLong(local)
        cur_frame.operand_stack.writeLong(val)
        cur_frame.pc++
    }

    private code_lstore_n(cur_frame: StackFrame, local: number): void {
        var val = cur_frame.operand_stack.readLong()
        cur_frame.var_stack.writeLong(val, local)
        cur_frame.pc++
    }

    private code_return(cur_frame: StackFrame): void {
        cur_frame.pc++
        this.frame.pop()
    }

    private code_getstatic(cur_frame: StackFrame): void {
        var index1 = cur_frame.code[cur_frame.pc + 1]
        var index2 = cur_frame.code[cur_frame.pc + 2]
        var index = (index1 << 8) | index2

        var cp: ConstantPoolInfo[] = cur_frame.clazz.constant_pool
        var field_ref: ConstantPoolInfo = cp[index]
        var class_info: ConstantPoolInfo = cp[field_ref.class_index]
        var class_name: string = cp[class_info.name_index].utf_val
        var name_and_type: ConstantPoolInfo = cp[field_ref.name_and_type_index]
        var name: string = cp[name_and_type.name_index].utf_val
        var type: string = cp[name_and_type.descriptor_index].utf_val

        var clazz: Class = this.get_class(class_name)
        cur_frame.operand_stack.writeInt(clazz.fields[name].static_value)

        cur_frame.pc += 3
    }

    private code_putstatic(cur_frame: StackFrame): void {
        var index1 = cur_frame.code[cur_frame.pc + 1]
        var index2 = cur_frame.code[cur_frame.pc + 2]
        var index = (index1 << 8) | index2

        var cp: ConstantPoolInfo[] = cur_frame.clazz.constant_pool
        var field_ref: ConstantPoolInfo = cp[index]
        var class_info: ConstantPoolInfo = cp[field_ref.class_index]
        var class_name: string = cp[class_info.name_index].utf_val
        var name_and_type: ConstantPoolInfo = cp[field_ref.name_and_type_index]
        var name: string = cp[name_and_type.name_index].utf_val
        var type: string = cp[name_and_type.descriptor_index].utf_val

        var clazz: Class = this.get_class(class_name)
        if (type == 'J') {
            clazz.fields[name].static_value = cur_frame.operand_stack.readLong()
        } else {
            clazz.fields[name].static_value = cur_frame.operand_stack.readInt()
        }

        cur_frame.pc += 3
    }

    private code_invokestatic(cur_frame: StackFrame): void {
        var index1 = cur_frame.code[cur_frame.pc + 1]
        var index2 = cur_frame.code[cur_frame.pc + 2]
        var index = (index1 << 8) | index2

        var cp: ConstantPoolInfo[] = cur_frame.clazz.constant_pool

        var method_ref: ConstantPoolInfo = cp[index]
        var class_info: ConstantPoolInfo = cp[method_ref.class_index]
        var class_name: string = cp[class_info.name_index].utf_val
        var name_and_type: ConstantPoolInfo = cp[method_ref.name_and_type_index]
        var name: string = cp[name_and_type.name_index].utf_val
        var type: string = cp[name_and_type.descriptor_index].utf_val

        this.new_frame(class_name, name + type)

        cur_frame.pc += 3
    }
    
    private initFrame(mainClass: string): void {
        var boot_frame = new StackFrame()
        boot_frame.clazz = new BootClass(mainClass)
        boot_frame.method = boot_frame.clazz.methods['<clinit>()V']
        boot_frame.code = boot_frame.method.code
        boot_frame.operand_stack = new JVMStack(10)
        boot_frame.var_stack = new JVMStack(10)
        this.frame.push(boot_frame)
    }
}

// stop current instruction and call <clinit> method
const ClassLoadException = function () {
    Error.captureStackTrace(this, this.constructor)
    this.name = this.constructor.name
}
util.inherits(ClassLoadException, Error)

class StackFrame {
    var_stack: JVMStack
    operand_stack: JVMStack
    code: Buffer = null
    pc: number = 0
    sp: number = 0
    clazz: Class = null
    method: ClassMethod = null
}

class BootClass extends Class {
    /*
    class BootClass {
        static {
            $main_class.main((java.lang.String[])null);
        }
    }
    */
    constructor(public main_class: string) {
        super()

        this.constant_pool = new Array<ConstantPoolInfo>(7)
        this.constant_pool[1] = new ConstantPoolInfo()
        this.constant_pool[1].tag = 1
        this.constant_pool[1].utf_val = main_class
        this.constant_pool[2] = new ConstantPoolInfo()
        this.constant_pool[2].tag = 1
        this.constant_pool[2].utf_val = 'main'
        this.constant_pool[3] = new ConstantPoolInfo()
        this.constant_pool[3].tag = 1
        this.constant_pool[3].utf_val = '([Ljava/lang/String;)V'
        this.constant_pool[4] = new ConstantPoolInfo()
        this.constant_pool[4].tag = 7
        this.constant_pool[4].name_index = 1
        this.constant_pool[5] = new ConstantPoolInfo()
        this.constant_pool[5].tag = 12
        this.constant_pool[5].name_index = 2
        this.constant_pool[5].descriptor_index = 3
        this.constant_pool[6] = new ConstantPoolInfo()
        this.constant_pool[6].tag = 10
        this.constant_pool[6].class_index = 4
        this.constant_pool[6].name_and_type_index = 5

        var code = new Uint8Array(4)
        code[0] = 0x01
        code[1] = 0xb8
        code[2] = 0x00
        code[3] = 0x06

        this.methods['<clinit>()V'] = new ClassMethod()
        this.methods['<clinit>()V'].code = Buffer.from(code)
    }
}
